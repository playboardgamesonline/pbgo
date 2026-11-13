import { CanvasTexture, LinearMipmapLinearFilter, RepeatWrapping, SRGBColorSpace } from "three"
import { grainField, hexChannels } from "./grain-field"

export type GrainOptions = {
  /** `#rrggbb`: the table's own colour, which the grain is painted into (the picture is opaque, to give to `Surface` as its `map`) */
  base: string
  /** How strong the grain is, 0 to 1 (default 0.5): at 0.5 the finest speckle moves a dark colour by about 6 % of the range, which is seen up close and never reads as noise from the camera's distance */
  strength?: number
  /** Pixels across the square picture, a power of two (default 256) */
  size?: number
  /** Another grain: the same seed always paints the same picture */
  seed?: number
}

/**
 * A seamless felt-like grain painted on a small canvas, in code: a fine speckle and a slow mottling that repeat over the whole table (`tile` of the `Surface`: how many world units one repeat covers). One 256-pixel square is a quarter of a megabyte on the
 * card, so it costs a phone nothing, and a table made of it needs no picture in the repository. The picture is the same for the same options, on every client. It is the table's colour with the grain in it, so give it to `Surface` as `map` with that colour as `color`.
 * A pool of light or a mat over it should add to it (additive blending), not cover it, so that the grain shows through everywhere alike.
 */
export function grainTexture({ base, strength = 0.5, size = 256, seed = 7 }: GrainOptions): CanvasTexture {
  const canvas = document.createElement("canvas")
  canvas.width = canvas.height = size
  const ctx = canvas.getContext("2d")!
  const image = ctx.createImageData(size, size)
  const field = grainField(size, seed)
  const [r, g, b] = hexChannels(base)
  for (let i = 0; i < size * size; i++) {
    // the colour moved up or down by the grain, in a share of the whole range
    const shift = field[i]! * strength * 255 * 0.5
    const o = i * 4
    image.data[o] = r + shift
    image.data[o + 1] = g + shift
    image.data[o + 2] = b + shift
    image.data[o + 3] = 255
  }
  ctx.putImageData(image, 0, 0)
  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  texture.wrapS = texture.wrapT = RepeatWrapping
  texture.minFilter = LinearMipmapLinearFilter
  texture.anisotropy = 4
  return texture
}
