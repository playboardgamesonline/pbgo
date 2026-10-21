"use client"

import { Billboard } from "@react-three/drei"
import { useFrame } from "@react-three/fiber"
import { easing } from "maath"
import { useMemo, useRef } from "react"
import { CanvasTexture, Color, DoubleSide, type Vector3, type Group, type MeshBasicMaterial, SRGBColorSpace, type Texture, TextureLoader } from "three"

const GOLD = new Color("#f2c14e")

/** Crown drawn when the skin has no host icon in Sanity (`interface.hostIcon`). */
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

let drawn: Texture | null = null
const icons = new Map<string, Texture>()

/** One texture for every seat: the game's host icon, else a crown drawn once. */
function crownTexture(icon?: string | null): Texture {
  if (!icon) return (drawn ??= drawnCrown())
  let texture = icons.get(icon)
  if (!texture) icons.set(icon, (texture = new TextureLoader().load(icon)))
  return texture
}

/**
 * Crown of the player whose turn it is: placed left of their nickname, without moving around the table.
 * It scales in and out; `icon` is the game's host icon (the skin's `hostIcon`, set in Gamemaster › Visual), a drawn crown without one.
 * `origin` and `yaw` place the frame of `offset`; inside a `TableText` (which already is that frame) they are left out.
 */
export function CrownMark({
  show,
  origin,
  yaw = 0,
  offset,
  size = 1.1,
  icon,
}: {
  show: boolean
  origin?: Vector3
  yaw?: number
  offset: [number, number]
  size?: number
  icon?: string | null
}) {
  const ref = useRef<Group>(null)
  const material = useRef<MeshBasicMaterial>(null)
  const texture = useMemo(() => crownTexture(icon), [icon])
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
            <planeGeometry args={[1, 1]} />
            <meshBasicMaterial ref={material} map={texture} color="#f2c14e" transparent alphaTest={0.05} side={DoubleSide} toneMapped={false} />
          </mesh>
        </Billboard>
      </group>
      </group>
    </group>
  )
}
