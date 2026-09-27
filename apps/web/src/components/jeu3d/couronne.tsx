"use client"

import { Billboard } from "@react-three/drei"
import { useFrame } from "@react-three/fiber"
import { easing } from "maath"
import { useRef, useState } from "react"
import { Color, DoubleSide, type Group, type MeshBasicMaterial, type Texture, TextureLoader } from "three"

const OR = new Color("#f2c14e")
let couronne: Texture | null = null
const textureCouronne = () => (couronne ??= new TextureLoader().load("/pictos/picto-noble.webp"))

export function Couronne3D({ visible, taille = 1.3 }: { visible: boolean; taille?: number }) {
  const ref = useRef<Group>(null)
  const materiau = useRef<MeshBasicMaterial>(null)
  const [texture] = useState(textureCouronne)
  useFrame(({ clock }, dt) => {
    const g = ref.current
    if (!g) return
    const t = clock.elapsedTime
    const s = visible ? taille : 0.0001
    easing.damp3(g.scale, [s, s, s], 0.25, dt)
    g.position.y = 0.5 * s + 0.08 + Math.sin(t * 2) * 0.06
    if (materiau.current) materiau.current.color.copy(OR).multiplyScalar(1 + 0.35 * Math.pow(0.5 + 0.5 * Math.sin(t * 3.4), 6))
    g.visible = g.scale.x > 0.001
  })
  return (
    <group ref={ref} scale={0.0001}>
      <Billboard lockX lockZ>
        <mesh raycast={() => null}>
          <planeGeometry args={[1, 160 / 145]} />
          <meshBasicMaterial ref={materiau} map={texture} color="#f2c14e" transparent alphaTest={0.05} side={DoubleSide} toneMapped={false} />
        </mesh>
      </Billboard>
    </group>
  )
}
