import { EngineError } from "@pbgo/engine-kit"
import { type Ctx, cardType, checkTarget, emit, faceOf, facesOf, handOf, hasCards, kindOf, openWindow, removeFrom, seatOf, typeOf } from "./machine"
import type { ComboPending } from "./types"

/**
 * Combos: cards played together, whatever they print. They are the same in every deck, so they are written once here, outside the
 * effects of the cards.
 * - a pair (two cards of the same title): steal a random card from a player
 * - a triple (three of the same title): name a title and ask a player for it
 * - five different titles (option `fiveDifferent`): take any card from the discard
 * Any title counts, an action card or a Defuse as well as a cat; an Exploding Kitten is never in a hand.
 */
const PAIR = 2
const TRIPLE = 3
const DIFFERENT = 5

/** The title a triple asks for: a card of this game, other than an Exploding Kitten (which nobody holds). */
function checkTitle(ctx: Ctx, named: unknown): string {
  if (typeof named !== "string" || !ctx.types.includes(named) || cardType(ctx.rules, named).kind === "kitten") {
    throw new EngineError("INVALID_TITLE", "Name a card of the game that can be held")
  }
  return named
}

/**
 * `by` plays `cards` as a combo: they go to the discard and a Nope window opens on it. `target` (pair, triple) and `named` (triple)
 * are the player and the title the combo aims at; they are ignored when the combo has no use for them.
 */
export function playCombo(ctx: Ctx, by: string, cards: readonly number[], target: unknown, named: unknown): void {
  const { s } = ctx
  const hand = handOf(s, by)
  if (cards.some((id) => !hand.includes(id))) throw new EngineError("UNKNOWN_CARD", "Play cards from your own hand")
  if (new Set(cards).size !== cards.length) throw new EngineError("BAD_COMBO", "A card cannot be played twice")
  const titles = new Set(cards.map((id) => typeOf(ctx, id)))
  const pending: ComboPending = { kind: "combo", by, cards: [...cards] }

  if (cards.length === PAIR || cards.length === TRIPLE) {
    if (titles.size !== 1) throw new EngineError("BAD_COMBO", `${cards.length} cards must have the same title`)
    pending.target = checkTarget(s, by, target)
    if (cards.length === TRIPLE) pending.named = checkTitle(ctx, named)
  } else if (cards.length === DIFFERENT && s.options.fiveDifferent === true) {
    if (titles.size !== DIFFERENT) throw new EngineError("BAD_COMBO", `${DIFFERENT} cards must have different titles`)
    // The five cards are not on the discard yet: only what was there before can be taken, and an Exploding Kitten never can
    if (!s.discard.some((id) => kindOf(ctx, id) !== "kitten")) throw new EngineError("EMPTY_DISCARD", "Nothing to take from the discard")
  } else {
    throw new EngineError("BAD_COMBO", "A combo is two or three cards of the same title, or five different ones")
  }

  for (const id of cards) {
    removeFrom(hand, id)
    s.discard.unshift(id)
  }
  emit(ctx, { ...pending, cards: facesOf(ctx, cards) })
  openWindow(ctx, pending)
}

/** The combo resolves (its Nope window closed without cancelling it). */
export function resolveCombo(ctx: Ctx, pending: ComboPending): void {
  const { s } = ctx
  const { by, target } = pending

  if (pending.cards.length === DIFFERENT) {
    s.phase = { kind: "pick", played: [...pending.cards] }
    return
  }

  // A pair or a triple needs a card to take: the target may have played their last one (a Nope) behind the window
  if (!hasCards(s, target)) {
    emit(ctx, { kind: "fizzled", by })
    return
  }
  const victim = s.hands[seatOf(s, target)]!

  if (pending.cards.length === PAIR) {
    const [card] = victim.splice(Math.floor(ctx.rng() * victim.length), 1)
    handOf(s, by).push(card!)
    // Only the two of them see which card it was
    emit(ctx, { kind: "steal", by, from: target, card: faceOf(ctx, card!) }, [by, target], { kind: "steal", by, from: target })
    return
  }

  const title = pending.named
  if (title === undefined) throw new RangeError("A triple names a title")
  const card = victim.find((id) => typeOf(ctx, id) === title)
  if (card === undefined) {
    emit(ctx, { kind: "named", by, from: target, title, hit: false })
    return
  }
  removeFrom(victim, card)
  handOf(s, by).push(card)
  // The title and whether it hit are known to everyone, which card exactly only to the two of them
  emit(ctx, { kind: "named", by, from: target, title, hit: true, card: faceOf(ctx, card) }, [by, target], { kind: "named", by, from: target, title, hit: true })
}
