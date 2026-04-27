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

type WetAsphaltGroundProps = { groundGrid?: GroundGrid }

export function WetAsphaltGround({ groundGrid = 1 }: WetAsphaltGroundProps) {
  const maps = useTexture(TEXTURE_PATHS)

  const tileSize = groundGrid <= 1 ? 20 : groundGrid === 2 ? 10 : 5

  const material = useMemo(() => {
    const repeat = tileSize / 2.5
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
  }, [maps, tileSize])

  const tiles = useMemo(() => getTilePositions(groundGrid), [groundGrid])

  return (
    <>
      {tiles.map((pos, i) => (
        <mesh key={i} rotation={[-Math.PI / 2, 0, 0]} position={pos} receiveShadow material={material}>
          <planeGeometry args={[tileSize, tileSize, 32, 32]} />
        </mesh>
      ))}
    </>
  )
}
