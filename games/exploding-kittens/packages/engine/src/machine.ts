import { EngineError, type SaveableRng, cardOf, openSubmissions, reissueId, reissueIds, restoreRng } from "@pbgo/engine-kit"
import { type CardKind, type CardType, buildCatalogue } from "./catalogue"
import type { Rules } from "./rules"
import type { EkEvent, EkLogEntry, Face, Pending, State, Step } from "./types"

/**
 * The machinery every rule is written with: one step of the game is `open` (a private copy of the state), a few mutations, then
 * `close` (the new state and what happened). Nothing here knows a card by its name: rules switch on the `kind` and the `effect`
 * of a card type (see `catalogue.ts`).
 */

/** What a step works on. `s` is a copy of the state: mutate it freely, the state that came in is never touched. */
export type Ctx = {
  rules: Rules
  s: State
  /** The type of each card, by catalogue index. */
  types: string[]
  /** Shuffles, steals and automatic plays. */
  rng: SaveableRng
  /** The ids of the cards (a side stream: drawing from it never moves `rng`). */
  idsRng: SaveableRng
  events: EkLogEntry[]
}

/**
 * What an action card does once its Nope window has closed without cancelling it. A new card is an entry of `EFFECTS`
 * (`effects.ts`) and a card type whose `effect` is its key.
 */
export type Effect = {
  /** The card names a player (Favor): the play must name a living opponent who holds at least one card. */
  targeted?: boolean
  /** Runs when the card resolves. `by` is the player who played it, `target` the one it names. */
  resolve(ctx: Ctx, play: { by: string; target?: string }): void
}

/** A step starts here: a copy of the state to mutate, with the streams picked up where the last step left them. */
export function open(rules: Rules, state: State): Ctx {
  const s = structuredClone(state)
  return { rules, s, types: buildCatalogue(rules, s.options), rng: restoreRng(s.rng), idsRng: restoreRng(s.idsRng), events: [] }
}

/** A step ends here: the streams are saved back into the state, which comes out with what happened. */
export function close(ctx: Ctx): Step {
  ctx.s.rng = ctx.rng.save()
  ctx.s.idsRng = ctx.idsRng.save()
  return { state: ctx.s, events: ctx.events }
}

// --- Cards

/** The rules of a card type. */
export function cardType(rules: Rules, type: string): CardType {
  const card = Object.hasOwn(rules.cards, type) ? rules.cards[type] : undefined
  if (!card) throw new RangeError(`Unknown card type "${type}"`)
  return card
}

/** The type of the card that holds `id` now (a key of the cards of the rules). */
export function typeOf(ctx: Pick<Ctx, "s" | "types">, id: number): string {
  const type = ctx.types[cardOf(ctx.s.ids, id)]
  if (type === undefined) throw new EngineError("UNKNOWN_CARD", `No card holds the id ${id}`)
  return type
}

export function kindOf(ctx: Ctx, id: number): CardKind {
  return cardType(ctx.rules, typeOf(ctx, id)).kind
}

/** What an action card does. Every `action` card type names an effect of the rules: a card that does not is a mistake in the data. */
export function effectOf(rules: Rules, type: string): Effect {
  const { effect } = cardType(rules, type)
  const found = effect !== undefined && Object.hasOwn(rules.effects, effect) ? rules.effects[effect] : undefined
  if (!found) throw new RangeError(`The card type "${type}" has no effect`)
  return found
}

export function faceOf(ctx: Pick<Ctx, "s" | "types">, id: number): Face {
  return { id, type: typeOf(ctx, id) }
}

export function facesOf(ctx: Pick<Ctx, "s" | "types">, ids: readonly number[]): Face[] {
  return ids.map((id) => faceOf(ctx, id))
}

/** Takes `id` out of `list`. It must be there: a card is always in exactly one place. */
export function removeFrom(list: number[], id: number): void {
  const index = list.indexOf(id)
  if (index < 0) throw new RangeError(`The card ${id} is not where it should be`)
  list.splice(index, 1)
}

/** `id` goes back into hiding: it holds a new id, which nobody has seen. Gives the new one. */
export function reissue(ctx: Ctx, id: number): number {
  const { ids, fresh } = reissueId(ctx.s.ids, id, ctx.idsRng)
  ctx.s.ids = ids
  return fresh
}

/** The same for several cards at once: `fresh[i]` replaces `held[i]`. */
export function reissueAll(ctx: Ctx, held: readonly number[]): number[] {
  const { ids, fresh } = reissueIds(ctx.s.ids, held, ctx.idsRng)
  ctx.s.ids = ids
  return fresh
}

// --- Players

/** Seat of a player; -1 when they are not at the table. */
export function seatOf(s: State, playerId: string): number {
  return s.seats.indexOf(playerId)
}

export function isOut(s: State, playerId: string): boolean {
  return s.out.includes(playerId)
}

/** The players still in the game, in seat order. */
export function livingIds(s: State): string[] {
  return s.seats.filter((id) => !s.out.includes(id))
}

/** Seat of the player who plays after the one in `seat`: the next one clockwise who is still in the game. */
export function nextLiving(s: State, seat: number): number {
  for (let i = 1; i <= s.seats.length; i++) {
    const next = (seat + i) % s.seats.length
    if (!s.out.includes(s.seats[next]!)) return next
  }
  throw new RangeError("Nobody is left in the game")
}

