import { autoPlayFor } from "./autoplay"
import type { CardKind } from "./catalogue"
import { type Ctx, close, currentId, handOf, kindOf, open, reissue, removeFrom, waitingFor } from "./machine"
import type { Rules } from "./rules"
import type { State } from "./types"
import { resolveWindow } from "./window"

/**
 * The debug panel (`GAME.debug`), for development only. `turn` and `over` play for the players the game waits for, as an absent
 * player would be; the other commands rig the table, each on the current player. A command that moves cards acts only between
 * two plays (phase `turn`): in the middle of a window or a Favor it changes nothing.
 */

/** Guards against a loop that does not end; a game never needs more than a few hundred steps. */
const TURN_STEPS = 100
const GAME_STEPS = 10_000

/** The game goes one step further: the first player it waits for is played for. */
function playOne(rules: Rules, state: State): State {
  const [first] = waitingFor(state)
  return first === undefined ? state : autoPlayFor(rules, state, first)
}

/** Plays on until the current turn is over: another player's, or the next turn the same player owes. */
function finishTurn(rules: Rules, state: State): State {
  const { turn, owed } = state
  let s = state
  for (let i = 0; i < TURN_STEPS && s.phase.kind !== "over" && s.turn === turn && s.owed === owed; i++) s = playOne(rules, s)
  return s
}

function finishGame(rules: Rules, state: State): State {
  let s = state
  for (let i = 0; i < GAME_STEPS && s.phase.kind !== "over"; i++) s = playOne(rules, s)
  return s
}

/** Runs `change` on a copy of the state, between two plays only. Nobody remembers the top of the draw pile after it. */
function edit(rules: Rules, state: State, change: (ctx: Ctx) => void): State {
  const ctx = open(rules, state)
  if (ctx.s.phase.kind === "turn") {
    change(ctx)
    ctx.s.known = {}
  }
  return close(ctx).state
}

/**
 * Takes a card of `kind` out of the draw pile, else the discard, else the hand of another player, where it was; it comes out under
 * a new id. Gives it back, or `undefined` when there is none.
 */
function takeOne(ctx: Ctx, kind: CardKind, except: string): number | undefined {
  const { s } = ctx
  const places = [s.deck, s.discard, ...s.hands.filter((_, seat) => s.seats[seat] !== except)]
  for (const place of places) {
    const found = place.find((id) => kindOf(ctx, id) === kind)
    if (found === undefined) continue
    removeFrom(place, found)
    return reissue(ctx, found)
  }
  return undefined
}

function giveOne(rules: Rules, state: State, kind: CardKind): State {
  return edit(rules, state, (ctx) => {
    const me = currentId(ctx.s)
    const id = takeOne(ctx, kind, me)
    if (id !== undefined) handOf(ctx.s, me).push(id)
  })
}

export function debugCommands(rules: Rules): Record<string, (state: State) => State> {
  return {
    /** The current turn is played out. */
    turn: (state) => finishTurn(rules, state),
    /** The game is played to the end. */
    over: (state) => finishGame(rules, state),
    /** An Exploding Kitten is the next card of the draw pile. */
    kittenOnTop: (state) =>
      edit(rules, state, (ctx) => {
        const { deck } = ctx.s
        const at = deck.findIndex((id) => kindOf(ctx, id) === "kitten")
        if (at > 0) deck.unshift(...deck.splice(at, 1))
      }),
    /** The current player holds a Nope. */
    giveNope: (state) => giveOne(rules, state, "nope"),
    /** The current player holds a Defuse. */
    giveDefuse: (state) => giveOne(rules, state, "defuse"),
    /** The current player holds no Defuse any more (they go to the discard). */
    stripDefuse: (state) =>
      edit(rules, state, (ctx) => {
        const hand = handOf(ctx.s, currentId(ctx.s))
        for (const id of hand.filter((card) => kindOf(ctx, card) === "defuse")) {
          removeFrom(hand, id)
          ctx.s.discard.unshift(id)
        }
      }),
    /** The current player owes the turns an Attack would give them. */
    attackMe: (state) =>
      edit(rules, state, ({ s }) => {
        s.owed = s.attacked ? s.owed + 2 : 2
        s.attacked = true
      }),
    /** The Nope window closes, whoever has answered. */
    closeWindow: (state) => resolveWindow(rules, state).state,
  }
}
