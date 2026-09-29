import { describe, expect, it } from "vitest"
import { applyAction, availableZones } from "./actions"
import { type Rng, createRng } from "./rng"
import { setupGame } from "./setup"
import { testMissions } from "./test-utils"
import type { Target, GameState } from "./types"
import { playerView } from "./view"

function randomMove(state: GameState, rng: Rng): GameState {
  const player = state.players[state.activePlayer]!
  const card = player.hand[Math.floor(rng() * player.hand.length)]!
  const zone = availableZones(state)[0]!
  const opponents = state.players.filter((j) => j.id !== player.id)
  const target: Target =
    zone === "table"
      ? { zone: "table", level: rng() < 0.5 ? "up" : "down" }
      : { zone: "domain", playerId: zone === "domain" ? player.id : opponents[Math.floor(rng() * opponents.length)]!.id }

  let victimId: string | undefined
  if (card.role === "assassin") {
    const cards = target.zone === "table" ? state.table.map((p) => p.card) : state.players.find((j) => j.id === target.playerId)!.domain
    victimId = cards.find((c) => c.role !== "guard")?.id
  }
  return applyAction(state, { type: "playCard", playerId: player.id, cardId: card.id, target, victimId })
}

describe("simulation", () => {
  it.each([2, 3, 4, 5])("plays full random games with %i players", (n) => {
    for (let seed = 1; seed <= 20; seed++) {
      const rng = createRng(seed * 31 + n)
      let state = setupGame({
        players: Array.from({ length: n }, (_, i) => ({ id: `p${i}`, nickname: `P${i}` })),
        missions: testMissions(),
        rng,
      })
      for (const j of state.players) state = applyAction(state, { type: "readMissions", playerId: j.id })

      let moves = 0
      while (state.phase === "playing") {
        state = randomMove(state, rng)
        expect(++moves).toBeLessThan(200)
      }

      const total =
        state.table.length + state.eliminated.length + state.setAside.length + state.players.reduce((s, j) => s + j.domain.length, 0)
      expect(total).toBe(90)
      expect(state.players.every((j) => j.hand.length === 0)).toBe(true)
      expect(playerView(state, "p0").results?.winners.length).toBeGreaterThan(0)
    }
  })
})