/** Id of the player whose turn it is. */
export function currentId(s: State): string {
  return s.seats[s.turn]!
}

/** The hand of a player at the table. */
export function handOf(s: State, playerId: string): number[] {
  const hand = s.hands[seatOf(s, playerId)]
  if (!hand) throw new RangeError(`${playerId} is not at the table`)
  return hand
}

/**
 * Who the game waits for, whatever it is. The reaction lists every responder, those who passed too: that way the list never
 * tells who passed.
 */
export function waitingFor(s: State): string[] {
  const phase = s.phase
  switch (phase.kind) {
    case "over":
      return []
    case "give":
      return [phase.from]
    case "reaction":
      return s.seats.filter((id) => Object.hasOwn(phase.passed, id))
    default:
      return [currentId(s)]
  }
}

/**
 * `target` is in the game and holds at least one card: a Favor or a combo aimed at them has something to take. Checked when the
 * card is played, and again when it resolves (their hand may have emptied behind the Nope window: the card fizzles).
 */
export function hasCards(s: State, target: string | undefined): target is string {
  if (target === undefined || isOut(s, target)) return false
  const hand = s.hands[seatOf(s, target)]
  return hand !== undefined && hand.length > 0
}

/** A player the card names: an opponent who holds at least one card. Gives the id back once checked. */
export function checkTarget(s: State, by: string, target: unknown): string {
  if (typeof target !== "string" || target === by || !hasCards(s, target)) {
    throw new EngineError("INVALID_TARGET", "Aim at another player who still holds a card")
  }
  return target
}

// --- The log

/**
 * Notes what happened. `to`: the only players who may see `event`; the others get `masked` (or nothing, when there is none).
 */
export function emit(ctx: Ctx, event: EkEvent, to?: readonly string[], masked?: EkEvent): void {
  const entry: EkLogEntry = { event }
  if (to) entry.to = to
  if (masked) entry.masked = masked
  ctx.events.push(entry)
}

// --- Knowledge of the top of the draw pile

/** The top card of the draw pile left: whoever knew `n` cards knows one less. */
export function lowerKnown(s: State): void {
  for (const [id, n] of Object.entries(s.known)) {
    if (n <= 1) delete s.known[id]
    else s.known[id] = n - 1
  }
}

/**
 * `by` put the Exploding Kitten back into the draw pile at `position`. They keep what they knew of the cards above it. Nobody else
 * keeps anything, wherever it went: if what the others know shrank only when the Kitten went in above it, the size of their own
 * view would tell them where the Kitten is, which only its owner may know.
 */
export function reinsertKnown(s: State, by: string, position: number): void {
  const n = Math.min(s.known[by] ?? 0, position)
  s.known = n > 0 ? { [by]: n } : {}
}

// --- Turns

/** `seat` plays now, with `owed` turns to take. */
export function startTurn(ctx: Ctx, seat: number, owed: number, attacked: boolean): void {
  const { s } = ctx
  s.turn = seat
  s.owed = owed
  s.attacked = attacked
  emit(ctx, { kind: "turn", player: currentId(s), owed })
}

/** The turn passes to the next player, who starts a normal single turn. */
export function advance(ctx: Ctx): void {
  startTurn(ctx, nextLiving(ctx.s, ctx.s.turn), 1, false)
}

/** One of the turns the current player owes is over (a card drawn, a Skip, a Defuse): theirs again, or the next player's. */
export function endTurn(ctx: Ctx): void {
  const { s } = ctx
  s.stats[s.turn]!.turns += 1
  if (s.owed > 1) {
    s.owed -= 1
    emit(ctx, { kind: "turn", player: currentId(s), owed: s.owed })
  } else advance(ctx)
}

/** The game is over: `winner` is the last one in. */
export function finish(ctx: Ctx, winner: string): void {
  ctx.s.phase = { kind: "over" }
  emit(ctx, { kind: "over", winner })
}

/**
 * `playerId` drew the Exploding Kitten `kitten` and cannot defuse it: they are out. Their hand and the Kitten go to the discard, the
 * Kitten on top. One player left wins; otherwise the next one starts a normal turn (the turns the player still owed vanish).
 */
export function eliminate(ctx: Ctx, playerId: string, kitten: number): void {
  const { s } = ctx
  const seat = seatOf(s, playerId)
  const cards = [...s.hands[seat]!, kitten]
  for (const id of cards) s.discard.unshift(id)
  s.hands[seat] = []
  s.out.push(playerId)
  delete s.known[playerId]
  emit(ctx, { kind: "exploded", by: playerId, cards: facesOf(ctx, cards) })
  const alive = livingIds(s)
  if (alive.length === 1) finish(ctx, alive[0]!)
  else advance(ctx)
}

// --- Nope window

/**
 * Opens a Nope window on `pending`: every living player except its author may answer. The cards of the play already sit on the
 * discard.
 */
export function openWindow(ctx: Ctx, pending: Pending): void {
  const responders = livingIds(ctx.s).filter((id) => id !== pending.by)
  ctx.s.phase = { kind: "reaction", pending, nopes: [], passed: openSubmissions<true>(responders) }
}
