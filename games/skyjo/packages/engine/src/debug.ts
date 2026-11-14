import { autoPlayFor } from "./autoplay"
import { type Ctx, close, gridOf, isOver, open, valueOf, waitingFor } from "./machine"
import { columnCells } from "./scoring"
import type { State } from "./types"

/**
 * The debug panel (`GAME.debug`), for development only. `turn`, `round` and `over` play for the players the game waits for, as an absent
 * player would be; the other commands rig the grid of the player whose turn it is, or the totals, to reach a situation of the board at once.
 * A rigging command only acts when a player has to choose where to draw from, and it moves cards, never makes one up: a card comes from the draw
 * pile, else from the discard, and when none is left it changes nothing.
 */

/** Guards against a loop that does not end; a round never needs more than a few hundred steps. */
const TURN_STEPS = 100
const ROUND_STEPS = 2_000
const GAME_STEPS = 50_000

/** The game goes one step further: the player it waits for is played for. */
function playOne(state: State): State {
  const [first] = waitingFor(state)
  return first === undefined ? state : autoPlayFor(state, first)
}

/** Plays on until another player is waited for, or the round is over. */
function finishTurn(state: State): State {
  const [who] = waitingFor(state)
  if (who === undefined) return state
  const rounds = state.rounds.length
  let s = state
  for (let i = 0; i < TURN_STEPS && waitingFor(s)[0] === who && s.rounds.length === rounds; i++) s = playOne(s)
  return s
}

/** Plays on until the round is counted. */
function finishRound(state: State): State {
  const rounds = state.rounds.length
  let s = state
  for (let i = 0; i < ROUND_STEPS && s.rounds.length === rounds && !isOver(s); i++) s = playOne(s)
  return s
}

function finishGame(state: State): State {
  let s = state
  for (let i = 0; i < GAME_STEPS && !isOver(s); i++) s = playOne(s)
  return s
}

/** Runs `change` on a copy of the state, for the player whose turn it is, when they have to choose where to draw from. */
function edit(state: State, change: (ctx: Ctx, seat: number) => void): State {
  const ctx = open(state)
  const { stage } = ctx.s
  if (stage.kind === "choose") change(ctx, stage.seat)
  return close(ctx).state
}

/**
 * Swaps the card in a cell of the grid for another one worth `value`, taken from the draw pile (it takes the place the card leaves) or,
 * failing that, from another grid's cell or the discard. Gives whether it found one.
 */
function swapIn(ctx: Ctx, seat: number, position: number, value: number, up: boolean): boolean {
  const { s } = ctx
  const grid = gridOf(s, seat)
  const cell = grid[position]
  if (!cell) return false
  if (valueOf(s, cell.card) === value) {
    cell.up = up
    return true
  }
  const index = s.deck.findIndex((id) => valueOf(s, id) === value)
  if (index >= 0) {
    const out = cell.card
    cell.card = s.deck[index]!
    cell.up = up
    s.deck[index] = out
    return true
  }
  // No such card in the pile: take it from the cell of another grid that is face down
  for (const [other, theirs] of s.grids.entries()) {
    if (other === seat) continue
    const found = theirs.find((c) => c !== null && !c.up && valueOf(s, c.card) === value)
    if (found) {
      const out = cell.card
      cell.card = found.card
      cell.up = up
      found.card = out
      return true
    }
  }
  return false
}

/** Turns every card of the grid face up but the ones in `except` (a cell each), whatever they are. */
function turnUp(ctx: Ctx, seat: number, except: number[]): void {
  gridOf(ctx.s, seat).forEach((cell, position) => {
    if (cell && !except.includes(position)) cell.up = true
  })
}

export const debugCommands: Record<string, (state: State) => State> = {
  /** The current turn is played out. */
  turn: finishTurn,
  /** The round is played out to its count. */
  round: finishRound,
  /** The game is played to the end. */
  over: finishGame,
  /** The current player has all but one card face up: turning the last one ends the round. */
  lastCard: (state) =>
    edit(state, (ctx, seat) => {
      const grid = gridOf(ctx.s, seat)
      const hidden = grid.findIndex((cell) => cell !== null && !cell.up)
      turnUp(ctx, seat, hidden < 0 ? [] : [hidden])
    }),
  /** The current player shows two 5s in the first column and the top of the discard is a 5: placing it in the third cell throws the column away. */
  columnOnTop: (state) =>
    edit(state, (ctx, seat) => {
      const { s } = ctx
      const [a = 0, b = 1, c = 2] = columnCells(0)
      const top = s.discard[0]
      if (top === undefined) return
      const value = valueOf(s, top)
      const grid = gridOf(s, seat)
      if (grid[a] && grid[b] && grid[c] && swapIn(ctx, seat, a, value, true) && swapIn(ctx, seat, b, value, true)) grid[c]!.up = false
    }),
  /** The next card of the draw pile is the lowest card there is: a draw is worth keeping. */
  lowOnTop: (state) =>
    edit(state, (ctx) => {
      const { s } = ctx
      const index = s.deck.findIndex((id) => valueOf(s, id) === -2)
      if (index > 0) s.deck.unshift(...s.deck.splice(index, 1))
    }),
  /** The next card of the draw pile is a 12: a draw is to be thrown away. */
  highOnTop: (state) =>
    edit(state, (ctx) => {
      const { s } = ctx
      const index = s.deck.findIndex((id) => valueOf(s, id) === 12)
      if (index > 0) s.deck.unshift(...s.deck.splice(index, 1))
    }),
  /** One finished round is written down where the first seat stands at 94, and the others a little lower: the next round that ends takes the game to the target. */
  nearTarget: (state) => {
    const ctx = open(state)
    const { s } = ctx
    if (s.stage.kind === "choose" || s.stage.kind === "between") {
      s.rounds.push(s.seats.map((_, seat) => (seat === 0 ? 94 : 20 + 7 * seat)))
    }
    return close(ctx).state
  },
}

