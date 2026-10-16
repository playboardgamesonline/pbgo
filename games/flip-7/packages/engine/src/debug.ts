import { autoPlayFor } from "./autoplay"
import type { CardType } from "./catalogue"
import { type Ctx, close, isOver, numbersOf, open, removeFrom, typeOf, waitingFor } from "./machine"
import { FLIP_7 } from "./scoring"
import type { State } from "./types"

/**
 * The debug panel (`GAME.debug`), for development only. `turn` and `over` play for the players the game waits for, as an absent player
 * would be; the other commands rig the draw pile or the line of the player whose turn it is, to reach a situation of the board at
 * once. A rigging command only acts between two plays, when a player has to hit or stay, and it moves cards, never makes one up: the
 * card comes from the draw pile, else from the discard, and when none is left it changes nothing.
 */

/** Guards against a loop that does not end; a round never needs more than a few hundred steps. */
const TURN_STEPS = 100
const GAME_STEPS = 10_000

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

function finishGame(state: State): State {
  let s = state
  for (let i = 0; i < GAME_STEPS && !isOver(s); i++) s = playOne(s)
  return s
}

/** Runs `change` on a copy of the state, for the player whose turn it is, between two plays only. */
function edit(state: State, change: (ctx: Ctx, seat: number) => void): State {
  const ctx = open(state)
  const top = ctx.s.stack.at(-1)
  if (top?.kind === "turn" && !top.acted) change(ctx, top.seat)
  return close(ctx).state
}

/** Takes a card that `wanted` accepts out of the draw pile, else out of the discard. Gives its id, or `undefined` when there is none. */
function takeCard(ctx: Ctx, wanted: (card: CardType) => boolean): number | undefined {
  const { s } = ctx
  for (const pile of [s.deck, s.discard]) {
    const id = pile.find((candidate) => wanted(typeOf(s, candidate)))
    if (id === undefined) continue
    removeFrom(pile, id)
    return id
  }
  return undefined
}

/** The next card of the draw pile is the first one that `wanted` accepts. */
function putOnTop(ctx: Ctx, wanted: (card: CardType) => boolean): void {
  const id = takeCard(ctx, wanted)
  if (id !== undefined) ctx.s.deck.unshift(id)
}

const isAction = (effect: string) => (card: CardType) => card.kind === "action" && card.effect === effect

export const debugCommands: Record<string, (state: State) => State> = {
  /** The current turn is played out. */
  turn: finishTurn,
  /** The game is played to the end. */
  over: finishGame,
  /** The next card is a number the current player already holds: a hit busts, unless they hold a Second Chance. */
  bustOnTop: (state) =>
    edit(state, (ctx, seat) => {
      const held = numbersOf(ctx.s, seat)
      putOnTop(ctx, (card) => card.kind === "number" && held.includes(card.value))
    }),
  /** The next card is a Freeze. */
  freezeOnTop: (state) => edit(state, (ctx) => putOnTop(ctx, isAction("freeze"))),
  /** The next card is a Flip Three. */
  flipThreeOnTop: (state) => edit(state, (ctx) => putOnTop(ctx, isAction("flip-three"))),
  /** The next card is a Second Chance. */
  secondChanceOnTop: (state) => edit(state, (ctx) => putOnTop(ctx, isAction("second-chance"))),
  /** The current player holds six different numbers and the next card is a seventh: a hit is a Flip 7. */
  flip7: (state) =>
    edit(state, (ctx, seat) => {
      const { s } = ctx
      const line = s.lines[seat]!
      const held = new Set(numbersOf(s, seat))
      while (held.size < FLIP_7 - 1) {
        const id = takeCard(ctx, (card) => card.kind === "number" && !held.has(card.value))
        if (id === undefined) return
        line.push(id)
        const card = typeOf(s, id)
        if (card.kind === "number") held.add(card.value)
      }
      putOnTop(ctx, (card) => card.kind === "number" && !held.has(card.value))
    }),
}
