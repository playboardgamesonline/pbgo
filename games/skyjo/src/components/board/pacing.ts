import type { SkyjoEvent } from "@skyjo/engine"
import type { LogLine } from "@pbgo/core/lib/game-types"
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
  /** A column of three equal cards thrown away */
  column: 0.9,
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
  column: ["column thrown away (s)", 0.1, 2, 0.01],
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

/** How long each thing that happened keeps the table busy, in seconds */
function beatOf(event: SkyjoEvent): number {
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
      return P.column
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

export type Timeline = {
  /** The greatest version of the log, the move that was played last (0 for an empty log) */
  v: number
  /** Where what the last move brought comes from, and the seconds it waits before it sets out, by key (`cellKey`, `cardKey`, `HELD_KEY`) */
  entrances: Map<string, Entrance>
  /** The cards of the columns the last move threw away: they stay on the discard, one on the other, until the move has played out */
  columns: { id: number; type: string }[]
  /** Seconds until that move has played out: the last card has landed and the last thing has had its time */
  settle: number
}

/**
 * When each thing of the last move happens, from the lines of the log (`useGameLog`): the log says what happened and in what order, the board decides how long each takes. The view is drawn at once and is what is there; this is what the board waits with:
 * the cards come in one after the other, and the words that say how the move ended wait for it to end. `players` are the ids in seat order, for the cells of a deal. With `instant` (the visitor asks for less motion) nothing waits.
 */
export function timelineOf(lines: readonly LogLine<SkyjoEvent>[], players: readonly string[], instant = false): Timeline {
  const v = lines.reduce((greatest, line) => Math.max(greatest, line.v), 0)
  const entrances = new Map<string, Entrance>()
  const columns: Timeline["columns"] = []
  if (instant || v === 0) return { v, entrances, columns, settle: 0 }
  const P = PACE_SETTINGS
  let at = 0
  let landed = 0
  const come = (key: string, origin: Origin, delay: number) => {
    entrances.set(key, { origin, delay })
    landed = Math.max(landed, delay + P.landing)
  }
  for (const line of lines) {
    if (line.v !== v) continue
    const { event } = line
    switch (event.kind) {
      case "reveal":
        // the card turns over where it lies: it comes in from its own cell, face down
        come(cellKey(event.by, event.position), { kind: "cell", player: event.by, position: event.position, up: false }, at)
        break
      case "round": {
        // every card of every grid comes from the draw pile, one after the other, a row of the table at a time
        const each = Math.min(P.deal, P.dealTotal / Math.max(1, players.length * 12))
        players.forEach((player, seat) => {
          for (let position = 0; position < 12; position++) come(cellKey(player, position), { kind: "deck" }, at + (position * players.length + seat) * each)
        })
        at += Math.min(P.dealTotal, players.length * 12 * each)
        break
      }
      case "take":
        come(HELD_KEY, { kind: "discard" }, at)
        break
      case "draw":
        come(HELD_KEY, { kind: "deck" }, at)
        break
      case "place":
        // the card in hand goes into the cell, and the card it replaces goes to the discard, together
        come(cellKey(event.by, event.position), { kind: "held" }, at)
        come(cardKey(event.replaced.id), { kind: "cell", player: event.by, position: event.position, up: event.replacedUp }, at)
        break
      case "discard":
        come(cardKey(event.card.id), { kind: "held" }, at)
        break
      case "column": {
        // the three cards fly from their cells to the discard, one after the other
        event.cards.forEach((card, row) => {
          columns.push(card)
          come(cardKey(card.id), { kind: "cell", player: event.by, position: event.column * 3 + row, up: true }, at + row * 0.12)
        })
        break
      }
      default:
        break
    }
    at += beatOf(event)
  }
  return { v, entrances, columns, settle: Math.max(at, landed) }
}
