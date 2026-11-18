import type { CharacterKey } from "./catalogue"
import { type Ctx, areaOf, emit, faceOf, facesOf, handOf, keyOf, playerAt, soleCard, valueOf } from "./machine"

/**
 * What each character does when it is played (rulebook, pp. 8-13), by key. The card is already in front of its player when its effect runs, and the player holds
 * the other card of their turn alone. The turn ends when the effect is done (`endTurn`).
 *
 * A private entry names a card that stays in a hidden place by its key and never by its id, so that no id of a hidden card reaches a log (see "Friction" in the
 * notes of the game): the Priest, the Baron and the King read cards that stay in a hand.
 */

/** What an effect is told about the card just played: who played it, and the player it picked (a seat; `null` when it picks nobody, or when nobody could be picked). */
export type Play = {
  seat: number
  by: string
  target: number | null
  /** The character a Guard named. */
  guess: CharacterKey | null
}

export type Effect = (ctx: Ctx, play: Play) => void

/** A card that picks another player, played when every other player in the round is protected: it is played with no effect (rulebook, p. 11). */
function fizzle(ctx: Ctx, by: string): void {
  emit(ctx, { kind: "fizzled", by })
}

/**
 * `seat` is out of the round (rulebook, p. 5): their hand is discarded face up in front of them without resolving any card effect, they cannot be chosen any more
 * and their turn is skipped. The cause is the Princess when she was played, or discarded by a Prince (p. 8), a Guard that named the card held (p. 12) or the lower
 * card of a Baron's comparison (p. 12).
 */
export function eliminate(ctx: Ctx, seat: number, cause: "guard" | "baron" | "princess"): void {
  const { s } = ctx
  const cards = handOf(s, seat).splice(0)
  areaOf(s, seat).push(...cards)
  // Nobody out is protected: only a player on their turn is knocked out (by their own card, or by the Princess discarded), and their protection ended when it began
  s.out[seat] = true
  emit(ctx, { kind: "out", player: playerAt(s, seat), cards: facesOf(s, cards), cause })
}

/** Guard (rulebook, p. 12): name a character other than the Guard; the chosen player announces whether they hold it, and if they do they are out of the round. */
function guard(ctx: Ctx, { by, target, guess }: Play): void {
  const { s } = ctx
  if (target === null || guess === null) return fizzle(ctx, by)
  const hit = keyOf(s, soleCard(s, target)) === guess
  emit(ctx, { kind: "guess", by, target: playerAt(s, target), guess, hit })
  if (hit) eliminate(ctx, target, "guard")
}

/** Priest (rulebook, p. 12): look at another player's hand, which nobody else sees. */
function priest(ctx: Ctx, { by, target }: Play): void {
  const { s } = ctx
  if (target === null) return fizzle(ctx, by)
  const player = playerAt(s, target)
  emit(ctx, { kind: "look", by, target: player, card: keyOf(s, soleCard(s, target)) }, { to: [by], masked: { kind: "look", by, target: player } })
}

/** Baron (rulebook, p. 12): compare hands with another player in secret; the lower value is out of the round, and with a tie neither is. */
function baron(ctx: Ctx, { seat, by, target }: Play): void {
  const { s } = ctx
  if (target === null) return fizzle(ctx, by)
  const player = playerAt(s, target)
  const mine = soleCard(s, seat)
  const theirs = soleCard(s, target)
  emit(ctx, { kind: "compare", by, target: player, cards: { by: keyOf(s, mine), target: keyOf(s, theirs) } }, { to: [by, player], masked: { kind: "compare", by, target: player } })
  if (valueOf(s, mine) < valueOf(s, theirs)) eliminate(ctx, seat, "baron")
  else if (valueOf(s, theirs) < valueOf(s, mine)) eliminate(ctx, target, "baron")
}

/** King (rulebook, p. 9): trade hands with another player. After the trade each of the two holds, and so knows, the other's former card. */
function king(ctx: Ctx, { seat, by, target }: Play): void {
  const { s } = ctx
  if (target === null) return fizzle(ctx, by)
  const player = playerAt(s, target)
  const mine = soleCard(s, seat)
  const theirs = soleCard(s, target)
  const cards = { by: keyOf(s, mine), target: keyOf(s, theirs) }
  s.hands[seat] = [theirs]
  s.hands[target] = [mine]
  emit(ctx, { kind: "swap", by, target: player, cards }, { to: [by, player], masked: { kind: "swap", by, target: player } })
}

/**
 * Prince (rulebook, p. 10): any player, the one who plays it included, discards their hand face up without resolving its effect and draws a new card, the card set
 * aside face down when the deck is empty. The Princess discarded this way is out of the round and draws nothing (p. 8).
 */
function prince(ctx: Ctx, { by, target }: Play): void {
  const { s } = ctx
  if (target === null) throw new RangeError("A Prince always has a player to pick: the one who plays it")
  const player = playerAt(s, target)
  const discarded = handOf(s, target).splice(0)
  areaOf(s, target).push(...discarded)
  for (const id of discarded) emit(ctx, { kind: "discard", by, player, card: faceOf(s, id) })
  if (discarded.some((id) => keyOf(s, id) === "princess")) return eliminate(ctx, target, "princess")
  let card: number | undefined
  if (s.deck.length > 0) card = s.deck.shift()
  else if (s.aside !== null) {
    card = s.aside
    s.aside = null
  }
  if (card === undefined) throw new RangeError("A Prince finds a card to draw: the deck, or the card set aside")
  handOf(s, target).push(card)
  emit(ctx, { kind: "draw", by: player, card: faceOf(s, card) }, { to: [player], masked: { kind: "draw", by: player } })
}

/**
 * Chancellor (rulebook, p. 10): draw two cards from the deck into the hand (one when the deck holds only one, and with none left the card is played with no
 * effect), then keep one of the cards in hand and put the others under the deck face down, in any order. The turn waits for that choice: it is the stage `keep`
 * (`keep` in `actions.ts`). Only its player sees the cards drawn.
 */
function chancellor(ctx: Ctx, { seat, by }: Play): void {
  const { s } = ctx
  const drawn = s.deck.splice(0, 2)
  if (drawn.length === 0) return fizzle(ctx, by)
  handOf(s, seat).push(...drawn)
  s.stage = { kind: "keep" }
  emit(ctx, { kind: "chancellor", by, drew: drawn.length, cards: facesOf(s, drawn) }, { to: [by], masked: { kind: "chancellor", by, drew: drawn.length } })
}

/** Handmaid (rulebook, p. 11): until the start of their next turn, the other players cannot pick the player of the Handmaid (`startTurn` ends the protection). */
function handmaid(ctx: Ctx, { seat, by }: Play): void {
  ctx.s.shielded[seat] = true
  emit(ctx, { kind: "protect", by })
}

/** Princess (rulebook, p. 8): a player who plays her is out of the round. (Discarded by a Prince she does the same: `prince`.) */
function princess(ctx: Ctx, { seat }: Play): void {
  eliminate(ctx, seat, "princess")
}

/** The effect of each character. The Spy and the Countess do nothing when played; the Chancellor leaves a choice to its player. */
export const EFFECTS: Record<CharacterKey, Effect> = {
  // No effect (rulebook, p. 13): its only part is the token it can earn at the end of the round
  spy: () => undefined,
  guard,
  priest,
  baron,
  handmaid,
  prince,
  chancellor,
  king,
  // No effect (rulebook, p. 9): her rule is about which card a player may play (`playableOf`)
  countess: () => undefined,
  princess,
}
