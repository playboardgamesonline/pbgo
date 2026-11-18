import { autoPlayFor } from "./autoplay"
import type { CharacterKey } from "./catalogue"
import { type Ctx, areaOf, close, handOf, inRound, isOver, keyOf, open, waitingFor } from "./machine"
import { tokensToWin } from "./options"
import type { State } from "./types"

/**
 * The debug panel (`GAME.debug`), for development only. `turn`, `round` and `over` play for the player the game waits for, as an absent player would be; the
 * other commands rig the table to reach a situation of the board at once. A rigging command only acts on a turn that is waiting for a card to be played (the
 * stage `play`), for the player whose turn it is, and it moves cards, never makes one up: the card comes from the deck, else from another player's hand, else
 * from the card set aside, and when there is none it changes nothing. Every command leaves a state the rules could have reached.
 */

/** Guards against a loop that does not end; a round never needs more than a few hundred steps, a game a few thousand. */
const ROUND_STEPS = 1_000
const GAME_STEPS = 20_000

/** The game goes one step further: the player it waits for is played for (a whole turn, or the deal of the next round). */
function playOne(state: State): State {
  const [first] = waitingFor(state)
  return first === undefined ? state : autoPlayFor(state, first)
}

/** Plays on until the round is counted (a round that is already counted deals the next one first), or the game is over. */
function finishRound(state: State): State {
  let s = state
  if (s.stage.kind === "between" && !isOver(s)) s = playOne(s)
  for (let i = 0; i < ROUND_STEPS && s.stage.kind !== "between"; i++) s = playOne(s)
  return s
}

function finishGame(state: State): State {
  let s = state
  for (let i = 0; i < GAME_STEPS && !isOver(s); i++) s = playOne(s)
  return s
}

/** Runs `change` on a copy of the state, for the player whose turn it is, when they have a card to play. */
function edit(state: State, change: (ctx: Ctx, seat: number) => void): State {
  const ctx = open(state)
  if (ctx.s.stage.kind === "play") change(ctx, ctx.s.turn)
  return close(ctx).state
}

/**
 * Puts a card of the character `key` in the hand of `seat`, in the place of a card that is not one of the characters in `keep`. The card comes from the deck,
 * else from the hand of another player still in the round, else from the card set aside; the card it replaces goes where the other one was. Gives whether the
 * hand holds one now.
 */
function holdOne(ctx: Ctx, seat: number, key: CharacterKey, keep: readonly CharacterKey[] = []): boolean {
  const { s } = ctx
  const hand = handOf(s, seat)
  if (hand.some((id) => keyOf(s, id) === key)) return true
  const spare = hand.findIndex((id) => !keep.includes(keyOf(s, id)))
  if (spare < 0) return false
  const swap = (pile: number[], at: number) => {
    const [mine, theirs] = [hand[spare]!, pile[at]!]
    hand[spare] = theirs
    pile[at] = mine
  }
  const inDeck = s.deck.findIndex((id) => keyOf(s, id) === key)
  if (inDeck >= 0) {
    swap(s.deck, inDeck)
    return true
  }
  for (const other of inRound(s)) {
    if (other === seat) continue
    const theirs = handOf(s, other)
    const at = theirs.findIndex((id) => keyOf(s, id) === key)
    if (at >= 0) {
      swap(theirs, at)
      return true
    }
  }
  if (s.aside !== null && keyOf(s, s.aside) === key) {
    const mine = hand[spare]!
    hand[spare] = s.aside
    s.aside = mine
    return true
  }
  return false
}

/** Cuts the deck down to `size` cards: the cards below them lie face up in front of the players, one after the other, as if they had been played. */
function cutDeck(ctx: Ctx, size: number): void {
  const { s } = ctx
  const n = s.seats.length
  for (let i = 0; s.deck.length > size; i++) areaOf(s, i % n).push(s.deck.pop()!)
}

export const debugCommands: Record<string, (state: State) => State> = {
  /** The current turn is played out: a whole turn, or the deal of the next round. */
  turn: playOne,
  /** The round is played out to its count. */
  round: finishRound,
  /** The game is played to the end. */
  over: finishGame,
  /** The player whose turn it is holds the Countess and the King: she must be played, and nobody can tell it. */
  countessAndKing: (state) =>
    edit(state, (ctx, seat) => {
      if (holdOne(ctx, seat, "countess", ["king"])) holdOne(ctx, seat, "king", ["countess"])
    }),
  /** The player whose turn it is holds the Princess. */
  princessInHand: (state) => edit(state, (ctx, seat) => void holdOne(ctx, seat, "princess")),
  /** The player whose turn it is holds a Chancellor. */
  chancellorInHand: (state) => edit(state, (ctx, seat) => void holdOne(ctx, seat, "chancellor")),
  /** Two cards are left in the deck: a Chancellor draws both and the deck is empty while the player chooses. */
  twoCardsLeft: (state) => edit(state, (ctx) => cutDeck(ctx, 2)),
  /** One card is left in the deck: a Chancellor draws it and returns one card, and the round goes on. */
  oneCardLeft: (state) => edit(state, (ctx) => cutDeck(ctx, 1)),
  /** Every other player still in the round is protected by a Handmaid: the cards that pick another player are played with no effect, and the Prince picks its own player. */
  allProtected: (state) =>
    edit(state, (ctx, seat) => {
      for (const other of inRound(ctx.s)) if (other !== seat) ctx.s.shielded[other] = true
    }),
  /** The first seat is one favor token short of winning the game: the next round it wins ends it. A game that is over is left as it is. */
  nearTarget: (state) => {
    if (isOver(state)) return state
    const ctx = open(state)
    const { s } = ctx
    s.won[0] = Math.max(0, tokensToWin(s.seats.length) - 1 - (s.spies[0] ?? 0))
    return close(ctx).state
  },
}
