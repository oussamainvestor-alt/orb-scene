import { useGLTF } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import {
  Group,
  LinearFilter,
  Matrix4,
  Mesh,
  PerspectiveCamera,
  Plane,
  RGBAFormat,
  ShaderMaterial,
  Vector3,
  WebGLRenderTarget,
} from 'three'
import type { GroundGrid } from '../../types'

const REFL_RES = 1024

const GROUND_VERT = `
  varying vec3 vWorldPos;
  varying vec4 vClipPos;

  void main() {
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorldPos = wp.xyz;
    vClipPos  = projectionMatrix * viewMatrix * wp;
    gl_Position = vClipPos;
  }
`

const GROUND_FRAG = `
  precision highp float;
  #define PI 3.14159265359

  varying vec3 vWorldPos;
  varying vec4 vClipPos;

  uniform sampler2D tReflection;
  uniform float     uTime;
  uniform vec3      uCamPos;

  // ── Scene lights (mirrors EnvironmentScene) ─────────────────────────────
  const vec3 DIR_L     = normalize(vec3(2.5, 4.2, 1.8));
  const vec3 DIR_COL   = vec3(0.478, 0.596, 0.753);   // #7a98c0 * 0.6
  const vec3 SPOT_POS  = vec3(0.0, 5.8, 0.6);
  const vec3 SPOT_COL  = vec3(0.710, 0.788, 0.937);   // #b5c9ef
  const vec3 POINT_POS = vec3(-2.5, 1.4, -2.0);
  const vec3 POINT_COL = vec3(0.255, 0.380, 0.561);   // #41618f
  // hemisphere: sky #132238 * 0.18, ground #090d16 * 0.18
  const vec3 HEMI_SKY  = vec3(0.074, 0.133, 0.220) * 0.18;
  const vec3 HEMI_GND  = vec3(0.035, 0.051, 0.086) * 0.18;
  // ambient: #162133 * 0.08
  const vec3 AMB_COL   = vec3(0.086, 0.129, 0.200) * 0.08;

  // ── Value noise + FBM ───────────────────────────────────────────────────
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float vnoise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f*f*(3.0-2.0*f);
    return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);
  }
  float fbm(vec2 p, int oct) {
    float v=0.0,a=0.5,fr=1.0;
    for(int i=0;i<8;i++){if(i>=oct)break;v+=a*vnoise(p*fr);a*=0.5;fr*=2.0;}
    return v;
  }

  // ── Cook-Torrance GGX BRDF ──────────────────────────────────────────────
  float D_GGX(float nh, float r){float a2=r*r*r*r,d=nh*nh*(a2-1.0)+1.0;return a2/(PI*d*d+1e-6);}
  float G_Smith(float nv, float nl, float r){float k=(r+1.0)*(r+1.0)/8.0;return(nv/(nv*(1.0-k)+k))*(nl/(nl*(1.0-k)+k));}
  vec3 F_Schlick(float c, vec3 F0){return F0+(1.0-F0)*pow(clamp(1.0-c,0.0,1.0),5.0);}
  vec3 cookTorrance(vec3 N,vec3 V,vec3 L,vec3 lc,vec3 alb,float r,vec3 F0){
    vec3 H=normalize(V+L);
    float nl=max(dot(N,L),0.0),nv=max(dot(N,V),0.001),nh=max(dot(N,H),0.0),hv=max(dot(H,V),0.0);
    vec3 F=F_Schlick(hv,F0);
    vec3 sp=D_GGX(nh,r)*G_Smith(nv,nl,r)*F/(4.0*nv*nl+1e-6);
    return((1.0-F)*alb/PI+sp)*lc*nl;
  }

  vec3 bumpNormal(vec2 uv, float str){
    float e=0.006,h0=fbm(uv,4),h1=fbm(uv+vec2(e,0),4),h2=fbm(uv+vec2(0,e),4);
    return normalize(vec3(-(h1-h0)/e*str,1.0,-(h2-h0)/e*str));
  }

  void main() {
    vec2 uv = vWorldPos.xz / 5.0;

    // ── Puddle distribution ─────────────────────────────────────────────
    float pA = fbm(uv*0.40, 4);
    float pB = fbm(uv*1.20 + vec2(4.1, 1.7), 3);
    float puddle = smoothstep(0.42, 0.58, pA*0.60 + pB*0.40);

    // ── Asphalt micro-texture ───────────────────────────────────────────
    float coarse = fbm(uv*6.5,  5);
    float fine   = fbm(uv*22.0, 3);
    float tex    = coarse*0.65 + fine*0.35;
    // slightly brighter than raw asphalt so hemisphere light makes it visible
    vec3 dryAlb  = vec3(0.055, 0.050, 0.046) * (0.50 + 0.50*tex);

    // ── Surface normals ─────────────────────────────────────────────────
    vec2 rA = uv*2.8 + vec2( uTime*0.022,  uTime*0.016);
    vec2 rB = uv*2.8 + vec2(-uTime*0.014, -uTime*0.027);
    float e = 0.006;
    float r0=fbm(rA,3)*0.65+fbm(rB,3)*0.35;
    float r1=fbm(rA+vec2(e,0),3)*0.65+fbm(rB+vec2(e,0),3)*0.35;
    float r2=fbm(rA+vec2(0,e),3)*0.65+fbm(rB+vec2(0,e),3)*0.35;
    vec3 rippleN = normalize(vec3(-(r1-r0)/e*0.12,1.0,-(r2-r0)/e*0.12));
    vec3 dryN    = bumpNormal(uv*4.2, 0.35);
    vec3 N = normalize(mix(dryN, rippleN, puddle));

    // ── Material ────────────────────────────────────────────────────────
    vec3 wetAlb = vec3(0.012, 0.014, 0.020);     // water-darkened
    vec3 albedo = mix(dryAlb, wetAlb, puddle);
    float rough = mix(0.85, 0.015, puddle);       // mirror-smooth in puddles
    vec3  F0    = mix(vec3(0.04), vec3(0.019, 0.020, 0.025), puddle);

    vec3 V = normalize(uCamPos - vWorldPos);

    // ── Planar reflection ───────────────────────────────────────────────
    vec2 scrUv   = (vClipPos.xy / vClipPos.w) * 0.5 + 0.5;
    vec2 distort = N.xz * puddle * 0.026;
    vec2 reflUv  = clamp(scrUv + distort, vec2(0.001), vec2(0.999));
    vec3 reflCol = texture2D(tReflection, reflUv).rgb;

    // Reflection strength: artistically boosted so puddles are clearly visible.
    // Physical Fresnel for water at normal incidence is ~2% which looks like nothing.
    // We use a base of 0.45 in puddles + Fresnel on top, clamped to 0.96.
    float NdotV  = max(dot(N, V), 0.0);
    float fres   = F_Schlick(NdotV, F0).g;
    float reflStr = clamp(puddle * 0.45 + fres * puddle * 0.90, 0.0, 0.96);

    // ── Direct lighting ─────────────────────────────────────────────────
    vec3 Lo = vec3(0.0);
    Lo += cookTorrance(N,V,DIR_L,DIR_COL*0.55,albedo,rough,F0);

    vec3  sDir = normalize(SPOT_POS - vWorldPos);
    float sDst = length(SPOT_POS - vWorldPos);
    Lo += cookTorrance(N,V,sDir,SPOT_COL/(1.0+0.09*sDst+0.018*sDst*sDst)*2.6,albedo,rough,F0);

    vec3  pDir = normalize(POINT_POS - vWorldPos);
    float pDst = length(POINT_POS - vWorldPos);
    Lo += cookTorrance(N,V,pDir,POINT_COL/(1.0+0.22*pDst+0.07*pDst*pDst)*1.6,albedo,rough,F0);

    // ── Ambient (hemisphere + ambient light) ────────────────────────────
    float hemiW  = N.y * 0.5 + 0.5;
    vec3  hemi   = mix(HEMI_GND, HEMI_SKY, hemiW);
    vec3  ambient = albedo * (hemi + AMB_COL);

    // ── Compose ─────────────────────────────────────────────────────────
    vec3 color = ambient + Lo;
    color = mix(color, reflCol, reflStr);

    // Fog: near=5, far=18, #060a11
    float fogDist = length(vWorldPos - uCamPos);
    float fog     = clamp((fogDist - 5.0) / 13.0, 0.0, 1.0);
    color = mix(color, vec3(0.024, 0.039, 0.067), fog);

    gl_FragColor = vec4(color, 1.0);
  }
`

