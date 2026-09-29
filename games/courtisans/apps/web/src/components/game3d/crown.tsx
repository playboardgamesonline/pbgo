"use client"

import { Billboard } from "@react-three/drei"
import { useFrame } from "@react-three/fiber"
import { easing } from "maath"
import { useRef, useState } from "react"
import { Color, DoubleSide, Vector3, type Group, type MeshBasicMaterial, type Texture, TextureLoader } from "three"

const GOLD = new Color("#f2c14e")
const UNDER_TABLE = -1.8
let crown: Texture | null = null
const crownTexture = () => (crown ??= new TextureLoader().load("/pictograms/PICTOGRAM_NOBLE.webp"))

export function Crown3D({ target, size = 1.3 }: { target: Vector3 | null; size?: number }) {
  const shown = useRef<Vector3 | null>(null)
  const ref = useRef<Group>(null)
  const material = useRef<MeshBasicMaterial>(null)
  const [texture] = useState(crownTexture)
  useFrame(({ clock }, dt) => {
    const g = ref.current
    if (!g) return
    const t = clock.elapsedTime
    const inPlace = !!target && !!shown.current && target.distanceTo(shown.current) < 0.05
    if (!inPlace && g.position.y <= UNDER_TABLE + 0.2) {
      shown.current = target ? target.clone() : null
      if (target) g.position.set(target.x, UNDER_TABLE, target.z)
    }
    const output = !!target && !!shown.current && target.distanceTo(shown.current) < 0.05
    easing.damp(g.position, "y", output ? 0.5 * size + 0.08 + Math.sin(t * 2) * 0.06 : UNDER_TABLE, output ? 0.35 : 0.18, dt)
    g.scale.setScalar(size)
    if (material.current) material.current.color.copy(GOLD).multiplyScalar(1 + 0.35 * Math.pow(0.5 + 0.5 * Math.sin(t * 3.4), 6))
    g.visible = g.position.y > UNDER_TABLE + 0.1
  })
  return (
    <group ref={ref} position-y={UNDER_TABLE}>
      <Billboard lockX lockZ>
        <mesh raycast={() => null}>
          <planeGeometry args={[1, 160 / 145]} />
          <meshBasicMaterial ref={material} map={texture} color="#f2c14e" transparent alphaTest={0.05} side={DoubleSide} toneMapped={false} />
        </mesh>
      </Billboard>
    </group>
  )
}
