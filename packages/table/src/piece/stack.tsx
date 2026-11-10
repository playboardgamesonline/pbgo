"use client"

import { useMemo } from "react"
import { hashRandom } from "../pose"
import { type PieceModel, pieceModel } from "./models"
import { Piece, type PieceProps } from "./piece"
import { PIECE_SIZE } from "./settings"

export type StackProps = Omit<PieceProps, "id" | "y" | "children" | "from" | "halo"> & {
  /** Names the stack: its pieces are named after it, so a piece that leaves the stack and appears in another place under the same name flies from where it was */
  id: string
  /** How many pieces are in the stack, whole. A stack shows up to `cap` of them */
  count: number
  /** The most pieces drawn (default 12): a stack of a hundred coins is a tall stack of a dozen, not a hundred meshes */
  cap?: number
  /** A ring round the top piece, in this colour: the stack can be chosen */
  halo?: string | null
}

/**
 * A stack of the same piece, one on the other: a supply of coins, of gems, of cubes. It draws `count` pieces (up to `cap`), each a little askew the same way every time, and a piece that joins or leaves appears and disappears at the top. The
 * count belongs to the game's state; drawing a number next to a tall stack is the game's (`TableText`).
 */
export function Stack({ id, count, cap = 12, model: shape = "disc", size = PIECE_SIZE, at, halo = null, ...rest }: StackProps) {
  const model: PieceModel = useMemo(() => (typeof shape === "string" ? pieceModel(shape) : shape), [shape])
  const shown = Math.max(0, Math.min(Math.floor(count), cap))
  return (
    <>
      {Array.from({ length: shown }, (_, i) => {
        const key = `${id}:${i}`
        return (
          <Piece
            key={key}
            id={key}
            model={model}
            size={size}
            at={{ x: at.x + hashRandom(`${key}:x`) * size * 0.03, z: at.z + hashRandom(`${key}:z`) * size * 0.03, yaw: (at.yaw ?? 0) + hashRandom(`${key}:yaw`) * 0.35 }}
            y={i * model.height * size}
            halo={i === shown - 1 ? halo : null}
            {...rest}
          />
        )
      })}
    </>
  )
}
