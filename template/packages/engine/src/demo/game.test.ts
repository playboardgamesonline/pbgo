import { describe, expect, it } from "vitest"
import { playFor, playOn, waitingPlayers } from "@pbgo/engine-kit"
import { demo } from "./game"
import type { Action, State } from "./types"

const players = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `j${i}`, nickname: `J${i}` }))
const bid = (state: State, playerId: string, amount: number) => demo.apply(state, { type: "bid", playerId, amount })

describe("La Plus Haute", () => {
  it("deals the requested hand size, capped by the deck", () => {
    expect(demo.setup({ players: players(3), options: { handSize: 5 }, seed: 1 }).players.every((j) => j.hand.length === 5)).toBe(true)
    expect(demo.setup({ players: players(6), options: { handSize: 8 }, seed: 1 }).players.every((j) => j.hand.length === 6)).toBe(true)
  })

  it("rejects playing out of turn or playing a missing card", () => {
    const e = demo.setup({ players: players(2), options: { bids: false }, seed: 2 })
    const other = e.players[(e.activePlayer + 1) % 2]!
    expect(() => demo.apply(e, { type: "playCard", playerId: other.id, cardId: other.hand[0]!.id })).toThrow(expect.objectContaining({ code: "NOT_YOUR_TURN" }))
    const active = e.players[e.activePlayer]!
    expect(() => demo.apply(e, { type: "playCard", playerId: active.id, cardId: "inconnue" })).toThrow(expect.objectContaining({ code: "UNKNOWN_CARD" }))
  })

  it("awards the trick to the highest card (or the lowest in the inverted variant)", () => {
    for (const inverse of [false, true]) {
      let e = demo.setup({ players: players(3), options: { inverse, bids: false }, seed: 3 })
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

  it("runs the rounds in sequence then ends, with consistent results", () => {
    for (let seed = 0; seed < 30; seed++) {
      const n = 2 + (seed % 5)
      const rounds = 1 + (seed % 3)
      const ended = playOn(demo, demo.setup({ players: players(n), options: { rounds, handSize: 4, bids: false }, seed }))
      expect(ended.phase).toBe("over")
      expect(ended.players.every((j) => j.pointsPerRound.length === rounds)).toBe(true)
      const view = demo.view(ended, "j0")
      const total = view.results!.players.reduce((a, j) => a + j.total, 0)
      expect(total).toBe(rounds * Math.min(4, Math.floor(40 / n)))
      expect(view.results!.winners.length).toBeGreaterThan(0)
    }
  })

  it("shows only the player's own hand", () => {
    const e = demo.setup({ players: players(3), options: {}, seed: 4 })
    const view = demo.view(e, "j1")
    expect(view.me?.hand).toEqual(e.players[1]!.hand)
    expect(JSON.stringify(view)).not.toContain(e.players[0]!.hand[0]!.id + '"')
    expect(demo.view(e, null).me).toBeNull()
  })

  it("debug commands", () => {
    for (const bids of [true, false]) {
      const e = demo.setup({ players: players(3), options: { bids }, seed: 5 })
      expect(demo.debug!.turn!(e).lastTrick).not.toBeNull()
      expect(demo.debug!.over!(e).phase).toBe("over")
    }
  })
})

describe("secret bids", () => {
  const open = (n = 3, seed = 7) => demo.setup({ players: players(n), options: {}, seed })

  it("opens every round with the bidding step, or goes straight to play without the option", () => {
    const e = open()
    expect(e.phase).toBe("bidding")
    expect(e.bids).toEqual({ j0: null, j1: null, j2: null })
    const off = demo.setup({ players: players(3), options: { bids: false }, seed: 7 })
    expect(off.phase).toBe("playing")
    expect(off.bids).toEqual({})

    let next = demo.setup({ players: players(3), options: { rounds: 2, handSize: 3 }, seed: 7 })
    for (const j of next.players) next = bid(next, j.id, 0)
    next = playOn(demo, next, 9)
    expect(next.round).toBe(2)
    expect(next.phase).toBe("bidding")
    expect(next.bids).toEqual({ j0: null, j1: null, j2: null })
  })

  it("keeps the bids out of the views until everybody has bid", () => {
    let e = bid(open(), "j0", 2)
    const seen = demo.view(e, "j1")
    expect(seen.players.map((p) => p.hasBid)).toEqual([true, false, false])
    expect(seen.players.every((p) => p.bid === null)).toBe(true)
    expect(seen.me?.bid).toBeNull()
    expect(demo.view(e, "j0").me?.bid).toBe(2)
    expect(demo.view(e, "j0").players.every((p) => p.bid === null)).toBe(true)
    expect(demo.view(e, null).players.every((p) => p.bid === null)).toBe(true)

    e = bid(bid(e, "j1", 0), "j2", 1)
    expect(demo.view(e, "j1").players.map((p) => p.bid)).toEqual([2, 0, 1])
    expect(demo.view(e, null).players.map((p) => p.bid)).toEqual([2, 0, 1])
  })

  it("lets a player change their bid until the last one arrives, then starts play in the same action", () => {
    let e = bid(bid(open(), "j0", 1), "j0", 3)
    expect(e.bids.j0).toBe(3)
    e = bid(e, "j1", 0)
    expect(e.phase).toBe("bidding")
    e = bid(e, "j2", 2)
    expect(e.phase).toBe("playing")
    expect(e.bids).toEqual({ j0: 3, j1: 0, j2: 2 })
    expect(() => bid(e, "j0", 1)).toThrow(expect.objectContaining({ code: "INVALID_PHASE" }))
  })

  it("rejects an invalid bid, a card played during the step and a bid during play", () => {
    const e = open()
    const size = e.players[0]!.hand.length
    for (const amount of [-1, size + 1, 1.5, Number.NaN]) {
      expect(() => bid(e, "j0", amount)).toThrow(expect.objectContaining({ code: "INVALID_BID" }))
    }
    expect(() => bid(e, "nobody", 1)).toThrow(expect.objectContaining({ code: "UNKNOWN_PLAYER" }))
    expect(bid(e, "j0", size).bids.j0).toBe(size)
    expect(bid(e, "j0", 0).bids.j0).toBe(0)
    const playCard: Action = { type: "playCard", playerId: "j0", cardId: e.players[0]!.hand[0]!.id }
    expect(() => demo.apply(e, playCard)).toThrow(expect.objectContaining({ code: "INVALID_PHASE" }))
    const off = demo.setup({ players: players(3), options: { bids: false }, seed: 7 })
    expect(() => bid(off, "j0", 1)).toThrow(expect.objectContaining({ code: "INVALID_PHASE" }))
  })

  it("adds a point to every exact bid at the end of the round", () => {
    for (let seed = 0; seed < 10; seed++) {
      const n = 2 + (seed % 4)
      const options = { rounds: 1, handSize: 4 }
      // same deal, same cards played: the tricks each player wins do not depend on the bids
      const reference = playOn(demo, demo.setup({ players: players(n), options: { ...options, bids: false }, seed }))
      const tricks = reference.players.map((j) => j.pointsPerRound[0]!)

      let e = demo.setup({ players: players(n), options, seed })
      const exact = e.players.map((_, i) => i % 2 === 0)
      const size = e.players[0]!.hand.length
      e.players.forEach((j, i) => {
        e = bid(e, j.id, exact[i] ? tricks[i]! : (tricks[i]! + 1) % (size + 1))
      })
      const ended = playOn(demo, e)
      expect(ended.phase).toBe("over")
      expect(ended.players.map((j) => j.pointsPerRound[0])).toEqual(tricks.map((t, i) => t + (exact[i] ? 1 : 0)))
    }
  })

  it("waits for the players who have not bid yet, then for the active player, then for nobody", () => {
    let e = open()
    expect(demo.waitingFor!(e)).toEqual(["j0", "j1", "j2"])
    e = bid(e, "j1", 1)
    expect(demo.waitingFor!(e)).toEqual(["j0", "j2"])
    e = bid(bid(e, "j2", 1), "j0", 1)
    expect(demo.waitingFor!(e)).toEqual([e.players[e.activePlayer]!.id])
    expect(waitingPlayers(demo, e)).toEqual([e.players[e.activePlayer]!.id])
    const ended = playOn(demo, e)
    expect(demo.waitingFor!(ended)).toEqual([])
    expect(waitingPlayers(demo, ended)).toEqual([])
  })

  it("lists the pending players in seat order, not in the order of the keys of the stored bids", () => {
    const seated = [
      { id: "long-id", nickname: "A" },
      { id: "x1", nickname: "B" },
      { id: "x0", nickname: "C" },
    ]
    const e = demo.setup({ players: seated, options: {}, seed: 7 })
    // the database gives the keys of an object back shortest first, then alphabetically
    const stored: State = { ...e, bids: JSON.parse('{"x0":null,"x1":null,"long-id":null}') as State["bids"] }
    expect(demo.waitingFor!(stored)).toEqual(["long-id", "x1", "x0"])
  })

  it("plays a bid for one waiting player and refuses anyone else", () => {
    const e = open()
    const size = e.players[0]!.hand.length
    const played = playFor(demo, e, "j1")
    expect(played.bids).toEqual({ j0: null, j1: Math.floor(size / 3), j2: null })
    expect(played.phase).toBe("bidding")
    expect(playFor(demo, e, "j1")).toEqual(played)
    expect(() => demo.autoPlayFor!(played, "j1")).toThrow(expect.objectContaining({ code: "NOT_WAITING" }))
    expect(() => playFor(demo, played, "j1")).toThrow(expect.objectContaining({ code: "NOT_WAITING" }))

    const playing = playOn(demo, e, 3)
    const active = playing.players[playing.activePlayer]!.id
    const other = playing.players.find((j) => j.id !== active)!.id
    expect(() => demo.autoPlayFor!(playing, other)).toThrow(expect.objectContaining({ code: "NOT_WAITING" }))
    expect(playFor(demo, playing, active).trick).toHaveLength(1)
  })

  it("plays whole games for 2 to 6 players, bids included", () => {
    for (let seed = 0; seed < 30; seed++) {
      const n = 2 + (seed % 5)
      const rounds = 1 + (seed % 3)
      const ended = playOn(demo, demo.setup({ players: players(n), options: { rounds, handSize: 4 }, seed }))
      expect(ended.phase).toBe("over")
      expect(ended.players.every((j) => j.pointsPerRound.length === rounds)).toBe(true)
      const tricks = rounds * Math.min(4, Math.floor(40 / n))
      const total = demo.view(ended, "j0").results!.players.reduce((a, j) => a + j.total, 0)
      // the tricks of every round, plus at most one point per player and per round for an exact bid
      expect(total).toBeGreaterThanOrEqual(tricks)
      expect(total).toBeLessThanOrEqual(tricks + rounds * n)
    }
  })

  it("refuses an unknown action", () => {
    expect(() => demo.apply(open(), { type: "unknown", playerId: "j0" } as unknown as Action)).toThrow(expect.objectContaining({ code: "INVALID_ACTION" }))
  })
})
