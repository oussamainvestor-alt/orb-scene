import { useTexture } from '@react-three/drei'
import { useMemo } from 'react'
import { MeshStandardMaterial, RepeatWrapping } from 'three'
import type { GroundGrid } from '../../types'

const TEXTURE_PATHS = {
  map: '/textures/asphalt_basecolor.png',
  normalMap: '/textures/asphalt_normal.png',
  roughnessMap: '/textures/asphalt_roughness.png',
  metalnessMap: '/textures/asphalt_metallic.png',
  displacementMap: '/textures/asphalt_displacement.png',
}

useTexture.preload(Object.values(TEXTURE_PATHS))

type WetAsphaltGroundProps = { groundGrid?: GroundGrid }

export function WetAsphaltGround({ groundGrid = 1 }: WetAsphaltGroundProps) {
  const maps = useTexture(TEXTURE_PATHS)

  // Single plane that grows with groundGrid — no tile seams possible
  const planeSize = groundGrid * 10
  const segments = Math.max(32, groundGrid * 16)

  const material = useMemo(() => {
    const repeat = planeSize / 2.5
    Object.values(maps).forEach((tex) => {
      tex.wrapS = tex.wrapT = RepeatWrapping
      tex.repeat.set(repeat, repeat)
      tex.needsUpdate = true
    })
    return new MeshStandardMaterial({
      map: maps.map,
      normalMap: maps.normalMap,
      roughnessMap: maps.roughnessMap,
      metalnessMap: maps.metalnessMap,
      displacementMap: maps.displacementMap,
      displacementScale: 0.02,
    })
  }, [maps, planeSize])

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow material={material}>
      <planeGeometry args={[planeSize, planeSize, segments, segments]} />
    </mesh>
  )
}
