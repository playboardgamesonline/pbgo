import { EngineError, insertAt } from "@pbgo/engine-kit"
import { playCombo } from "./combos"
import {
  type Ctx,
  cardType,
  checkTarget,
  close,
  effectOf,
  eliminate,
  emit,
  endTurn,
  faceOf,
  handOf,
  kindOf,
  lowerKnown,
  open,
  openWindow,
  reinsertKnown,
  reissue,
  removeFrom,
  typeOf,
  waitingFor,
} from "./machine"
import type { Rules } from "./rules"
import { type Action, CLIENT_ACTIONS, type CardPending, type PhaseOf, type State, type Step } from "./types"
import { nope, pass } from "./window"

/**
 * What a player does, one function per action. Every one of them checks what it is given before it changes anything and throws an
 * `EngineError` (the codes are `EK_ERROR_CODES`): `step` works on a copy, so a refusal leaves the state as it was.
 */

/** `by` plays the action card `card` from their hand: it goes to the discard and opens a Nope window. */
function play(ctx: Ctx, by: string, card: number, target: unknown): void {
  const { s } = ctx
  const hand = handOf(s, by)
  if (!hand.includes(card)) throw new EngineError("UNKNOWN_CARD", "That card is not in your hand")
  const type = typeOf(ctx, card)
  if (cardType(ctx.rules, type).kind !== "action") throw new EngineError("NOT_PLAYABLE", "That card is not played on its own")
  const pending: CardPending = { kind: "card", by, card }
  if (effectOf(ctx.rules, type).targeted) pending.target = checkTarget(s, by, target)
  removeFrom(hand, card)
  s.discard.unshift(card)
  emit(ctx, { ...pending, kind: "play", card: faceOf(ctx, card) })
  openWindow(ctx, pending)
}

/**
 * `by` draws the top card of the pile. A card goes into their hand and ends one of their turns. An Exploding Kitten is shown to
 * everyone: a player who holds a Defuse must use it and chooses where the Kitten goes back (`defuse`); a player who holds none is
 * out.
 */
export function draw(ctx: Ctx, by: string): void {
  const { s } = ctx
  const id = s.deck.shift()
  if (id === undefined) throw new EngineError("EMPTY_DECK", "The draw pile is empty")
  lowerKnown(s)
  if (kindOf(ctx, id) !== "kitten") {
    handOf(s, by).push(id)
    emit(ctx, { kind: "draw", by, card: faceOf(ctx, id) }, [by], { kind: "draw", by })
    endTurn(ctx)
    return
  }
  emit(ctx, { kind: "kitten", by, card: faceOf(ctx, id) })
  const hand = handOf(s, by)
  const defuse = hand.find((card) => kindOf(ctx, card) === "defuse")
  if (defuse === undefined) {
    eliminate(ctx, by, id)
    return
  }
  removeFrom(hand, defuse)
  s.discard.unshift(defuse)
  emit(ctx, { kind: "defused", by, card: faceOf(ctx, defuse) })
  s.phase = { kind: "defuse", kitten: id }
}

/**
 * `by` puts the Exploding Kitten back into the pile at `position` (0 is the top). Only they know where; the Kitten comes back under
 * a new id so that nobody can follow it.
 */
export function defuse(ctx: Ctx, by: string, position: number, phase: PhaseOf<"defuse">): void {
  const { s } = ctx
  if (position < 0 || position > s.deck.length) throw new EngineError("BAD_POSITION", `Put the Kitten back between 0 and ${s.deck.length}`)
  s.deck = insertAt(s.deck, reissue(ctx, phase.kitten), position)
  reinsertKnown(s, by, position)
  s.stats[s.turn]!.defused += 1
  s.phase = { kind: "turn" }
  emit(ctx, { kind: "reinserted", by, position }, [by], { kind: "reinserted", by })
  endTurn(ctx)
}

/** `by` answers a Favor: the card they choose goes to the player who asked. Only the two of them see which. */
export function give(ctx: Ctx, by: string, card: number, phase: PhaseOf<"give">): void {
  const { s } = ctx
  const hand = handOf(s, by)
  if (!hand.includes(card)) throw new EngineError("UNKNOWN_CARD", "That card is not in your hand")
  removeFrom(hand, card)
  handOf(s, phase.to).push(card)
  s.phase = { kind: "turn" }
  emit(ctx, { kind: "give", from: by, to: phase.to, card: faceOf(ctx, card) }, [by, phase.to], { kind: "give", from: by, to: phase.to })
}

