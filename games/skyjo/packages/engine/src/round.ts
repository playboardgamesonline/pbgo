import { reshuffleDiscard, shuffle } from "@pbgo/engine-kit"
import {
  type Ctx,
  allUp,
  emit,
  fullScore,
  gridOf,
  isOver,
  openingSeats,
  playerAt,
  valueOf,
  visibleScore,
  winnersOf,
} from "./machine"
import { CELLS, ROWS } from "./types"
import { COLUMN_NUMBERS, columnCells, isTriple, roundScores } from "./scoring"

/** How a round goes, from the deal to the count. */

/** The top card of the draw pile. When it is empty the discard is shuffled into a new one under it, keeping the card on top (rulebook: the top card stays visible). `null` when no card is left anywhere. */
export function drawCard(ctx: Ctx): number | null {
  const { s } = ctx
  if (s.deck.length === 0) {
    if (s.discard.length <= 1) return null
    const piles = reshuffleDiscard({ deck: s.deck, discard: s.discard }, ctx.rng, { keep: 1 })
    s.deck = piles.deck
    s.discard = piles.discard
    emit(ctx, { kind: "reshuffle" })
  }
  return s.deck.shift() ?? null
}

/**
 * A round is dealt: all 150 cards are shuffled together (the cards of the last round included), each player gets 12 face down in four columns
 * of three, the next card starts the discard, and the players turn two cards over.
 */
export function startRound(ctx: Ctx): void {
  const { s } = ctx
  s.deck = shuffle(s.ids, ctx.rng)
  s.discard = []
  s.grids = s.seats.map(() => s.deck.splice(0, CELLS).map((card) => ({ card, up: false })))
  const top = s.deck.shift()
  if (top === undefined) throw new RangeError("The box has no card to start the discard with")
  s.discard = [top]
  s.stage = { kind: "reveal" }
  s.ender = null
  s.last = []
  emit(ctx, { kind: "round", number: s.rounds.length + 1, dealer: playerAt(s, s.dealer) })
}

/**
 * Everybody has turned their two cards over: the player with the highest sum begins (rulebook, page 2). A tie goes to the first of the tied
 * players clockwise from the dealer's left (the rulebook is silent: to validate).
 */
export function beginTurns(ctx: Ctx): void {
  const { s } = ctx
  const n = s.seats.length
  const sums = s.seats.map((_, seat) => visibleScore(s, seat))
  const best = Math.max(...sums)
  let first = -1
  for (let i = 1; i <= n && first < 0; i++) {
    const seat = (s.dealer + i) % n
    if (sums[seat] === best) first = seat
  }
  s.stage = { kind: "choose", seat: first }
  emit(ctx, { kind: "start", by: playerAt(s, first), sum: best })
}

/** Called after a card turned over in the opening. Starts the round when everybody has turned theirs. */
export function afterOpening(ctx: Ctx): void {
  if (openingSeats(ctx.s).length === 0) beginTurns(ctx)
}

/** Three equal cards face up in a column go to the discard (rulebook, page 2). Gives whether the column left. */
export function dropColumn(ctx: Ctx, seat: number, column: number): boolean {
  const { s } = ctx
  const grid = gridOf(s, seat)
  const cells = columnCells(column).map((position) => grid[position])
  if (cells.length !== ROWS || cells.some((cell) => !cell?.up)) return false
  const cards = cells.flatMap((cell) => (cell ? [cell.card] : []))
  if (!isTriple(cards.map((card) => valueOf(s, card)))) return false
  for (const position of columnCells(column)) grid[position] = null
  s.discard.unshift(...cards)
  s.stats[seat]!.columns += 1
  emit(ctx, { kind: "column", by: playerAt(s, seat), column, value: valueOf(s, cards[0]!) })
  return true
}

/**
 * A turn is over (a card was placed or flipped; its column has been checked): the first player whose cards are all face up ends the round, the
 * others play one last turn each, and when the turn would come back to the one who ended it, the round is counted.
 */
export function endTurn(ctx: Ctx, seat: number): void {
  const { s } = ctx
  if (s.ender === null) {
    if (allUp(s, seat)) {
      s.ender = seat
      s.last = [seat]
      s.stats[seat]!.ended += 1
      emit(ctx, { kind: "last", by: playerAt(s, seat) })
    }
  } else if (!s.last.includes(seat)) {
    s.last.push(seat)
  }
  const next = (seat + 1) % s.seats.length
  if (s.ender !== null && next === s.ender) endRound(ctx)
  else s.stage = { kind: "choose", seat: next }
}

/**
 * The round is counted: the cards still face down are turned over, the columns of three equal cards that this makes go to the discard (rulebook,
 * page 2), every player scores the sum of their cards, the one who ended the round has theirs doubled unless it is strictly the lowest and
 * positive (page 3), and the deal passes to the left.
 */
export function endRound(ctx: Ctx): void {
  const { s } = ctx
  const { ender } = s
  if (ender === null) throw new RangeError("A round with nobody who ended it cannot be counted")
  s.grids.forEach((grid, seat) => {
    for (const cell of grid) if (cell) cell.up = true
    for (const column of COLUMN_NUMBERS) dropColumn(ctx, seat, column)
  })
  const sums = s.seats.map((_, seat) => fullScore(s, seat))
  const { scores, doubled } = roundScores(sums, ender)
  if (doubled) s.stats[ender]!.doubled += 1
  s.rounds.push(scores)
  s.dealer = (s.dealer + 1) % s.seats.length
  s.stage = { kind: "between" }
  emit(ctx, { kind: "end", scores, ender: playerAt(s, ender), doubled })
  if (isOver(s)) emit(ctx, { kind: "over", winners: winnersOf(s) })
}
