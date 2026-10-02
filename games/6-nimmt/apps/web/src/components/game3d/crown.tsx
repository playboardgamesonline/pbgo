"use client"

import { Billboard } from "@react-three/drei"
import { useFrame } from "@react-three/fiber"
import { easing } from "maath"
import { useMemo, useRef } from "react"
import { CanvasTexture, Color, DoubleSide, type Group, type MeshBasicMaterial, SRGBColorSpace, type Texture, TextureLoader } from "three"

const GOLD = new Color("#f2c14e")

/** Couronne dessinée par défaut (aucune image requise) : remplacée par l'icône du jeu (`hostIcon` de l'habillage, réglable dans l'admin) quand elle existe. */
function drawnCrown() {
  const c = document.createElement("canvas")
  c.width = 256
  c.height = 256
  const ctx = c.getContext("2d")!
  ctx.fillStyle = "#fff"
  ctx.beginPath()
  ctx.moveTo(28, 190)
  ctx.lineTo(18, 70)
  ctx.lineTo(84, 120)
  ctx.lineTo(128, 40)
  ctx.lineTo(172, 120)
  ctx.lineTo(238, 70)
  ctx.lineTo(228, 190)
  ctx.closePath()
  ctx.fill()
  ctx.fillRect(28, 204, 200, 26)
  const t = new CanvasTexture(c)
  t.colorSpace = SRGBColorSpace
  return t
}

/**
 * Couronne du joueur dont c'est le tour, posée à gauche de son pseudo (sans se déplacer autour de la table).
 * `icon` : URL de l'icône du jeu (`hostIcon` de l'habillage) ; sans icône, une couronne dessinée.
 */
export function TurnCrown({ show, position, icon, size = 0.9 }: { show: boolean; position: [number, number, number]; icon?: string | null; size?: number }) {
  const ref = useRef<Group>(null)
  const material = useRef<MeshBasicMaterial>(null)
  const texture = useMemo<Texture>(() => (icon ? new TextureLoader().load(icon) : drawnCrown()), [icon])
  useFrame(({ clock }, dt) => {
    const g = ref.current
    if (!g) return
    easing.damp(g.scale, "x", show ? size : 0.0001, 0.25, dt)
    g.scale.y = g.scale.z = g.scale.x
    g.position.y = 0.5 * g.scale.x + 0.08 + (show ? Math.sin(clock.elapsedTime * 2) * 0.05 : 0)
    if (material.current) material.current.color.copy(GOLD).multiplyScalar(1 + 0.3 * Math.pow(0.5 + 0.5 * Math.sin(clock.elapsedTime * 3.4), 6))
    g.visible = g.scale.x > 0.02
  })
  return (
    <group position={position}>
      <group ref={ref} scale={0.0001} visible={false}>
        <Billboard lockX lockZ>
          <mesh raycast={() => null}>
            <planeGeometry args={[1, 1]} />
            <meshBasicMaterial ref={material} map={texture} color="#f2c14e" transparent alphaTest={0.05} side={DoubleSide} toneMapped={false} />
          </mesh>
        </Billboard>
      </group>
    </group>
  )
}
