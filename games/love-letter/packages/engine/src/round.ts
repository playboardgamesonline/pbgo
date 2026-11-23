import { deal, draw, faceOfId, facesOfIds, keyOfId, noteEvent, playerAt, shuffle } from "@pbgo/engine-kit"
import { CATALOGUE } from "./catalogue"
import { type Ctx, areaOf, handOf, inRound, isOver, nextInRound, soleCard, valueOf, winnersOf } from "./machine"

/** How a round goes, from the deal to the count. */

/** At two players three cards are set aside face up, on top of the one set aside face down (rulebook, p. 3). */
const FACE_UP_AT_TWO = 3

/**
 * A round is dealt (rulebook, p. 3, and again p. 7 for the next ones): all 21 cards are shuffled together, the cards of the last round included, one is set
 * aside face down, three more face up at two players, and each player gets one. Nothing but the favor tokens carries over (the reading validated for p. 7):
 * every player is back in the round and no Handmaid protects anybody. The player in `turn` takes the first turn.
 */
export function startRound(ctx: Ctx): void {
  const { s } = ctx
  const n = s.seats.length
  const shuffled = shuffle(s.ids, ctx.rng)
  const { drawn: setAside, pile: afterAside } = draw(shuffled, 1)
  const { drawn: faceUp, pile: afterFaceUp } = draw(afterAside, n === 2 ? FACE_UP_AT_TWO : 0)
  const { hands, pile: deck } = deal(afterFaceUp, n, 1)
  const [aside] = setAside
  if (aside === undefined) throw new RangeError("The box has no card to set aside")
  s.aside = aside
  s.faceUp = faceUp
  s.hands = hands
  s.deck = deck
  s.areas = s.seats.map(() => [])
  s.out = s.seats.map(() => false)
  s.shielded = s.seats.map(() => false)
  s.round += 1
  noteEvent(ctx, { kind: "round", number: s.round, first: playerAt(s.seats, s.turn), faceUp: facesOfIds(s.ids, CATALOGUE, s.faceUp) })
  startTurn(ctx, s.turn)
}

/**
 * A turn begins (rulebook, p. 4): the protection of the player ends (p. 11: until the start of their next turn), and they draw the top card of the deck, which
 * only they see. The deck is never empty here: a round that leaves it empty ends first.
 */
export function startTurn(ctx: Ctx, seat: number): void {
  const { s } = ctx
  const [card] = s.deck.splice(0, 1)
  if (card === undefined) throw new RangeError("A turn begins with a card left in the deck")
  const player = playerAt(s.seats, seat)
  s.turn = seat
  s.shielded[seat] = false
  handOf(s, seat).push(card)
  s.stage = { kind: "play" }
  noteEvent(ctx, { kind: "draw", by: player, card: faceOfId(s.ids, CATALOGUE, card) }, { to: [player], masked: { kind: "draw", by: player } })
}

/**
 * A turn is over (its card was played and its effect resolved). The round ends at once when only one player is left in it (rulebook, p. 6), else after the turn
 * that leaves the deck empty; otherwise the next player still in the round draws.
 */
export function endTurn(ctx: Ctx): void {
  const { s } = ctx
  if (inRound(s).length === 1) endRound(ctx, "last")
  else if (s.deck.length === 0) endRound(ctx, "deck")
  else startTurn(ctx, nextInRound(s, s.turn))
}

/**
 * The round is over (rulebook, p. 6). `last`: one player is left, they win and nothing is revealed. `deck`: the deck ran out, the players still in lay their hands
 * face up, the highest value wins and a tie gives every tied player the win. Each winner gains a favor token; the only player still in the round who played or
 * discarded a Spy gains one more, and it is not a win (p. 13: the cards of the players who are out count for nothing, a Spy in a hand was neither played nor
 * discarded). The winner takes the first turn of the next round, one of the tied winners drawn by the stream when there are several (p. 7).
 */
export function endRound(ctx: Ctx, how: "deck" | "last"): void {
  const { s } = ctx
  const left = inRound(s)
  if (how === "deck") noteEvent(ctx, { kind: "reveal", hands: left.map((seat) => ({ player: playerAt(s.seats, seat), card: faceOfId(s.ids, CATALOGUE, soleCard(s, seat)) })) })
  const best = how === "deck" ? Math.max(...left.map((seat) => valueOf(s, soleCard(s, seat)))) : null
  const winners = best === null ? left : left.filter((seat) => valueOf(s, soleCard(s, seat)) === best)
  const withSpy = left.filter((seat) => areaOf(s, seat).some((id) => keyOfId(s.ids, CATALOGUE, id) === "spy"))
  const spy = withSpy.length === 1 ? (withSpy[0] ?? null) : null
  for (const seat of winners) s.won[seat] = (s.won[seat] ?? 0) + 1
  if (spy !== null) s.spies[spy] = (s.spies[spy] ?? 0) + 1
  const first = winners.length === 1 ? winners[0] : winners[Math.floor(ctx.rng() * winners.length)]
  if (first === undefined) throw new RangeError("A round has a winner")
  s.turn = first
  s.stage = { kind: "between", revealed: how === "deck", winners, spy }
  noteEvent(ctx, { kind: "end", how, winners: winners.map((seat) => playerAt(s.seats, seat)), spy: spy === null ? null : playerAt(s.seats, spy) })
  if (isOver(s)) noteEvent(ctx, { kind: "over", winners: winnersOf(s) })
}
