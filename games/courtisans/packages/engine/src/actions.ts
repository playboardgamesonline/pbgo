import { EngineError, nextSeat, removeFrom, seatOf } from "@pbgo/engine-kit"
import { HAND_SIZE } from "./catalogue"
import { type Ctx, close, domainOf, emit, handOf, isOver, open, phaseOf, typeOf, visibleCard } from "./machine"
import { type Action, CLIENT_ACTIONS, type ActionOf, type CourtisansStep, type PlayZone, type State, type Target } from "./types"

/**
 * The rules of play. Everything is checked before anything changes: an illegal move is an `EngineError` with a code of the game's list, a bug is a plain error.
 * A step works on a copy of the state (`open`), so a refusal that comes after a change leaves the state the player sent as it was.
 */

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value)

/** A target as a client sends it: the Queen's table above or below the mat, or the domain of a player. Anything else is malformed. */
function parseTarget(value: unknown): Target {
  if (isRecord(value) && value.zone === "table" && (value.level === "up" || value.level === "down")) return { zone: "table", level: value.level }
  if (isRecord(value) && value.zone === "domain" && typeof value.playerId === "string") return { zone: "domain", playerId: value.playerId }
  throw new EngineError("INVALID_ACTION", "The target is the table, above or below the mat, or the domain of a player")
}

/** What a client sent, checked: an action of the game, with the fields its type asks for. Anything else is `INVALID_ACTION`. */
function parse(action: unknown): Action {
  if (!isRecord(action) || typeof action.type !== "string" || !(CLIENT_ACTIONS as readonly string[]).includes(action.type)) {
    throw new EngineError("INVALID_ACTION", "That is not an action of the game")
  }
  const { playerId } = action
  if (typeof playerId !== "string") throw new EngineError("INVALID_ACTION", "An action names the player who sends it")
  if (action.type === "readMissions") return { type: "readMissions", playerId }
  const { cardId, victimId } = action
  if (typeof cardId !== "number" || !Number.isInteger(cardId)) throw new EngineError("INVALID_ACTION", "A card is named by its id")
  if (victimId !== undefined && (typeof victimId !== "number" || !Number.isInteger(victimId))) throw new EngineError("INVALID_ACTION", "A victim is named by its id")
  return { type: "playCard", playerId, cardId, target: parseTarget(action.target), ...(victimId === undefined ? {} : { victimId }) }
}

/** The zone a target is, for the player who plays in it: the table, their own domain, or somebody else's. */
export function zoneOf(s: State, seat: number, target: Target): PlayZone {
  if (target.zone === "table") return "table"
  const owner = seatOf(s.seats, target.playerId)
  if (owner < 0) throw new EngineError("INVALID_TARGET", "That player is not at the table")
  return owner === seat ? "domain" : "opponentDomain"
}

/** A player says that they have read their missions. The banquet starts when every player has; saying it twice counts once. */
export function readMissions(ctx: Ctx, seat: number): void {
  ctx.s.read[seat] = true
}

/**
 * Plays a card, and eliminates one with it when it is an assassin that names a victim. The turn ends when three zones have been played in, or when the player has no card left; the player then draws three
 * cards and the next player who holds a card is up. When nobody does, the game is over.
 */
export function playCard(ctx: Ctx, seat: number, { cardId, target, victimId }: Omit<ActionOf<"playCard">, "type" | "playerId">): void {
  const { s } = ctx
  if (phaseOf(s) !== "playing") throw new EngineError("INVALID_PHASE", "The banquet has not started")
  if (seat !== s.active) throw new EngineError("NOT_YOUR_TURN", "It is not your turn")
  const hand = handOf(s, seat)
  if (!hand.includes(cardId)) throw new EngineError("UNKNOWN_CARD", "That card is not in your hand")
  const zone = zoneOf(s, seat, target)
  if (s.zones.includes(zone)) throw new EngineError("ZONE_ALREADY_PLAYED", "You played a card there already this turn")
  if (victimId !== undefined && typeOf(s, cardId).role !== "assassin") throw new EngineError("INVALID_ASSASSINATION", "Only an assassin eliminates a card")

  const playerId = s.seats[seat]!
  removeFrom(hand, cardId)
  if (target.zone === "table") s.table.push({ card: cardId, level: target.level })
  else domainOf(s, seatOf(s.seats, target.playerId)).push(cardId)
  emit(ctx, { type: "cardPlayed", playerId, card: visibleCard(s, cardId, false), target })

  if (victimId !== undefined) eliminate(ctx, playerId, cardId, target, victimId)

  s.zones.push(zone)
  if (s.zones.length === 3 || hand.length === 0) endTurn(ctx)
}

/** The assassin `assassin`, just played in `target`, eliminates the card `victimId` of that zone: any card but a guard, and not the assassin itself. */
function eliminate(ctx: Ctx, playerId: string, assassin: number, target: Target, victimId: number): void {
  const { s } = ctx
  if (victimId === assassin) throw new EngineError("INVALID_ASSASSINATION", "An assassin does not eliminate itself")
  let victimTarget: Target = target
  if (target.zone === "table") {
    const placement = s.table.find((candidate) => candidate.card === victimId)
    if (!placement || typeOf(s, victimId).role === "guard") throw new EngineError("INVALID_ASSASSINATION", "That card cannot be eliminated")
    s.table.splice(s.table.indexOf(placement), 1)
    victimTarget = { zone: "table", level: placement.level }
  } else {
    const domain = domainOf(s, seatOf(s.seats, target.playerId))
    if (!domain.includes(victimId) || typeOf(s, victimId).role === "guard") throw new EngineError("INVALID_ASSASSINATION", "That card cannot be eliminated")
    removeFrom(domain, victimId)
  }
  s.eliminated.push(victimId)
  emit(ctx, { type: "cardEliminated", playerId, card: visibleCard(s, victimId, false), target: victimTarget })
}

/** The turn is over: the player draws back up to three cards (as many as the deck still holds) and the next player who holds a card is up. A game where nobody does is over. */
function endTurn(ctx: Ctx): void {
  const { s } = ctx
  const playerId = s.seats[s.active]!
  const drawn = s.deck.splice(0, HAND_SIZE)
  if (drawn.length > 0) {
    handOf(s, s.active).push(...drawn)
    emit(ctx, { type: "draw", playerId, count: drawn.length })
  }
  s.zones = []
  const next = nextSeat(s.seats.length, s.active, (seat) => handOf(s, seat).length === 0)
  if (next === null) emit(ctx, { type: "gameOver" })
  else s.active = next
}

/**
 * Plays an action and says what happened. The checks come in this order: the game is not over, the action is well formed, the player is at the table, then the rule of the action itself.
 * `apply` of the definition is `step(state, action).state`.
 */
export function step(state: State, action: Action): CourtisansStep {
  if (isOver(state)) throw new EngineError("GAME_OVER", "The game is over")
  const parsed = parse(action)
  const seat = seatOf(state.seats, parsed.playerId)
  if (seat < 0) throw new EngineError("UNKNOWN_PLAYER", "You are not at this table")
  const ctx = open(state)
  if (parsed.type === "readMissions") readMissions(ctx, seat)
  else playCard(ctx, seat, parsed)
  return close(ctx)
}
