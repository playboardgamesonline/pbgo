import type { CardFace, SkyjoEvent } from "@skyjo/engine"
import type { LogLine } from "@pbgo/core/lib/game-types"
import { type Pace, paceOf } from "@pbgo/core/lib/move-pace"
import type { Field } from "@pbgo/table"

/**
 * The pace of a move, in seconds: how long each thing that happened keeps the table busy before the next one begins. A card turned over takes about as long as it needs to land, so the card in hand arrives before it is placed, and the discarded
 * column flies after the move that made it. The Pace folder of the debug panel edits these (`scene.tsx` binds them with `useSettings`); nothing here moves anything, it only says when.
 */
export const PACE_SETTINGS = {
  /** The deal of a round: a card goes out this soon after the one before it, so that the cards go round the table with the first ones still in the air. A table of eight is dealt 96 cards: the whole deal never takes more than `dealTotal` */
  deal: 0.05,
  dealTotal: 2.4,
  /** A card turned over where it lies */
  reveal: 0.5,
  /** The top of the discard taken, a card drawn from the pile into the hand */
  take: 0.6,
  draw: 0.7,
  /** The card in hand put in a cell (and the card it replaces going to the discard), or thrown away */
  place: 0.8,
  discard: 0.6,
  /**
   * A column of three equal cards thrown away is one motion in four parts: the three cards wait where they lie, so that the eye reads the column (`columnHold`), slide together into a stack (`columnGather`), the stack flies to the discard and lands on it (`columnTravel`),
   * and the columns left slide together to close the gap and stay centred (`columnClose`, which begins `columnCloseAt` after the stack has set out). The count of a round can throw away several, one after the other: all the columns of a move take `columns` seconds at the most,
   * past that each is played faster.
   */
  columnHold: 0.3,
  columnGather: 0.45,
  columnTravel: 0.85,
  columnCloseAt: 0.4,
  columnClose: 0.5,
  columns: 5,
  /** The start of the round, the last turn, the discard shuffled into a new pile, the count of a round, the end of the game, the start of a round */
  start: 0.3,
  last: 0.4,
  reshuffle: 0.8,
  end: 0.8,
  over: 0.3,
  round: 0.15,
  /** How long a card needs to land once it has set out: a move is over when the last card has landed */
  landing: 0.85,
}

export const PACE_FIELDS: Record<keyof typeof PACE_SETTINGS, Field> = {
  deal: ["deal, per card (s)", 0, 0.3, 0.01],
  dealTotal: ["deal, at the most (s)", 0.5, 6, 0.1],
  reveal: ["card turned over (s)", 0.1, 2, 0.01],
  take: ["discard taken (s)", 0.1, 2, 0.01],
  draw: ["card drawn (s)", 0.1, 2, 0.01],
  place: ["card placed (s)", 0.1, 2, 0.01],
  discard: ["card thrown away (s)", 0.1, 2, 0.01],
  columnHold: ["column read before it goes (s)", 0, 1.5, 0.01],
  columnGather: ["column gathered in a stack (s)", 0.1, 2, 0.01],
  columnTravel: ["stack flies to the discard (s)", 0.2, 2, 0.01],
  columnCloseAt: ["gap closes, after the stack sets out (s)", 0, 2, 0.01],
  columnClose: ["gap closes in (s)", 0.1, 2, 0.01],
  columns: ["all the columns of a move, at the most (s)", 1, 12, 0.1],
  start: ["start of the turns (s)", 0, 2, 0.01],
  last: ["last turn (s)", 0, 2, 0.01],
  reshuffle: ["pile reshuffled (s)", 0, 2, 0.01],
  end: ["round counted (s)", 0, 2, 0.01],
  over: ["end of the game (s)", 0, 2, 0.01],
  round: ["start of a round (s)", 0, 1, 0.01],
  landing: ["a card lands in (s)", 0.2, 2, 0.01],
}

/** Where a card flies in from: the draw pile, the discard, the card in hand, or a cell of a grid (face up or down, as it lay) */
export type Origin = { kind: "deck" } | { kind: "discard" } | { kind: "held" } | { kind: "cell"; player: string; position: number; up: boolean }

export type Entrance = { origin: Origin; delay: number }

/** The key of what comes in: a cell of a grid, a card on the discard (by its id), or the card in hand */
export const cellKey = (player: string, position: number) => `cell:${player}:${position}`
export const cardKey = (id: number) => `card:${id}`
export const HELD_KEY = "held"

/** How long each thing that happened keeps the table busy, in seconds. A column thrown away takes its whole motion (`removalTiming`), which depends on how many the move throws away */
function beatOf(event: SkyjoEvent, removal: RemovalTiming): number {
  const P = PACE_SETTINGS
  switch (event.kind) {
    case "reveal":
      return P.reveal
    case "take":
      return P.take
    case "draw":
      return P.draw
    case "place":
      return P.place
    case "discard":
      return P.discard
    case "column":
      return removal.total
    case "start":
      return P.start
    case "last":
      return P.last
    case "reshuffle":
      return P.reshuffle
    case "end":
      return P.end
    case "over":
      return P.over
    case "round":
      return P.round
  }
}