/** What five different cards may take from the discard: not the five just played, and never an Exploding Kitten. */
export function pickable(ctx: Ctx, phase: PhaseOf<"pick">): number[] {
  return ctx.s.discard.filter((id) => !phase.played.includes(id) && kindOf(ctx, id) !== "kitten")
}

/** `by` takes `card` from the discard. It leaves the discard for their hand under a new id: it is hidden again. */
export function pick(ctx: Ctx, by: string, card: number, phase: PhaseOf<"pick">): void {
  const { s } = ctx
  if (!pickable(ctx, phase).includes(card)) throw new EngineError("INVALID_PICK", "That card cannot be taken from the discard")
  const face = faceOf(ctx, card)
  removeFrom(s.discard, card)
  handOf(s, by).push(reissue(ctx, card))
  s.phase = { kind: "turn" }
  emit(ctx, { kind: "pick", by, card: face })
}

// --- Dispatch

function intField(raw: Record<string, unknown>, key: string): number {
  const value = raw[key]
  if (typeof value !== "number" || !Number.isInteger(value)) throw new EngineError("INVALID_ACTION", `"${key}" must be a whole number`)
  return value
}

function idsField(raw: Record<string, unknown>, key: string): number[] {
  const value: unknown = raw[key]
  if (!Array.isArray(value) || value.some((id) => typeof id !== "number" || !Number.isInteger(id))) {
    throw new EngineError("INVALID_ACTION", `"${key}" must be a list of cards`)
  }
  return value as number[]
}

function isActionType(type: string): type is Action["type"] {
  return (CLIENT_ACTIONS as readonly string[]).includes(type)
}

/**
 * Checks, in this order: the game is not over; the action is well formed; a Nope or a pass answers the window (and only players it
 * waits for may); nothing else happens while a window is open; the game waits for the player; the action belongs to the current
 * phase; then the action's own rules.
 */
export function perform(ctx: Ctx, input: unknown): void {
  const { s } = ctx
  if (s.phase.kind === "over") throw new EngineError("GAME_OVER", "The game is over")
  if (typeof input !== "object" || input === null) throw new EngineError("INVALID_ACTION", "Not an action")
  const raw = input as Record<string, unknown>
  const { playerId: by, type } = raw
  if (typeof by !== "string" || typeof type !== "string" || !isActionType(type)) throw new EngineError("INVALID_ACTION", "Not an action")

  if (type === "nope") {
    nope(ctx, by, intField(raw, "card"), intField(raw, "chain"))
    return
  }
  if (type === "pass") {
    pass(ctx, by, intField(raw, "chain"))
    return
  }
  if (s.phase.kind === "reaction") throw new EngineError("REACTION_OPEN", "A Nope window is open: answer it first")
  if (!waitingFor(s).includes(by)) throw new EngineError("NOT_YOUR_TURN", "It is not your move")

  const { phase } = s
  const wrongPhase = () => new EngineError("INVALID_ACTION", `You cannot ${type} now`)
  switch (type) {
    case "play":
      if (phase.kind !== "turn") throw wrongPhase()
      play(ctx, by, intField(raw, "card"), raw.target)
      return
    case "combo":
      if (phase.kind !== "turn") throw wrongPhase()
      playCombo(ctx, by, idsField(raw, "cards"), raw.target, raw.named)
      return
    case "draw":
      if (phase.kind !== "turn") throw wrongPhase()
      draw(ctx, by)
      return
    case "defuse":
      if (phase.kind !== "defuse") throw wrongPhase()
      defuse(ctx, by, intField(raw, "position"), phase)
      return
    case "give":
      if (phase.kind !== "give") throw wrongPhase()
      give(ctx, by, intField(raw, "card"), phase)
      return
    case "pick":
      if (phase.kind !== "pick") throw wrongPhase()
      pick(ctx, by, intField(raw, "card"), phase)
      return
  }
}

/**
 * Plays one action on `state`. Gives the new state and what happened (the events a log is made of: some of them are for certain
 * players only, see `EkLogEntry`). `state` is never touched. Throws an `EngineError` when the action is refused.
 */
export function step(rules: Rules, state: State, action: Action): Step {
  const ctx = open(rules, state)
  perform(ctx, action)
  return close(ctx)
}