function getTilePositions(groundGrid: GroundGrid): Array<[number, number, number]> {
  if (groundGrid === 1) return [[0, 0, 0]]
  if (groundGrid === 2) return [[-5, 0, -5], [5, 0, -5], [-5, 0, 5], [5, 0, 5]]
  const half = (groundGrid - 1) / 2
  const out: Array<[number, number, number]> = []
  for (let i = 0; i < groundGrid; i++)
    for (let j = 0; j < groundGrid; j++)
      out.push([(i - half) * 5, 0, (j - half) * 5])
  return out
}

type TileProps = { position: [number, number, number]; material: ShaderMaterial }

function GroundTile({ position, material }: TileProps) {
  const { scene } = useGLTF('/ground_concrete.glb')
  const cloned = useMemo(() => scene.clone(), [scene])

  useEffect(() => {
    cloned.traverse((child) => {
      if (child instanceof Mesh) {
        child.material = material
        child.receiveShadow = true
      }
    })
  }, [cloned, material])

  return <primitive object={cloned} position={position} />
}

type WetAsphaltGroundProps = { groundGrid?: GroundGrid }

export function WetAsphaltGround({ groundGrid = 1 }: WetAsphaltGroundProps) {
  const { scene: threeScene } = useThree()
  const groupRef = useRef<Group>(null)

  const reflTarget = useMemo(
    () => new WebGLRenderTarget(REFL_RES, REFL_RES, {
      minFilter: LinearFilter,
      magFilter: LinearFilter,
      format: RGBAFormat,
    }),
    [],
  )

  const virtualCam = useMemo(() => {
    const cam = new PerspectiveCamera()
    cam.matrixAutoUpdate = false
    return cam
  }, [])

  const reflMatrix      = useMemo(() => new Matrix4().makeScale(1, -1, 1), [])
  const groundClipPlane = useMemo(() => new Plane(new Vector3(0, 1, 0), 0), [])

  const material = useMemo(
    () => new ShaderMaterial({
      uniforms: {
        tReflection: { value: reflTarget.texture },
        uTime:       { value: 0 },
        uCamPos:     { value: new Vector3() },
      },
      vertexShader:   GROUND_VERT,
      fragmentShader: GROUND_FRAG,
      toneMapped: false,
    }),
    [reflTarget],
  )

  const tiles = useMemo(() => getTilePositions(groundGrid), [groundGrid])

  useFrame(({ gl, camera, clock }) => {
    if (!groupRef.current) return

    virtualCam.projectionMatrix.copy(camera.projectionMatrix)
    virtualCam.projectionMatrixInverse.copy(camera.projectionMatrixInverse)
    virtualCam.matrixWorld.copy(camera.matrixWorld).premultiply(reflMatrix)
    virtualCam.matrixWorldInverse.copy(virtualCam.matrixWorld).invert()

    groupRef.current.visible = false
    const prevTarget     = gl.getRenderTarget()
    const prevLocalClip  = gl.localClippingEnabled
    const prevClipPlanes = gl.clippingPlanes

    gl.localClippingEnabled = true
    gl.clippingPlanes = [groundClipPlane]
    gl.setRenderTarget(reflTarget)
    gl.clear()
    gl.render(threeScene, virtualCam)
    gl.setRenderTarget(prevTarget)
    gl.clippingPlanes = prevClipPlanes
    gl.localClippingEnabled = prevLocalClip
    groupRef.current.visible = true

    material.uniforms.uTime.value = clock.elapsedTime
    material.uniforms.uCamPos.value.copy(camera.position)
  })

  return (
    <group ref={groupRef}>
      {tiles.map((pos, i) => (
        <GroundTile key={i} position={pos} material={material} />
      ))}
    </group>
  )
}
