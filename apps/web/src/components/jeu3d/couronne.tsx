"use client"

import { Billboard } from "@react-three/drei"
import { useFrame } from "@react-three/fiber"
import { easing } from "maath"
import { useRef, useState } from "react"
import { Color, DoubleSide, Vector3, type Group, type MeshBasicMaterial, type Texture, TextureLoader } from "three"

const OR = new Color("#f2c14e")
const SOUS_TABLE = -1.8
let couronne: Texture | null = null
const textureCouronne = () => (couronne ??= new TextureLoader().load("/pictograms/PICTOGRAM_NOBLE.webp"))

export function Couronne3D({ cible, taille = 1.3 }: { cible: Vector3 | null; taille?: number }) {
  const affichee = useRef<Vector3 | null>(null)
  const ref = useRef<Group>(null)
  const materiau = useRef<MeshBasicMaterial>(null)
  const [texture] = useState(textureCouronne)
  useFrame(({ clock }, dt) => {
    const g = ref.current
    if (!g) return
    const t = clock.elapsedTime
    const enPlace = !!cible && !!affichee.current && cible.distanceTo(affichee.current) < 0.05
    if (!enPlace && g.position.y <= SOUS_TABLE + 0.2) {
      affichee.current = cible ? cible.clone() : null
      if (cible) g.position.set(cible.x, SOUS_TABLE, cible.z)
    }
    const sortie = !!cible && !!affichee.current && cible.distanceTo(affichee.current) < 0.05
    easing.damp(g.position, "y", sortie ? 0.5 * taille + 0.08 + Math.sin(t * 2) * 0.06 : SOUS_TABLE, sortie ? 0.35 : 0.18, dt)
    g.scale.setScalar(taille)
    if (materiau.current) materiau.current.color.copy(OR).multiplyScalar(1 + 0.35 * Math.pow(0.5 + 0.5 * Math.sin(t * 3.4), 6))
    g.visible = g.position.y > SOUS_TABLE + 0.1
  })
  return (
    <group ref={ref} position-y={SOUS_TABLE}>
      <Billboard lockX lockZ>
        <mesh raycast={() => null}>
          <planeGeometry args={[1, 160 / 145]} />
          <meshBasicMaterial ref={materiau} map={texture} color="#f2c14e" transparent alphaTest={0.05} side={DoubleSide} toneMapped={false} />
        </mesh>
      </Billboard>
    </group>
  )
}
