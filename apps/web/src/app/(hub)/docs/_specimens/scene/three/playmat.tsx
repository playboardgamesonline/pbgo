"use client"

import { type Blend, type CameraSettings, Playmat, type SurfaceProps, type Unroll } from "@pbgo/table"
import { useMemo } from "react"
import { CanvasTexture, SRGBColorSpace, type Texture } from "three"
import { RestingCards, Stage } from "./parts"

// A playmat on a table that goes on past it: a bounded mat, a face with a picture and a cloth laid over it, that is rolled up, rolls out and stays laid. Both pictures are painted here in code, stand-ins for the game's own (a picture of its mat, a seamless weave
// of its cloth), which it would give as they are.

const CAMERA: CameraSettings = { tilt: 50, yaw: 0, distance: 15, fov: 34, targetX: 0, targetZ: 0.1 }

/** The table under the playmat: dark, with a faint lattice, so that the edge of the playmat is seen against it */
const TABLE: SurfaceProps = { color: "#0a1f23", layers: [{ kind: "lattice", line: "#102a2f", diamonds: 3, width: 2.5 }], light: { center: "#12353a" } }

const WIDTH = 12
const DEPTH = 3

let picture: Texture | null = null

/** The face of the playmat, painted in code: a deep teal lit at its middle, a thin gold frame inside its edge and a faint line between each of its seven columns */
function matPicture(): Texture {
  if (picture) return picture
  const width = 1536
  const height = Math.round((width * DEPTH) / WIDTH)
  const canvas = document.createElement("canvas")
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext("2d")!
  const glow = ctx.createRadialGradient(width / 2, height / 2, 40, width / 2, height / 2, width * 0.55)
  glow.addColorStop(0, "#1f6a70")
  glow.addColorStop(0.6, "#14474e")
  glow.addColorStop(1, "#0c2f35")
  ctx.fillStyle = glow
  ctx.fillRect(0, 0, width, height)
  const inset = height * 0.07
  ctx.strokeStyle = "rgba(240, 214, 150, 0.85)"
  ctx.lineWidth = 3
  ctx.strokeRect(inset, inset, width - 2 * inset, height - 2 * inset)
  ctx.strokeStyle = "rgba(240, 214, 150, 0.22)"
  ctx.lineWidth = 2
  for (let column = 1; column < 7; column++) {
    const x = inset + ((width - 2 * inset) * column) / 7
    ctx.beginPath()
    ctx.moveTo(x, inset)
    ctx.lineTo(x, height - inset)
    ctx.stroke()
  }
  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  picture = texture
  return texture
}

let weave: Texture | null = null

/** A cloth painted in code: a middle grey, which a soft light leaves as it is, with fine threads over and under that cross every four texels, so that it repeats with no seam */
function clothPicture(): Texture {
  if (weave) return weave
  const size = 128
  const canvas = document.createElement("canvas")
  canvas.width = canvas.height = size
  const ctx = canvas.getContext("2d")!
  ctx.fillStyle = "#808080"
  ctx.fillRect(0, 0, size, size)
  for (let i = 0; i < size; i += 4) {
    ctx.fillStyle = "rgba(255, 255, 255, 0.34)"
    ctx.fillRect(0, i, size, 2)
    ctx.fillStyle = "rgba(0, 0, 0, 0.3)"
    ctx.fillRect(i, 0, 2, size)
  }
  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  weave = texture
  return texture
}

export type PlaymatKnobs = { unroll: Unroll; cloth: boolean; blend: Blend; strength: number; desaturate: number; duration: number }

export function PlaymatScene({ unroll, cloth, blend, strength, desaturate, duration, onUnrolled }: PlaymatKnobs & { onUnrolled: () => void }) {
  // The same cloth for the same knobs, so that nothing is made again but what changed
  const laid = useMemo(() => (cloth ? { picture: clothPicture(), blend, strength } : undefined), [cloth, blend, strength])
  return (
    <Stage id="scene-playmat" camera={CAMERA} playIntro={false} surface={TABLE}>
      <Playmat size={{ width: WIDTH, depth: DEPTH }} picture={matPicture()} cloth={laid} desaturate={desaturate} unroll={unroll} duration={duration} roller="#1d555b" onUnrolled={onUnrolled} />
      <RestingCards />
    </Stage>
  )
}
