"use client"

import { useMemo } from "react"
import { CanvasTexture, SRGBColorSpace } from "three"

/** How high above the table the shadow lies: over the surface, under everything that stands on it */
const SHADOW_Y = 0.006

// One texture for every hand: a dark disc whose edge fades out softly
let disc: CanvasTexture | null = null
function discTexture() {
  if (disc) return disc
  const size = 256
  const canvas = document.createElement("canvas")
  canvas.width = canvas.height = size
  const ctx = canvas.getContext("2d")!
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
  gradient.addColorStop(0, "rgba(0,0,0,1)")
  gradient.addColorStop(0.5, "rgba(0,0,0,0.78)")
  gradient.addColorStop(0.8, "rgba(0,0,0,0.3)")
  gradient.addColorStop(1, "rgba(0,0,0,0)")
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, size, size)
  disc = new CanvasTexture(canvas)
  disc.colorSpace = SRGBColorSpace
  return disc
}

export type HandShadowProps = {
  /** Where the middle of the shadow lies on the table */
  at: { x: number; z: number }
  /** How far it reaches, in world units: a hand's fan, half its width and a little more */
  radius: number
  /** How dark it is at its middle, 0 to 1 (default 0.4) */
  opacity?: number
}

/**
 * The small round shadow under a hand that is held up: it says that the cards are in the air over the table, and where the hand is when the cards are few. Flat on the table, soft at the edge, drawn under the cards, and it takes no pointer. A board lays it where the fan of
 * the hand stands, with the radius of its width.
 */
export function HandShadow({ at, radius, opacity = 0.4 }: HandShadowProps) {
  const map = useMemo(() => discTexture(), [])
  return (
    <mesh position={[at.x, SHADOW_Y, at.z]} rotation-x={-Math.PI / 2} renderOrder={-1} raycast={() => null}>
      <planeGeometry args={[radius * 2, radius * 2]} />
      <meshBasicMaterial map={map} transparent opacity={opacity} depthWrite={false} toneMapped={false} />
    </mesh>
  )
}
