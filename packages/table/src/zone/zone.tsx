"use client"

import type { Key } from "react"
import { Card, type CardProps } from "../card/card"
import type { CardSize } from "../card/geometry"
import type { Spot } from "../layout"
import type { Pose } from "../pose"
import { place } from "./place"

/** A card of a zone: whatever a `Card` takes but its `target` (the zone gives it a slot) and its `size` (the zone's), and the `key` that tells it apart from the others */
export type ZoneCard = Omit<CardProps, "target" | "size"> & { key: Key }

export type ZoneProps = {
  /** Where the zone lies on the table and which way it faces; the layout is drawn in its frame (default: the table itself) */
  frame?: Spot
  /** The slots, one pose per card, in the frame of the zone: `fan`, `row`, `pile`, `grid` or the game's own. Card `i` takes slot `i`; a card with no slot is not drawn */
  layout: Pose[]
  /** The size of every card of the zone */
  size: CardSize
  /** Where a card with no `from` of its own comes in from, on the table (not in the frame): the deck a hand is dealt from */
  enter?: Pose
  /** Seconds between two cards coming in from `enter`, counted from the first card of the zone: a card that joins later waits for its place in the list (default 0.08; 0 sends them together) */
  stagger?: number
  /** The cards, in the order of the slots. A card keeps its key from one render to the next, so it glides from slot to slot instead of flying in again */
  cards: ZoneCard[]
}

/**
 * Some cards on the table in a layout: the first takes the first slot, the second the second, and so on, all drawn in the frame of the zone.
 * A zone only places cards, it owns no state: the game decides which cards are in it and in what order, and a card that changes zone is the same `key` (and `id`) in another one
 */
export function Zone({ frame, layout, size, enter, stagger, cards }: ZoneProps) {
  const placed = place(
    cards.map((card) => card.from),
    { frame, layout, enter, stagger },
  )
  return (
    <>
      {placed.map(({ target, from }, i) => {
        const { key, ...card } = cards[i]
        return <Card key={key} {...card} target={target} from={from} size={size} />
      })}
    </>
  )
}