/** The parts of the motion of a column thrown away, in seconds from the moment it begins (`PACE_SETTINGS`, each column played faster when a move throws away several) */
export type RemovalTiming = {
  /** The three cards wait where they lie, so that the column is read */
  hold: number
  /** They slide together into a stack */
  gather: number
  /** The stack flies to the discard and lands on it */
  travel: number
  /** The columns left begin to close the gap this long after the stack has set out, and take `close` to do it */
  closeAt: number
  close: number
  /** The whole motion: nothing else of the move begins before it is over, and the next column does not begin before it */
  total: number
}

/**
 * The motion of one column thrown away when a move throws away `count` of them (the count of a round throws away one for every triple of every grid, one after the other): the times of `PACE_SETTINGS`, all together at the most `columns` seconds, so each is
 * played faster than that when there are many. The stack has set out for `travel` seconds, or the gap has closed, whichever is the later, when the column is over.
 */
export function removalTiming(count = 1): RemovalTiming {
  const P = PACE_SETTINGS
  const full = P.columnHold + P.columnGather + Math.max(P.columnTravel, P.columnCloseAt + P.columnClose)
  const fit = Math.min(1, P.columns / (Math.max(1, count) * full))
  return {
    hold: P.columnHold * fit,
    gather: P.columnGather * fit,
    travel: P.columnTravel * fit,
    closeAt: P.columnCloseAt * fit,
    close: P.columnClose * fit,
    total: full * fit,
  }
}

/** A column of three equal cards thrown away in the last move, and the second of the move it begins at: the cards are the three of the column, the first being the top of the discard once they have landed */
export type Removal = { player: string; column: number; cards: CardFace[]; at: number; timing: RemovalTiming }

export type Timeline = Pace & {
  /** Where what the last move brought comes from, and the seconds it waits before it sets out, by key (`cellKey`, `cardKey`, `HELD_KEY`) */
  entrances: Map<string, Entrance>
  /** The columns the last move threw away, in the order they went and when each begins: each is one motion (`removalTiming`), played one after the other */
  removals: Removal[]
  /** The card that a placement put on the discard in the move that threw a column away, which the columns land on: null when there is none */
  replaced: CardFace | null
}

/**
 * When each thing of the last move happens, from the lines of the log (`useGameLog`): the log says what happened and in what order, the board decides how long each takes (`paceOf`). The view is drawn at once and is what is there; this is what the board waits with:
 * the cards come in one after the other, the columns thrown away go one after the other, and the words that say how the move ended wait for it to end. `players` are the ids in seat order, for the cells of a deal. With `instant` (the visitor asks for less motion)
 * nothing waits.
 */
export function timelineOf(lines: readonly LogLine<SkyjoEvent>[], players: readonly string[], instant = false): Timeline {
  const entrances = new Map<string, Entrance>()
  const removals: Removal[] = []
  let replaced: CardFace | null = null
  const P = PACE_SETTINGS
  const latest = lines.reduce((greatest, line) => Math.max(greatest, line.v), 0)
  const timing = removalTiming(lines.filter((line) => line.v === latest && line.event.kind === "column").length)
  const pace = paceOf(lines, { beat: (event) => beatOf(event, timing), landing: P.landing, instant }, (event, cursor) => {
    const come = (key: string, origin: Origin, delay = cursor.at) => void entrances.set(key, { origin, delay: cursor.land(delay) })
    switch (event.kind) {
      case "reveal":
        // the card turns over where it lies: it comes in from its own cell, face down
        come(cellKey(event.by, event.position), { kind: "cell", player: event.by, position: event.position, up: false })
        break
      case "round": {
        // every card of every grid comes from the draw pile, one after the other, a row of the table at a time
        const each = Math.min(P.deal, P.dealTotal / Math.max(1, players.length * 12))
        players.forEach((player, seat) => {
          for (let position = 0; position < 12; position++) come(cellKey(player, position), { kind: "deck" }, cursor.at + (position * players.length + seat) * each)
        })
        cursor.hold(Math.min(P.dealTotal, players.length * 12 * each))
        break
      }
      case "take":
        come(HELD_KEY, { kind: "discard" })
        break
      case "draw":
        come(HELD_KEY, { kind: "deck" })
        break
      case "place":
        // the card in hand goes into the cell, and the card it replaces goes to the discard, together
        come(cellKey(event.by, event.position), { kind: "held" })
        come(cardKey(event.replaced.id), { kind: "cell", player: event.by, position: event.position, up: event.replacedUp })
        replaced = event.replaced
        break
      case "discard":
        come(cardKey(event.card.id), { kind: "held" })
        break
      case "column":
        // the three cards stay where they lie until this column's turn comes, then gather, fly together and land: the board plays it from `removals`, not from the entrances of the cards
        removals.push({ player: event.by, column: event.column, cards: event.cards, at: cursor.at, timing })
        break
      default:
        break
    }
  })
  return { ...pace, entrances, removals, replaced: removals.length > 0 ? replaced : null }
}
