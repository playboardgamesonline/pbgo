"use client"

import type { Texture } from "three"
import type { CardSize } from "../card/geometry"
import { pile, type PileOptions, type Spot } from "../layout"
import type { Pose } from "../pose"
import { Zone, type ZoneCard } from "./zone"

/** The top card of a pile once it is turned up: its front, and whatever else a `Card` takes (glow, onClick...) */
export type PileTop = Partial<Omit<ZoneCard, "key" | "back">>

/** The most cards a pile draws unless told otherwise: a pile of 90 looks no different from one of 24 and costs 66 more cards to draw */
const LIMIT = 24

export type PileProps = Omit<PileOptions, "face" | "topFace"> & {
  /** Where the pile lies on the table (default: the middle) */
  frame?: Spot
  /** How many cards it holds */
  count: number
  /** The size of every card */
  size: CardSize
  /** The back of the cards */
  back: Texture
  /** The top card turned up: give it a `front`. Without one the whole pile lies face down */
  top?: PileTop
  /** The most cards drawn (default 24) */
  limit?: number
  /** Where the cards come in from, on the table, a `stagger` apart (see `Zone`) */
  enter?: Pose
  stagger?: number
}

/**
 * A pile of cards the game only counts: a deck, a discard pile. All face down but the top one, if given a front.
 * Every card is keyed by its height in the pile, so when the top card changes the one below turns face down where it lies: for a pile of cards the game names, use a `Zone` over `pile(n, { face: "up" })`
 */
export function Pile({ frame, count, size, back, top, limit = LIMIT, enter, stagger, ...options }: PileProps) {
  const n = Math.max(0, Math.min(Math.floor(count), limit))
  const layout = pile(n, { ...options, face: "down", topFace: top?.front ? "up" : "down" })
  const cards: ZoneCard[] = Array.from({ length: n }, (_, i) =>
    i === n - 1 ? { ...top, key: `pile-${i}`, front: top?.front ?? back, back } : { key: `pile-${i}`, front: back, back },
  )
  return <Zone frame={frame} layout={layout} size={size} enter={enter} stagger={stagger} cards={cards} />
}
