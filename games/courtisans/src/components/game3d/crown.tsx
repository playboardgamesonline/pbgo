"use client"

import { Billboard } from "@react-three/drei"
import { useFrame } from "@react-three/fiber"
import { easing } from "maath"
import { useRef, useState } from "react"
import { Color, DoubleSide, type Vector3, type Group, type MeshBasicMaterial, type Texture, TextureLoader } from "three"
import { asset } from "../../lib/site"

const GOLD = new Color("#f2c14e")
let crown: Texture | null = null
const crownTexture = () => (crown ??= new TextureLoader().load(asset("/pictograms/PICTOGRAM_NOBLE.webp")))

/**
 * Crown of the player whose turn it is: placed left of their nickname, without moving around the table.
 * It scales in and out; the pictogram (`/courtisans/pictograms/PICTOGRAM_NOBLE.webp`) is the one of the game's skin.
 * `origin` and `yaw` place the frame of `offset`; inside a `TableText` (which already is that frame) they are left out.
 */
export function CrownMark({ show, origin, yaw = 0, offset, size = 1.1 }: { show: boolean; origin?: Vector3; yaw?: number; offset: [number, number]; size?: number }) {
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
