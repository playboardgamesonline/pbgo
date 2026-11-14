import { EngineError } from "@pbgo/engine-kit"
import { dealRound, discard, draw, flip, place, reveal, take } from "./actions"
import { type Ctx, close, gridOf, open, revealedCount, valueOf, waitingFor } from "./machine"
import { columnCells } from "./scoring"
import { OPENING_FLIPS, type SkyjoStep, type State } from "./types"

/**
 * Playing for an absent player: legal, deterministic and complete (the whole turn, not one click), with a plain strategy that keeps the table
 * moving. It turns the first cards of the grid over, takes the top of the discard when it is low (4 or less) and it helps, else draws; a
 * card goes where it completes a column, else over a face-up card that is at least two points higher, else over a face-down card
 * when it is 4 or less, else it is thrown away and the first face-down card is turned. Every turn either turns a card over or lowers
 * a card by two or more, so a round always ends.
 */

/** The order the opening cards are turned in: the tops of the columns first, so that the two are in different columns. */
const OPENING_ORDER = [0, 3, 6, 9, 1, 4, 7, 10, 2, 5, 8, 11]

/** The low cards the bot is happy to keep. */
const KEEP_AT_MOST = 4

type Known = { position: number; value: number | null }

/** What a seat's grid shows: a value for a card face up, `null` for one face down, nothing for a hole. */
function known(s: State, seat: number): Known[] {
  return gridOf(s, seat).flatMap((cell, position) => (cell === null ? [] : [{ position, value: cell.up ? valueOf(s, cell.card) : null }]))
}

/** The cell that completes a column with `value`: the other two cells of the column are face up and worth `value`, and so is this one or it is face down or face up with a different value. */
function completing(s: State, seat: number, value: number): number | undefined {
  const cells = known(s, seat)
  for (const column of [0, 1, 2, 3]) {
    const inColumn = columnCells(column).map((position) => cells.find((cell) => cell.position === position))
    if (inColumn.some((cell) => cell === undefined)) continue
    const equal = inColumn.filter((cell) => cell!.value === value)
    const other = inColumn.filter((cell) => cell!.value !== value)
    if (equal.length === 2 && other.length === 1) return other[0]!.position
  }
  return undefined
}

/** Where `value` goes: a position, or `undefined` when it should be thrown away. */
function placement(s: State, seat: number, value: number): number | undefined {
  const done = completing(s, seat, value)
  if (done !== undefined) return done
  const cells = known(s, seat)
  const high = cells.filter((cell) => cell.value !== null && cell.value - value >= 2).sort((a, b) => b.value! - a.value! || a.position - b.position)[0]
  if (high) return high.position
  if (value <= KEEP_AT_MOST) return cells.find((cell) => cell.value === null)?.position
  return undefined
}

/** A card that must be placed and has no good place: a face-down card, else the highest card face up. */
function anywhere(s: State, seat: number): number {
  const cells = known(s, seat)
  const hidden = cells.find((cell) => cell.value === null)
  if (hidden) return hidden.position
  const [high] = [...cells].sort((a, b) => b.value! - a.value! || a.position - b.position)
  if (!high) throw new RangeError("A player who plays has a card in their grid")
  return high.position
}

function firstHidden(s: State, seat: number): number {
  const position = known(s, seat).find((cell) => cell.value === null)?.position
  if (position === undefined) throw new RangeError("A player who plays has a card face down")
  return position
}

/**
 * Plays the current step for `playerId`, who is absent. Legal and complete: the step is over when this returns.
 * `NOT_WAITING` when the game is not waiting for them.
 */
export function autoPlay(ctx: Ctx, playerId: string): void {
  const { s } = ctx
  if (!waitingFor(s).includes(playerId)) throw new EngineError("NOT_WAITING", "The game is not waiting for this player")
  const { stage } = s
  switch (stage.kind) {
    case "reveal": {
      const seat = s.seats.indexOf(playerId)
      for (const position of OPENING_ORDER) {
        if (revealedCount(s, seat) >= OPENING_FLIPS) break
        if (gridOf(s, seat)[position]?.up === false) reveal(ctx, playerId, position)
      }
      return
    }
    case "between":
      dealRound(ctx, playerId)
      return
    case "choose": {
      const top = s.discard[0]
      const topValue = top === undefined ? Infinity : valueOf(s, top)
      // a low card is worth taking, and so is any card that completes a column
      const spot = topValue <= KEEP_AT_MOST || completing(s, stage.seat, topValue) !== undefined ? placement(s, stage.seat, topValue) : undefined
      if (spot !== undefined) {
        take(ctx, playerId)
        place(ctx, playerId, spot)
      } else draw(ctx, playerId)
      break
    }
    case "place":
    case "flip":
      break
  }
  // a card was drawn (or the player was already holding one): place it or throw it away
  const now = ctx.s.stage
  if (now.kind === "place") {
    const spot = placement(ctx.s, now.seat, valueOf(ctx.s, now.card)) ?? (now.from === "discard" ? anywhere(ctx.s, now.seat) : undefined)
    if (spot !== undefined) place(ctx, playerId, spot)
    else discard(ctx, playerId)
  }
  const after = ctx.s.stage
  if (after.kind === "flip" && after.seat === ctx.s.seats.indexOf(playerId)) flip(ctx, playerId, firstHidden(ctx.s, after.seat))
}

/** `GAME.autoPlayStep`: the state once `playerId` has been played for, and what happened. */
export function autoPlayStep(state: State, playerId: string): SkyjoStep {
  const ctx = open(state)
  autoPlay(ctx, playerId)
  return close(ctx)
}

/** `GAME.autoPlayFor`: the state once `playerId` has been played for. */
export function autoPlayFor(state: State, playerId: string): State {
  return autoPlayStep(state, playerId).state
}

