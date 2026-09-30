"use client"

import { Billboard } from "@react-three/drei"
import { useFrame } from "@react-three/fiber"
import { easing } from "maath"
import { useRef, useState } from "react"
import { Color, DoubleSide, type Vector3, type Group, type MeshBasicMaterial, type Texture, TextureLoader } from "three"

const GOLD = new Color("#f2c14e")
let crown: Texture | null = null
const crownTexture = () => (crown ??= new TextureLoader().load("/pictograms/PICTOGRAM_NOBLE.webp"))

/**
 * Couronne du joueur dont c'est le tour : posée à gauche de son pseudo (ou à la place du pseudo pour soi), sans se déplacer autour de la table.
 * Elle apparaît et disparaît en fondu d'échelle ; le pictogramme (`/pictograms/PICTOGRAM_NOBLE.webp`) est celui de l'habillage du jeu.
 */
export function CrownMark({ show, origin, yaw, offset, size = 1.1 }: { show: boolean; origin: Vector3; yaw: number; offset: [number, number]; size?: number }) {
  const ref = useRef<Group>(null)
  const material = useRef<MeshBasicMaterial>(null)
  const [texture] = useState(crownTexture)
  useFrame(({ clock }, dt) => {
    const g = ref.current
    if (!g) return
    const t = clock.elapsedTime
    easing.damp(g.scale, "x", show ? size : 0.0001, 0.25, dt)
    g.scale.y = g.scale.z = g.scale.x
    g.position.y = 0.5 * g.scale.x + 0.08 + (show ? Math.sin(t * 2) * 0.05 : 0)
    if (material.current) material.current.color.copy(GOLD).multiplyScalar(1 + 0.35 * Math.pow(0.5 + 0.5 * Math.sin(t * 3.4), 6))
    g.visible = g.scale.x > 0.02
  })
  return (
    <group position={origin} rotation-y={yaw}>
      <group position={[offset[0], 0, offset[1]]}>
      <group ref={ref} scale={0.0001} visible={false}>
        <Billboard lockX lockZ>
          <mesh raycast={() => null}>
            <planeGeometry args={[1, 160 / 145]} />
            <meshBasicMaterial ref={material} map={texture} color="#f2c14e" transparent alphaTest={0.05} side={DoubleSide} toneMapped={false} />
          </mesh>
        </Billboard>
      </group>
      </group>
    </group>
  )
}
