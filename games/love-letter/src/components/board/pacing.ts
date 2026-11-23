import type { CharacterKey, LoveLetterEvent } from "@love-letter/engine"
import type { LogLine } from "@pbgo/core/lib/game-types"
import type { Field } from "@pbgo/table"

/**
 * The pace of a move, in seconds: how long each thing that happened keeps the table busy before the next one begins. A card takes about as long as it needs to land, a reveal as long as it takes to read two faces. The Pace folder of the debug panel edits these
 * (`scene.tsx` binds them with `useSettings`); nothing here moves anything, it only says when.
 */
export const PACE_SETTINGS = {
  /** A card drawn, played, discarded or laid down out of the round, and what is quick: a Handmaid, a card with no effect, the Chancellor's cards, the start of a round, the end of a round and of the game */
  draw: 0.7,
  play: 0.8,
  discard: 0.8,
  out: 0.7,
  protect: 0.4,
  chancellor: 0.7,
  bottom: 0.6,
  fizzled: 0.5,
  round: 0.4,
  end: 0.5,
  over: 0.3,
  /** What is shown to be read: a Guard's guess and its answer, a Priest's look, a Baron's comparison and a King's trade, the hands laid down when the deck runs out */
  guess: 2.4,
  look: 2.6,
  compare: 3,
  swap: 3,
  reveal: 1.4,
  /** How long a card needs to land once it has set out: a move is over when the last card has landed */
  landing: 0.85,
}

export const PACE_FIELDS: Record<keyof typeof PACE_SETTINGS, Field> = {
  draw: ["card drawn (s)", 0, 2, 0.01],
  play: ["card played (s)", 0, 2, 0.01],
  discard: ["card discarded (s)", 0, 2, 0.01],
  out: ["laid down, out (s)", 0, 2, 0.01],
  protect: ["handmaid (s)", 0, 2, 0.01],
  chancellor: ["chancellor draws (s)", 0, 2, 0.01],
  bottom: ["cards put back (s)", 0, 2, 0.01],
  fizzled: ["no effect (s)", 0, 2, 0.01],
  round: ["start of a round (s)", 0, 2, 0.01],
  end: ["end of a round (s)", 0, 2, 0.01],
  over: ["end of the game (s)", 0, 2, 0.01],
  guess: ["guess shown (s)", 0.5, 6, 0.05],
  look: ["priest look shown (s)", 0.5, 6, 0.05],
  compare: ["baron comparison shown (s)", 0.5, 6, 0.05],
  swap: ["king trade shown (s)", 0.5, 6, 0.05],
  reveal: ["hands laid down (s)", 0, 4, 0.05],
  landing: ["a card lands in (s)", 0.2, 2, 0.01],
}

/** How long each thing that happened keeps the table busy, in seconds */
function beatOf(event: LoveLetterEvent): number {
  const P = PACE_SETTINGS
  switch (event.kind) {
    case "draw":
      return P.draw
    case "play":
      return P.play
    case "discard":
      return P.discard
    case "out":
      return P.out
    case "protect":
      return P.protect
    case "chancellor":
      return P.chancellor
    case "bottom":
      return P.bottom
    case "fizzled":
      return P.fizzled
    case "round":
      return P.round
    case "end":
      return P.end
    case "over":
      return P.over
    case "guess":
      return P.guess
    case "look":
      return P.look
    case "compare":
      return P.compare
    case "swap":
      return P.swap
    case "reveal":
      return P.reveal
  }
}

/** Where a card that came in during the last move comes in from: the deck (a card drawn) or the hand of the player who played, discarded or laid it down (`by`) */
export type Arrival = { from: "deck" | "hand"; by: string; delay: number }

/**
 * A reveal of the last move, to read: the faces of the cards it is about, in the order they are laid out (a card the viewer was not told is `null`: a back), when it begins and how long it stays, the event it tells and whose hand each card comes out of
 * (`owners`, by player). A Guard's guess is public, one face: the character it named; a Priest's look is one card, the target's; a Baron's comparison and a King's trade are two, the player's and the target's.
 */
export type Reveal = { kind: "guess" | "look" | "compare" | "swap"; at: number; duration: number; cards: (CharacterKey | null)[]; owners: (string | null)[]; event: LoveLetterEvent }

export type Timeline = {
  /** The greatest version of the log, the move that was played last (0 for an empty log) */
  v: number
  /** Where each card that came in with that move comes in from, and when, by card id */
  entrances: Map<number, Arrival>
  /** What the move shows to be read, in order */
  reveals: Reveal[]
  /** Seconds until that move has played out: the last card has landed, the last thing has had its time */
  settle: number
}

/**
 * When each thing of the last move happens, from the lines of the log (`useGameLog`): the log says what happened and in what order, the board decides how long each takes. The view is drawn at once and is what is there; this is what the board waits with: the
 * cards come in one after the other, the reveals are read, and the words that say how the move ended wait for it to end. With `instant` (the visitor asks for less motion) nothing waits and nothing is shown.
 */
export function timelineOf(lines: readonly LogLine<LoveLetterEvent>[], instant = false): Timeline {
  const v = lines.reduce((greatest, line) => Math.max(greatest, line.v), 0)
  const timeline: Timeline = { v, entrances: new Map(), reveals: [], settle: 0 }
  if (instant || v === 0) return timeline
  const P = PACE_SETTINGS
  let at = 0
  let landed = 0
  const arrive = (id: number, from: Arrival["from"], by: string) => {
    timeline.entrances.set(id, { from, by, delay: at })
    landed = Math.max(landed, at + P.landing)
  }
  for (const line of lines) {
    if (line.v !== v) continue
    const { event } = line
    switch (event.kind) {
      case "draw":
        landed = Math.max(landed, at + P.landing)
        if (event.card) arrive(event.card.id, "deck", event.by)
        break
      case "play":
        arrive(event.card.id, "hand", event.by)
        break
      case "discard":
        arrive(event.card.id, "hand", event.player)
        break
      case "out":
        for (const card of event.cards) arrive(card.id, "hand", event.player)
        break
      case "guess":
        timeline.reveals.push({ kind: "guess", at, duration: P.guess, cards: [event.guess], owners: [null], event })
        break
      case "look":
        timeline.reveals.push({ kind: "look", at, duration: P.look, cards: [event.card ?? null], owners: [event.target], event })
        break
      case "compare":
      case "swap":
        timeline.reveals.push({ kind: event.kind, at, duration: event.kind === "compare" ? P.compare : P.swap, cards: [event.cards?.by ?? null, event.cards?.target ?? null], owners: [event.by, event.target], event })
        break
      default:
        break
    }
    at += beatOf(event)
  }
  timeline.settle = Math.max(at, landed)
  return timeline
}
