// The transitions of the table that the playground can trigger and show: a card dealt from the pile to the hand, a card turned over, a piece moved between cells, a card played, a card discarded, the cards passed between seats. Each is a change of the state that
// makes the table's own blocks move: a card that appears with a `from` flies in, a card that changes zone glides from where it was (the pose memory), a piece whose cell changes walks there. Nothing here animates: it changes the state and the blocks do the rest.

import type { PlayPart, PlayState } from "../defaults"
import { deal, dealRound, discardOne, flip, movePiece, passCards, playFromHand, say, showParts } from "./state"

export const TRANSITION_IDS = ["deal", "flip", "move", "playCard", "discard", "pass", "round"] as const
export type TransitionId = (typeof TRANSITION_IDS)[number]

export type Transition = {
  id: TransitionId
  label: string
  /** What it shows, in a line */
  hint: string
  /** The key of the shortcut, for the button to write */
  key: string
  /** The parts of the table it needs: it switches on those that are off */
  needs: readonly PlayPart[]
  run: (state: PlayState) => PlayState
  /** The block of the table it shows, for the docs */
  block: string
}

export const TRANSITIONS: Record<TransitionId, Transition> = {
  deal: { id: "deal", label: "Deal a card", hint: "From the draw pile to the hand: a card flies in.", key: "D", needs: ["piles", "hand"], run: deal, block: "Card `from`, Zone" },
  flip: { id: "flip", label: "Flip a card", hint: "The picked card, or the first on the table, turns over.", key: "F", needs: [], run: flip, block: "Card pose, flight and fold" },
  move: { id: "move", label: "Move a piece", hint: "A pawn hops to the next free cell of the board.", key: "M", needs: ["board"], run: movePiece, block: "Piece, Board" },
  playCard: { id: "playCard", label: "Play a card", hint: "From the hand onto the table.", key: "H", needs: ["hand"], run: playFromHand, block: "Zone, pose memory" },
  discard: { id: "discard", label: "Discard", hint: "From the hand to the discard pile.", key: "X", needs: ["hand", "piles"], run: discardOne, block: "Zone, pose memory" },
  pass: { id: "pass", label: "Pass cards", hint: "One card from each seat to the next, round the table.", key: "T", needs: ["seats", "hand"], run: passCards, block: "Zone, pose memory" },
  round: { id: "round", label: "Deal a round", hint: "One card from the draw pile to every seat.", key: "", needs: ["seats", "piles", "hand"], run: dealRound, block: "Card `from`, Zone `stagger`" },
}

/** Runs a transition: the parts it needs are switched on first, and when it has nothing to move (an empty hand, no piece) the log says so, so that a press is never silent */
export function runTransition(state: PlayState, id: TransitionId): PlayState {
  const transition = TRANSITIONS[id]
  const missing = transition.needs.filter((part) => !state.parts[part])
  const ready = missing.length > 0 ? showParts(state, missing, true) : state
  const done = transition.run(ready)
  return done === ready ? say(ready, `${transition.label}: nothing to move yet`) : done
}
