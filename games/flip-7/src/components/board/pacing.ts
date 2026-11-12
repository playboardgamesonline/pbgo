import type { Flip7Event } from "@flip-7/engine"
import type { LogLine } from "@pbgo/core/lib/game-types"
import type { Field } from "@pbgo/table"

/**
 * The pace of a move, in seconds: how long each thing that happened keeps the table busy before the next one begins. A card turned over takes about as long as it needs to land, so the three cards of a Flip Three come one after the
 * other, and a stay or a bust is quick. The Pace folder of the debug panel edits these (`scene.tsx` binds them with `useSettings`); nothing here moves anything, it only says when.
 */
export const PACE_SETTINGS = {
  /** The opening deal: a card goes out this soon after the one before it, so that the cards go round the table with the first ones still in the air */
  deal: 0.25,
  /** A card turned over by a hit */
  hit: 0.8,
  /** Each of the three cards of a Flip Three: the next is turned over when this one is about to land */
  flip: 0.7,
  /** An action card given to a player: what it makes them do starts when it has arrived */
  play: 0.5,
  /** A bust, a Second Chance that saves, an action card nobody can get, the discard shuffled into a new deck, a stay, a Flip 7, the end of a round and of the game, and the start of a round */
  bust: 0.4,
  saved: 0.5,
  discarded: 0.4,
  reshuffle: 0.8,
  stay: 0.3,
  flip7: 0.5,
  end: 0.3,
  over: 0.3,
  round: 0.15,
  /** How long a card needs to land once it has set out: a move is over when the last card has landed */
  landing: 0.85,
}

export const PACE_FIELDS: Record<keyof typeof PACE_SETTINGS, Field> = {
  deal: ["deal (s)", 0, 1, 0.01],
  hit: ["hit (s)", 0.1, 2, 0.01],
  flip: ["flip (s)", 0.1, 2, 0.01],
  play: ["action card given (s)", 0, 2, 0.01],
  bust: ["bust (s)", 0, 2, 0.01],
  saved: ["second chance saves (s)", 0, 2, 0.01],
  discarded: ["card discarded (s)", 0, 2, 0.01],
  reshuffle: ["deck reshuffled (s)", 0, 2, 0.01],
  stay: ["stay (s)", 0, 2, 0.01],
  flip7: ["flip 7 (s)", 0, 2, 0.01],
  end: ["end of a round (s)", 0, 2, 0.01],
  over: ["end of the game (s)", 0, 2, 0.01],
  round: ["start of a round (s)", 0, 1, 0.01],
  landing: ["a card lands in (s)", 0.2, 2, 0.01],
}

/** How long each thing that happened keeps the table busy, in seconds */
function beatOf(event: Flip7Event): number {
  const P = PACE_SETTINGS
  switch (event.kind) {
    case "draw":
      return event.how === "deal" ? P.deal : event.how === "hit" ? P.hit : P.flip
    case "play":
      return P.play
    case "bust":
      return P.bust
    case "saved":
      return P.saved
    case "discarded":
      return P.discarded
    case "reshuffle":
      return P.reshuffle
    case "stay":
      return P.stay
    case "flip7":
      return P.flip7
    case "end":
      return P.end
    case "over":
      return P.over
    case "round":
      return P.round
  }
}

export type Timeline = {
  /** The greatest version of the log, the move that was played last (0 for an empty log) */
  v: number
  /** Seconds that each card that was turned over by that move waits before it comes in, by id: one after the other, in the order the engine said */
  entrances: Map<number, number>
  /** Seconds until that move has played out: the last card has landed and the last thing has had its time */
  settle: number
}

/**
 * When each thing of the last move happens, from the lines of the log (`useGameLog`): the log says what happened and in what order, the board decides how long each takes. The view is drawn at once and is what is there; this is
 * what the board waits with: the cards come in one after the other, and the words that say how the move ended wait for it to end. With `instant` (the visitor asks for less motion) nothing waits.
 */
export function timelineOf(lines: readonly LogLine<Flip7Event>[], instant = false): Timeline {
  const v = lines.reduce((greatest, line) => Math.max(greatest, line.v), 0)
  const entrances = new Map<number, number>()
  if (instant || v === 0) return { v, entrances, settle: 0 }
  let at = 0
  let landed = 0
  for (const line of lines) {
    if (line.v !== v) continue
    const { event } = line
    if (event.kind === "draw") {
      entrances.set(event.card.id, at)
      landed = Math.max(landed, at + PACE_SETTINGS.landing)
    }
    at += beatOf(event)
  }
  return { v, entrances, settle: Math.max(at, landed) }
}
