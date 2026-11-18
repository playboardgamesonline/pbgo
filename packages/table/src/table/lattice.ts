import { CanvasTexture, LinearMipmapLinearFilter, RepeatWrapping, SRGBColorSpace } from "three"
import { latticeLines } from "./mat-field"

export type LatticeOptions = {
  /** `#rrggbb`: the colour of the mat, which the lines are drawn on (the picture is opaque, to give to `Surface` as its `map`, with this colour as its `color`) */
  base: string
  /** `#rrggbb`: the colour of the lines, a little off the mat's own */
  line: string
  /** Diamonds across one repeat of the picture (default 3) */
  diamonds?: number
  /** Width of a line, in pixels of the square (default 2) */
  width?: number
  /** Pixels across the square picture, a power of two (default 256) */
  size?: number
}

/**
 * A diamond lattice painted on a small canvas, in code: thin lines that cross at an angle over the colour of a mat, as a printed playing mat has, with no grain and no noise. It repeats with no seam over the whole table (`tile` of the `Surface`: how many world units one repeat covers),
 * and it costs a phone nothing. Give it to `Surface` as `map`, with the mat's colour as `color`. Keep the lines close to the colour of the mat: a lattice that is seen is too loud for a table.
 */
export function latticeTexture({ base, line, diamonds = 3, width = 2, size = 256 }: LatticeOptions): CanvasTexture {
  const canvas = document.createElement("canvas")
  canvas.width = canvas.height = size
  const ctx = canvas.getContext("2d")!
  ctx.fillStyle = base
  ctx.fillRect(0, 0, size, size)
  ctx.strokeStyle = line
  ctx.lineWidth = width
  for (const { from, to } of latticeLines(size, diamonds)) {
    ctx.beginPath()
    ctx.moveTo(from[0], from[1])
    ctx.lineTo(to[0], to[1])
    ctx.stroke()
  }
  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  texture.wrapS = texture.wrapT = RepeatWrapping
  texture.minFilter = LinearMipmapLinearFilter
  texture.anisotropy = 4
  return texture
}
