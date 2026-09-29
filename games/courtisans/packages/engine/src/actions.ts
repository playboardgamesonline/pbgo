import { HAND_SIZE } from "./deck"
import { EngineError } from "./errors"
import type { Action, Target, Courtier, GameState, PlayZone } from "./types"

export function applyAction(state: GameState, action: Action): GameState {
  const next = structuredClone(state)
  switch (action.type) {
    case "readMissions":
      readMissions(next, action.playerId)
      break
    case "playCard":
      playCard(next, action.playerId, action.cardId, action.target, action.victimId)
      break
  }
  return next
}

function readMissions(state: GameState, playerId: string) {
  if (state.phase === "over") throw new EngineError("INVALID_PHASE")
  const player = state.players.find((j) => j.id === playerId)
  if (!player) throw new EngineError("UNKNOWN_PLAYER")
  player.missionsRead = true
  if (state.players.every((j) => j.missionsRead)) state.phase = "playing"
}

export function zoneOfTarget(state: GameState, playerId: string, target: Target): PlayZone {
  if (target.zone === "table") return "table"
  if (!state.players.some((j) => j.id === target.playerId)) throw new EngineError("UNKNOWN_PLAYER")
  return target.playerId === playerId ? "domain" : "opponentDomain"
}

export function availableZones(state: GameState): PlayZone[] {
  return (["table", "domain", "opponentDomain"] as const).filter((z) => !state.playedZones.includes(z))
}

export function activePlayerId(state: GameState): string | null {
  return state.phase === "playing" ? (state.players[state.activePlayer]?.id ?? null) : null
}

function playCard(state: GameState, playerId: string, cardId: string, target: Target, victimId?: string) {
  if (state.phase !== "playing") throw new EngineError("INVALID_PHASE")
  const player = state.players[state.activePlayer]
  if (!player || player.id !== playerId) throw new EngineError("NOT_YOUR_TURN")

  const index = player.hand.findIndex((c) => c.id === cardId)
  const card = player.hand[index]
  if (!card) throw new EngineError("UNKNOWN_CARD")

  const zone = zoneOfTarget(state, playerId, target)
  if (state.playedZones.includes(zone)) throw new EngineError("ZONE_ALREADY_PLAYED")
  if (victimId && card.role !== "assassin") throw new EngineError("INVALID_ASSASSINATION")

  player.hand.splice(index, 1)
  if (target.zone === "table") state.table.push({ card, level: target.level })
  else state.players.find((j) => j.id === target.playerId)!.domain.push(card)
  state.log.push({ type: "cardPlayed", playerId, card, target })

  if (victimId) assassinate(state, playerId, card, target, victimId)

  state.playedZones.push(zone)
  if (state.playedZones.length === 3 || player.hand.length === 0) endTurn(state)
}

function assassinate(state: GameState, playerId: string, assassin: Courtier, target: Target, victimId: string) {
  if (victimId === assassin.id) throw new EngineError("INVALID_ASSASSINATION")

  let victim: Courtier | undefined
  let victimTarget: Target
  if (target.zone === "table") {
    const i = state.table.findIndex((p) => p.card.id === victimId)
    const placement = state.table[i]
    if (!placement || placement.card.role === "guard") throw new EngineError("INVALID_ASSASSINATION")
    state.table.splice(i, 1)
    victim = placement.card
    victimTarget = { zone: "table", level: placement.level }
  } else {
    const domain = state.players.find((j) => j.id === target.playerId)!.domain
    const i = domain.findIndex((c) => c.id === victimId)
    victim = domain[i]
    if (!victim || victim.role === "guard") throw new EngineError("INVALID_ASSASSINATION")
    domain.splice(i, 1)
    victimTarget = target
  }

  state.eliminated.push(victim)
  state.log.push({ type: "cardEliminated", playerId, card: victim, target: victimTarget })
}

function endTurn(state: GameState) {
  const player = state.players[state.activePlayer]!
  const drawn = state.deck.splice(0, HAND_SIZE)
  if (drawn.length > 0) {
    player.hand.push(...drawn)
    state.log.push({ type: "draw", playerId: player.id, count: drawn.length })
  }
  state.playedZones = []

  const total = state.players.length
  for (let step = 1; step <= total; step++) {
    const candidate = (state.activePlayer + step) % total
    if (state.players[candidate]!.hand.length > 0) {
      state.activePlayer = candidate
      state.turnNumber++
      return
    }
  }
  state.phase = "over"
  state.log.push({ type: "gameOver" })
}
