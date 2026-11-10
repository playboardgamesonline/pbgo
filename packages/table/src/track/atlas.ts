import type { Space } from "./path"

/** The size of a plate, a space of a track as it is drawn: how wide it is along its own x and how deep along its own z, in world units */
export type PlateSize = { width: number; depth: number }

/**
 * The plate of a space when the game does not say: a little under the distance to the nearest neighbour along the track, so that two plates never touch. A track of one space, or whose spaces are all in one place, has plates of one unit.
 */
export function plateSize(spaces: readonly Space[]): PlateSize {
  let nearest = Number.POSITIVE_INFINITY
  for (let i = 0; i + 1 < spaces.length; i++) {
    const gap = Math.hypot(spaces[i + 1]!.x - spaces[i]!.x, spaces[i + 1]!.z - spaces[i]!.z)
    if (gap > 1e-9) nearest = Math.min(nearest, gap)
  }
  const side = Number.isFinite(nearest) ? nearest * 0.86 : 1
  return { width: side, depth: side }
}

/** The most pixels a side of the picture of a track may have: a texture that every device can hold */
export const ATLAS_LIMIT = 4096
/** Pixels a plate has for each world unit of its side: its label is read at the size the writing of a card is */
export const PX_PER_UNIT = 160
/** The most pixels across a plate, however big it is drawn */
const CELL_LIMIT = 256

/** How the plates of a track are laid in one picture: a grid of cells, one for each space in the order of the track, row by row */
export type Atlas = { columns: number; rows: number; cellWidth: number; cellHeight: number; width: number; height: number }

/** The picture that holds `count` plates of the size `plate`: as square as the count allows, each plate with the pixels it needs, and the whole picture within `ATLAS_LIMIT` */
export function atlasOf(count: number, plate: PlateSize): Atlas {
  const columns = Math.max(1, Math.ceil(Math.sqrt(count)))
  const rows = Math.max(1, Math.ceil(count / columns))
  const scale = Math.min(PX_PER_UNIT, CELL_LIMIT / Math.max(plate.width, plate.depth), ATLAS_LIMIT / (columns * plate.width), ATLAS_LIMIT / (rows * plate.depth))
  const cellWidth = Math.max(1, Math.floor(plate.width * scale))
  const cellHeight = Math.max(1, Math.floor(plate.depth * scale))
  return { columns, rows, cellWidth, cellHeight, width: columns * cellWidth, height: rows * cellHeight }
}

/** A rectangle of a texture: `u` runs from the left to the right and `v` from the bottom (0) to the top (1), as in three.js, where a canvas has its top at 1 */
export type Rect = { u0: number; v0: number; u1: number; v1: number }

/** Where the cell of space `index` is in the texture of the atlas */
export function cellRect(index: number, atlas: Atlas): Rect {
  const column = index % atlas.columns
  const row = Math.floor(index / atlas.columns)
  return {
    u0: (column * atlas.cellWidth) / atlas.width,
    u1: ((column + 1) * atlas.cellWidth) / atlas.width,
    v1: 1 - (row * atlas.cellHeight) / atlas.height,
    v0: 1 - ((row + 1) * atlas.cellHeight) / atlas.height,
  }
}

/** The whole of a texture: what a plate that wears one picture shows */
export const WHOLE: Rect = { u0: 0, v0: 0, u1: 1, v1: 1 }

/** The corners of the plates of a track as one mesh: four vertices for each plate, two triangles each, lying flat and facing the sky */
export type Quads = { positions: Float32Array; uvs: Float32Array; indices: Uint32Array }

export type QuadOptions = {
  /** How high above the table the plates lie */
  height: number
  /** The plates face the viewer whichever way their space faces, so a label always reads upright; otherwise a plate turns with its space */
  upright: boolean
  /** The plates are drawn this many times bigger than their size, about their middle (default 1): the ring round a space that can be chosen */
  grow?: number
  /** The part of the texture that plate `i` wears */
  rect: (index: number) => Rect
}

/** The mesh of `spaces` drawn as plates of the size `plate`. The corners of a plate go far-left, far-right, near-right, near-left, as its picture is read, and the triangles run counterclockwise seen from above */
export function quadsOf(spaces: readonly Space[], plate: PlateSize, { height, upright, grow = 1, rect }: QuadOptions): Quads {
  const positions = new Float32Array(spaces.length * 12)
  const uvs = new Float32Array(spaces.length * 8)
  const indices = new Uint32Array(spaces.length * 6)
  const [halfWidth, halfDepth] = [(plate.width * grow) / 2, (plate.depth * grow) / 2]
  spaces.forEach((space, i) => {
    const turn = upright ? 0 : space.yaw
    const [cos, sin] = [Math.cos(turn), Math.sin(turn)]
    const { u0, v0, u1, v1 } = rect(i)
    const corners = [
      [-halfWidth, -halfDepth, u0, v1],
      [halfWidth, -halfDepth, u1, v1],
      [halfWidth, halfDepth, u1, v0],
      [-halfWidth, halfDepth, u0, v0],
    ] as const
    corners.forEach(([x, z, u, v], k) => {
      const vertex = i * 4 + k
      positions.set([space.x + x * cos + z * sin, height, space.z - x * sin + z * cos], vertex * 3)
      uvs.set([u, v], vertex * 2)
    })
    indices.set([i * 4, i * 4 + 3, i * 4 + 2, i * 4, i * 4 + 2, i * 4 + 1], i * 6)
  })
  return { positions, uvs, indices }
}

/** The space a triangle of the mesh of `quadsOf` belongs to, from the `faceIndex` of a ray that hit it: two triangles for each plate. -1 for a hit that says nothing */
export function spaceOfFace(faceIndex: number | null | undefined): number {
  return faceIndex === undefined || faceIndex === null || !Number.isInteger(faceIndex) || faceIndex < 0 ? -1 : Math.floor(faceIndex / 2)
}

/** The size of letters that makes `text` fit in `width`: `size` when it fits, smaller when it does not, never under `floor` times `size`. `measure` says how wide a text is at a size, as the canvas does */
export function fitSize(text: string, size: number, width: number, measure: (text: string, size: number) => number, floor = 0.45): number {
  const wide = measure(text, size)
  return wide <= width || wide <= 0 ? size : Math.max(size * floor, (size * width) / wide)
}
