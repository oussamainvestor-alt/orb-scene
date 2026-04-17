import { MeshReflectorMaterial } from '@react-three/drei'

type ReflectiveGroundProps = {
  objectReflection: number
  objectReflectionOpacity: number
  groundSurface: number
}

export function ReflectiveGround({
  objectReflection,
  objectReflectionOpacity,
  groundSurface,
}: ReflectiveGroundProps) {
  const objectLevel = Math.min(1, Math.max(0, objectReflection))
  const objectOpacity = Math.min(1, Math.max(0, objectReflectionOpacity))
  const groundLevel = Math.min(1, Math.max(0, groundSurface))
  const mixStrength = (3 + objectLevel * 50) * objectOpacity
  const mirror = (0.05 + objectLevel * 0.9) * objectOpacity
  const roughness = 0.84 - objectLevel * 0.58
  // Higher groundLevel means stronger ground material presence (not reversed).
  const metalness = 0.08 + groundLevel * 0.6
  const depthScale = 0.35 + groundLevel * 1.1
  const tint = 18 + Math.round(groundLevel * 30)
  const groundColor = `rgb(${tint}, ${tint + 6}, ${tint + 16})`

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow position={[0, 0, 0]}>
      <planeGeometry args={[80, 80]} />
      <MeshReflectorMaterial
        color={groundColor}
        blur={[300, 100]}
        resolution={1024}
        mixBlur={1.2}
        mixStrength={mixStrength}
        roughness={roughness}
        metalness={metalness}
        depthScale={depthScale}
        minDepthThreshold={0.42}
        maxDepthThreshold={1.26}
        mirror={mirror}
        transparent
        opacity={0.25 + objectOpacity * 0.75}
      />
    </mesh>
  )
}
