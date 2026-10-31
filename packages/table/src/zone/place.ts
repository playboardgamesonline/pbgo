import { inFrame, type Spot } from "../layout"
import type { Pose } from "../pose"

/** Seconds between two neighbouring cards that come in from the same place: a hand dealt one card after the other */
export const STAGGER = 0.08

/** Where a card of a zone lies, and where it flies from when it appears */
export type Placement = { target: Pose; from: Pose | null | undefined }

export type PlaceOptions = {
  /** Where the zone lies and which way it faces: the layout is drawn in its frame (default: the table itself) */
  frame?: Spot
  /** The slots of the zone, in its frame */
  layout: Pose[]
  /** Where a card with no `from` of its own comes in from, on the table */
  enter?: Pose
  /** Seconds between two cards of `enter` (default `STAGGER`) */
  stagger?: number
}

/**
 * Where each card of a zone lies, and where it comes from. Card `i` takes slot `i` of the layout, put in the frame; a card with no slot is left out.
 * A `from` of its own wins (and `null` turns the entry flight off); otherwise it comes in from `enter`, a `stagger` after the card before it
 */
export function place(froms: (Pose | null | undefined)[], { frame, layout, enter, stagger = STAGGER }: PlaceOptions): Placement[] {
  const count = Math.min(froms.length, layout.length)
  return Array.from({ length: count }, (_, i) => {
    const own = froms[i]
    return {
      target: frame ? inFrame(frame, layout[i]) : layout[i],
      from: own !== undefined ? own : enter ? { ...enter, delay: (enter.delay ?? 0) + i * stagger } : undefined,
    }
  })
}
