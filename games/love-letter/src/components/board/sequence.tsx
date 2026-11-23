"use client"

import type { CharacterKey } from "@love-letter/engine"
import { type SequenceStep, useSequence, Zone, type ZoneCard } from "@pbgo/table"
import type { Pose } from "@pbgo/table"
import { revealPoses } from "./layout"
import type { Reveal } from "./pacing"
import { CARD_SIZE, type Faces } from "./textures"

/** What is on the table to be read: the reveal of the move `v` that is shown now, if one is */
type Showing = { v: number; reveal: Reveal | null }
const NOTHING: Showing = { v: 0, reveal: null }

/**
 * The reveal of the last move that is on the table now, if one is: the log says what was shown and to whom, and `timelineOf` when, so the board shows each in its turn for the time it takes to read, and then it is gone. A reveal is for the eyes of the viewer, so it
 * is no part of the table (the view): nothing in the state remembers it. It is a short film of the table kit (`useSequence`), started again when the move changes (`v`), and a reveal of an older move is never shown.
 */
export function useReveal(v: number, reveals: readonly Reveal[]): Reveal | null {
  // shown at its moment, gone when it has been read: two reveals of one move follow each other, the one that ends before the next begins
  const steps = reveals.flatMap((reveal): SequenceStep<Showing>[] => [
    [reveal.at * 1000, { v, reveal }],
    [(reveal.at + reveal.duration) * 1000, { v, reveal: null }],
  ])
  const { state } = useSequence<Showing>({ active: reveals.length > 0, start: NOTHING, final: NOTHING, steps, key: v })
  return state?.v === v ? state.reveal : null
}

export type RevealProps = {
  reveal: Reveal
  faces: Faces
  /** Where a card of a player's hand lies, for the faces that come out of a hand (the Priest's, the Baron's, the King's) */
  originOf: (playerId: string) => Pose
  /** The lens of the screen reads the face under the pointer: told which one, or that the pointer left it */
  onHover: (id: number, type: CharacterKey | null, over: boolean) => void
}

/**
 * A reveal on the table: the faces it is about (a back for a card the viewer was not told) side by side in the middle, over everything. A Priest's look and a Baron's comparison come out of the hands they are about. What happened is not written here: the history of the
 * ticker says it, as it says every move.
 */
export function RevealView({ reveal, faces, originOf, onHover }: RevealProps) {
  const { cards, owners } = reveal
  return (
    <Zone
      layout={revealPoses(cards.length)}
      size={CARD_SIZE}
      cards={cards.map(
        (type, i): ZoneCard => ({
          key: `reveal-${reveal.at}-${i}`,
          front: type ? faces.face(type) : faces.back,
          back: faces.back,
          above: true,
          from: owners[i] ? { ...originOf(owners[i]!), delay: 0 } : undefined,
          onHover: (over) => onHover(-100 - i, type, over),
        }),
      )}
    />
  )
}
