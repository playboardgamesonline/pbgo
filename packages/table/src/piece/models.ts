import type { BufferGeometry } from "three"
import { CHAMFER } from "../die/geometry"
import { cubeGeometry, PAWN_HEIGHT, pawnGeometry, prismGeometry, sphereGeometry } from "./geometry"
import { type Outline, reach as reachOf, regularOutline, roundedOutline } from "./outline"

/**
 * A piece's shape: how tall it is, how wide a circle it fits in, whether it has two flat faces that can carry a picture and be turned over, and how it is drawn. Everything is at the unit size, where the piece is one unit wide, and a `Piece` multiplies
 * it by its `size`. A game gives the model of a piece of its own, a silhouette (`makeFlatPiece`) or a solid it modelled (`makePiece`), and the pieces of the package are in `pieceModel`.
 */
export type PieceModel = {
  name: string
  /** How tall the piece is, from its base on the table to its top */
  height: number
  /** The radius of the circle the piece fits in on the table, from its middle: what a ring round it, and its shadow, are as wide as */
  reach: number
  /** The piece has two flat faces, a top and a bottom, which can wear a picture each and be turned over: a coin, a tile, a token. Its material groups are 0 for the edge, 1 for the top and 2 for the bottom. Any other piece has one material */
  flat: boolean
  /** The drawn piece at a size, standing on the table with its base at y = 0 and its middle on the vertical axis, with the `color` attribute that it rewrites as it turns */
  geometry: (size: number) => BufferGeometry
}

/** The pieces the package knows how to make */
export const PIECE_SHAPES = ["disc", "square", "hex", "cube", "sphere", "pawn"] as const
export type PieceShape = (typeof PIECE_SHAPES)[number]

/** A piece whose shape is a solid of the game's own: its geometry at a size, how tall it is and how wide, one material for all of it unless it is `flat` */
export function makePiece(input: { name: string; height: number; reach: number; flat?: boolean; geometry: (size: number) => BufferGeometry }): PieceModel {
  return { name: input.name, height: input.height, reach: input.reach, flat: input.flat ?? false, geometry: input.geometry }
}

/** A flat piece with the silhouette of `outline` (a disc, a tile, a meeple, a standee), `height` thick at the unit size. It has a top and a bottom that can wear a picture each, and turns over */
export function makeFlatPiece({ name, outline, height = 0.12 }: { name: string; outline: Outline; height?: number }): PieceModel {
  return { name, height, reach: reachOf(outline), flat: true, geometry: (size) => prismGeometry(outline, height, size) }
}

const flat = (name: string, outline: Outline, height: number) => makeFlatPiece({ name, outline, height })

const BUILDERS: Record<PieceShape, () => PieceModel> = {
  disc: () => flat("disc", regularOutline(64), 0.14),
  square: () => flat("square", roundedOutline(regularOutline(4, Math.PI / 4), 0.07), 0.12),
  hex: () => flat("hex", roundedOutline(regularOutline(6), 0.04), 0.12),
  // The corners of the cube are cut, so the farthest point of its base is a corner of the cut
  cube: () => makePiece({ name: "cube", height: 1, reach: Math.hypot(0.5, 0.5 - CHAMFER), geometry: cubeGeometry }),
  sphere: () => makePiece({ name: "sphere", height: 1, reach: 0.5, geometry: sphereGeometry }),
  pawn: () => makePiece({ name: "pawn", height: PAWN_HEIGHT, reach: 0.5, geometry: pawnGeometry }),
}

const made = new Map<PieceShape, PieceModel>()

/** The model of one of the pieces of the package, made the first time it is asked for, then kept */
export function pieceModel(shape: PieceShape): PieceModel {
  let model = made.get(shape)
  if (!model) {
    model = BUILDERS[shape]()
    made.set(shape, model)
  }
  return model
}
