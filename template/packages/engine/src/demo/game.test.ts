import { describe, expect, it } from "vitest"
import { EngineError } from "@pbgo/engine-kit"
import { demo } from "./game"
import type { State } from "./types"

const players = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `j${i}`, nickname: `J${i}` }))

function playToEnd(state: State) {
  let e = state
  let garde = 0
  while (e.phase === "playing" && garde++ < 1000) {
    const j = e.players[e.activePlayer]!
    e = demo.apply(e, { type: "playCard", playerId: j.id, cardId: j.hand[0]!.id })
  }
  return e
}

describe("La Plus Haute", () => {
  it("distribue la taille de main demandée, bornée par le paquet", () => {
    expect(demo.setup({ players: players(3), options: { handSize: 5 }, seed: 1 }).players.every((j) => j.hand.length === 5)).toBe(true)
    expect(demo.setup({ players: players(6), options: { handSize: 8 }, seed: 1 }).players.every((j) => j.hand.length === 6)).toBe(true)
  })

  it("refuse de jouer hors de son tour ou une carte absente", () => {
    const e = demo.setup({ players: players(2), options: {}, seed: 2 })
    const other = e.players[(e.activePlayer + 1) % 2]!
    expect(() => demo.apply(e, { type: "playCard", playerId: other.id, cardId: other.hand[0]!.id })).toThrow(EngineError)
    const active = e.players[e.activePlayer]!
    expect(() => demo.apply(e, { type: "playCard", playerId: active.id, cardId: "inconnue" })).toThrow(EngineError)
  })

  it("donne le pli à la plus haute carte (ou la plus basse en variante inversée)", () => {
    for (const inverse of [false, true]) {
      let e = demo.setup({ players: players(3), options: { inverse }, seed: 3 })
      const cards = []
      for (let k = 0; k < 3; k++) {
        const j = e.players[e.activePlayer]!
        cards.push({ playerId: j.id, value: j.hand[0]!.value })
        e = demo.apply(e, { type: "playCard", playerId: j.id, cardId: j.hand[0]!.id })
      }
      const expected = cards.reduce((m, c) => ((inverse ? c.value < m.value : c.value > m.value) ? c : m))
      expect(e.lastTrick?.winnerId).toBe(expected.playerId)
      expect(e.players[e.activePlayer]!.id).toBe(expected.playerId)
    }
  })

  it("enchaîne les manches puis termine, avec des résultats cohérents", () => {
    for (let seed = 0; seed < 30; seed++) {
      const n = 2 + (seed % 5)
      const rounds = 1 + (seed % 3)
      const ended = playToEnd(demo.setup({ players: players(n), options: { rounds, handSize: 4 }, seed }))
      expect(ended.phase).toBe("over")
      expect(ended.players.every((j) => j.pointsPerRound.length === rounds)).toBe(true)
      const view = demo.view(ended, "j0")
      const total = view.results!.players.reduce((a, j) => a + j.total, 0)
      expect(total).toBe(rounds * Math.min(4, Math.floor(40 / n)))
      expect(view.results!.winners.length).toBeGreaterThan(0)
    }
  })

  it("ne montre que sa propre main", () => {
    const e = demo.setup({ players: players(3), options: {}, seed: 4 })
    const view = demo.view(e, "j1")
    expect(view.me?.hand).toEqual(e.players[1]!.hand)
    expect(JSON.stringify(view)).not.toContain(e.players[0]!.hand[0]!.id + '"')
    expect(demo.view(e, null).me).toBeNull()
  })

  it("commandes de debug", () => {
    const e = demo.setup({ players: players(3), options: {}, seed: 5 })
    expect(demo.debug!.turn!(e).lastTrick).not.toBeNull()
    expect(demo.debug!.over!(e).phase).toBe("over")
  })
})
