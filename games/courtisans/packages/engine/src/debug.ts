import { applyAction, availableZones } from "./actions"
import type { Target, GameState } from "./types"

export type DebugCommand = "missions" | "turn" | "over"

const random = <T>(list: T[]) => list[Math.floor(Math.random() * list.length)]!

export function autoMove(state: GameState): GameState {
  const player = state.players[state.activePlayer]!
  const card = random(player.hand)
  const zone = availableZones(state)[0]!
  const opponents = state.players.filter((j) => j.id !== player.id)
  const target: Target =
    zone === "table"
      ? { zone: "table", level: Math.random() < 0.5 ? "up" : "down" }
      : { zone: "domain", playerId: zone === "domain" ? player.id : random(opponents).id }
  let victimId: string | undefined
  if (card.role === "assassin") {
    const cards = target.zone === "table" ? state.table.map((p) => p.card) : state.players.find((j) => j.id === target.playerId)!.domain
    victimId = cards.find((c) => c.role !== "guard")?.id
  }
  return applyAction(state, { type: "playCard", playerId: player.id, cardId: card.id, target, victimId })
}

function readAll(state: GameState): GameState {
  let s = state
  for (const j of s.players) if (!j.missionsRead) s = applyAction(s, { type: "readMissions", playerId: j.id })
  return s
}

export function applyDebug(state: GameState, command: DebugCommand): GameState {
  let s = state.phase === "missions" ? readAll(state) : state
  if (command === "turn" && s.phase === "playing") {
    const turn = s.turnNumber
    for (let i = 0; i < 3 && s.phase === "playing" && s.turnNumber === turn; i++) s = autoMove(s)
  }
  if (command === "over") for (let i = 0; i < 400 && s.phase === "playing"; i++) s = autoMove(s)
  return s
}
