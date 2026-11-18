"use client"

import { CanvasTexture, SRGBColorSpace, type Texture } from "three"

const mats = new Map<string, Texture>()

const channels = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))

/** A number between 0 and 1 for each whole number, the same on every client: a hash, not `Math.random` */
const unit = (n: number) => {
  let h = Math.imul(n ^ (n >>> 16), 0x45d9f3b)
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}

/**
 * A colour level rounded up or down by chance, in proportion to what it has after the point (12.3 is 13 three times in ten): the levels of a gradient that is painted in 8 bits then step by a level here and there instead of all along a line, and
 * the gradient shows no bands. The change is of one level, 0.4 % of the range, which no eye sees as a grain.
 */
export const dithered = (level: number, index: number) => Math.floor(level + unit(index))

/** How much of its light the pool has at a share `t` of its radius, from the middle (0) to the edge (1): all of it in the middle, easing away to nothing at the edge, with no flat part and no knee, so the pool has no rim to be seen */
export const poolLight = (t: number) => {
  const c = Math.min(1, Math.max(0, t))
  return 1 - c * c * (3 - 2 * c)
}

/**
 * The pool of light the table is lit by, painted once for a pair of colours: how much lighter `inner` is than `outer`, in the middle, falling away to nothing at the edge, to be ADDED to the table (additive blending): `outer` is the colour of the endless
 * table, so the pool is `inner` in the middle and the table's own colour at its edge, with no line between the two (`poolLight`). Both come from the game's settings (`surface` and `surfaceDark`), so changing them in the gamemaster changes the mat.
 */
export function matTexture(inner: string, outer: string): Texture {
  const id = `${inner}|${outer}`
  const kept = mats.get(id)
  if (kept) return kept
  const size = 512
  const canvas = document.createElement("canvas")
  canvas.width = canvas.height = size
  const ctx = canvas.getContext("2d")!
  const [r, g, b] = channels(inner).map((value, i) => Math.max(0, value - channels(outer)[i]!))
  const image = ctx.createImageData(size, size)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const light = poolLight(Math.hypot(x + 0.5 - size / 2, y + 0.5 - size / 2) / (size / 2))
      const o = (y * size + x) * 4
      image.data[o] = dithered(r * light, o)
      image.data[o + 1] = dithered(g * light, o + 1)
      image.data[o + 2] = dithered(b * light, o + 2)
      image.data[o + 3] = 255
    }
  }
  ctx.putImageData(image, 0, 0)
  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  mats.set(id, texture)
  return texture
}
