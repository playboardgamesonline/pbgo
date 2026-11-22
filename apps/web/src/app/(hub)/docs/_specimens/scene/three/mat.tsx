"use client"

import type { CameraSettings, MatLayer, SurfaceProps } from "@pbgo/table"
import { useMemo } from "react"
import { MAT_COLORS, type MatKnobs } from "../defaults"
import { RestingCards, Stage } from "./parts"

// The mat of a table, described as data and baked once: a colour, then layers laid over it from the bottom up, each with a blend, and a pool of light. The picture of the planks is painted here in code, a stand-in for a picture of a game's own (wood, stone, leather,
// cloth), which it would give as it is; it repeats with no seam, as any picture must.

const CAMERA: CameraSettings = { tilt: 50, yaw: 0, distance: 15, fov: 34, targetX: 0, targetZ: 0.1 }

const RAINBOW = ["#ff4f9a", "#ff9a3d", "#f5e84a", "#5ed06b", "#33c4dc", "#4f7cf5", "#9a58ef", "#ff4f9a"]

let planks: HTMLCanvasElement | null = null

/** Planks of wood painted in code: a few tones, thin streaks that wrap at the sides, a seam between boards. Eight boards make one repeat, so the picture repeats down as well as across */
function plankPicture(): HTMLCanvasElement {
  if (planks) return planks
  const size = 512
  const canvas = document.createElement("canvas")
  canvas.width = canvas.height = size
  const ctx = canvas.getContext("2d")!
  let state = 11
  const random = () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0
    return state / 2 ** 32
  }
  const boards = 8
  const height = size / boards
  for (let board = 0; board < boards; board++) {
    const y = board * height
    const tone = 0.78 + 0.22 * random()
    ctx.fillStyle = `rgb(${Math.round(168 * tone)}, ${Math.round(118 * tone)}, ${Math.round(72 * tone)})`
    ctx.fillRect(0, y, size, height)
    for (let streak = 0; streak < 46; streak++) {
      const x = random() * size
      const at = y + 3 + random() * (height - 6)
      const length = 50 + random() * 170
      ctx.strokeStyle = `rgba(70, 40, 18, ${0.1 + 0.22 * random()})`
      ctx.lineWidth = 1 + random() * 1.4
      // drawn again a repeat to either side, so that a streak that leaves the picture comes back in
      for (const shift of [-size, 0, size]) {
        ctx.beginPath()
        ctx.moveTo(x + shift, at)
        ctx.lineTo(x + shift + length, at + (random() - 0.5) * 3)
        ctx.stroke()
      }
    }
    ctx.fillStyle = "rgba(0, 0, 0, 0.55)"
    ctx.fillRect(0, y, size, 2.5)
  }
  planks = canvas
  return canvas
}

/** The surface a set of knobs describes: the layers, from the bottom up, then the pool of light */
export function surfaceOf({ color, pattern, picture, blend, light, glow, tile }: MatKnobs): SurfaceProps {
  const colors = MAT_COLORS[color]
  const layers: MatLayer[] = []
  if (pattern === "lattice") layers.push({ kind: "lattice", line: colors.line, diamonds: 3, width: 2.5 })
  if (pattern === "mosaic") layers.push({ kind: "mosaic", cells: 9, shade: 0.05, crack: 0.06, grain: 0.05 })
  if (pattern === "grain") layers.push({ kind: "grain", strength: 0.5 })
  if (picture) layers.push({ kind: "picture", picture: plankPicture(), blend })
  return { color: colors.base, layers, tile, light: light ? { center: colors.center, glow: glow ? { colors: RAINBOW } : undefined } : undefined }
}

export function MatScene(props: MatKnobs) {
  const { color, pattern, picture, blend, light, glow, tile } = props
  // The same surface for the same knobs: the table bakes the layers again only when they changed, but a new object each render would say so to every reader
  const surface = useMemo(() => surfaceOf({ color, pattern, picture, blend, light, glow, tile }), [color, pattern, picture, blend, light, glow, tile])
  return (
    <Stage id="scene-mat" camera={CAMERA} playIntro={false} surface={surface}>
      <RestingCards />
    </Stage>
  )
}
