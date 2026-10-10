import { applyAction, availableZones } from "./actions"
import { type Rng, createRng, sideSeed } from "./rng"
import type { Target, GameState } from "./types"

export type DebugCommand = "missions" | "turn" | "over"

/** Salt of the automatic moves' stream (see `sideSeed`). */
const AUTO_MOVE_STREAM = 2

/**
 * Stream of one automatic move, derived from the game seed and the move's position in the game: replaying the
 * same game always picks the same moves. Games saved without a seed use 0 and stay deterministic.
 */
export function autoMoveRng(state: GameState): Rng {
  return createRng(sideSeed(state.seed ?? 0, AUTO_MOVE_STREAM, state.turnNumber, state.log.length, state.playedZones.length))
}

export function autoMove(state: GameState): GameState {
  const rng = autoMoveRng(state)
  const random = <T>(list: T[]) => list[Math.floor(rng() * list.length)]!
  const player = state.players[state.activePlayer]!
  const card = random(player.hand)
  const zone = availableZones(state)[0]!
  const opponents = state.players.filter((j) => j.id !== player.id)
  const target: Target =
    zone === "table"
      ? { zone: "table", level: rng() < 0.5 ? "up" : "down" }
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
