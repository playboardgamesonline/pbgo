import { describe, expect, it } from "vitest"
import { beginOf, deadlineOf, deadlineIn, playFor, playOn, playStepFor, progressOf, settleDeadlines, setupOf, stepOf, SYSTEM_PLAYER, systemAction, viewLog, waitingPlayers } from "@pbgo/engine-kit"
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

  it("carries no text: the words of its options and of its score lines are the game's, in its Sanity", () => {
    for (const [key, def] of Object.entries(demo.options)) {
      expect(def, key).not.toHaveProperty("label")
      expect(def, key).not.toHaveProperty("help")
    }
    const ended = playOn(demo, demo.setup({ players: players(3), options: { rounds: 3, handSize: 4, bids: false }, seed: 5 }))
    const lines = demo.view(ended, "j0").results!.players.flatMap((j) => j.detail)
    expect(lines).toHaveLength(9)
    for (const line of lines) {
      expect(line).not.toHaveProperty("label")
      expect(demo.scoreLines).toContain(line.key)
    }
    expect(lines.slice(0, 3).map((l) => l.values)).toEqual([{ n: 1 }, { n: 2 }, { n: 3 }])
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

describe("what the game says happened", () => {
  it("opens the log with the first round, dealt while the game is set up", () => {
    const table = { players: players(3), options: {}, seed: 4 }
    const opened = setupOf(demo, table)
    expect(opened.state).toEqual(demo.setup(table))
    expect(opened.events).toEqual([{ event: { type: "newRound", round: 1 } }])
  })

  it("says each card played, then the trick it completes, and the new round when the last trick ends one", () => {
    let e = demo.setup({ players: players(2), options: { bids: false, rounds: 2, handSize: 3 }, seed: 5 })
    const said: string[] = []
    while (e.phase !== "over") {
      const j = e.players[e.activePlayer]!
      const played = stepOf(demo, e, { type: "playCard", playerId: j.id, cardId: j.hand[0]!.id })
      said.push(played.events.map(({ event }) => event.type).join("+"))
      e = played.state
    }
    // two players, three cards, two rounds: a card, then a card that completes the trick, six times; the third trick of the first round starts the second
    expect(said).toEqual(["cardPlayed", "cardPlayed+trickWon", "cardPlayed", "cardPlayed+trickWon", "cardPlayed", "cardPlayed+trickWon+newRound", "cardPlayed", "cardPlayed+trickWon", "cardPlayed", "cardPlayed+trickWon", "cardPlayed", "cardPlayed+trickWon"])
  })

  it("plays through step and autoPlayStep as it does through apply and autoPlayFor", () => {
    let e = demo.setup({ players: players(3), options: {}, seed: 6 })
    while (e.phase !== "over") {
      const [next] = waitingPlayers(demo, e)
      const stepped = playStepFor(demo, e, next!)
      expect(stepped.state).toEqual(playFor(demo, e, next!))
      e = stepped.state
    }
  })

  it("keeps the log out of the state and out of the view: the platform keeps it", () => {
    const e = demo.setup({ players: players(2), options: { bids: false }, seed: 7 })
    expect(Object.keys(e)).not.toContain("log")
    expect(Object.keys(demo.view(e, "j0"))).not.toContain("log")
  })

  it("says everything to everybody: none of its events is for some players only", () => {
    let e = demo.setup({ players: players(3), options: { bids: false }, seed: 8 })
    const j = e.players[e.activePlayer]!
    const played = stepOf(demo, e, { type: "playCard", playerId: j.id, cardId: j.hand[0]!.id })
    e = played.state
    expect(viewLog(played.events, null)).toEqual(played.events.map(({ event }) => event))
  })
})

describe("how far the game has come", () => {
  it("goes from 0 to 100 with the cards played, never back, and is 100 once the game is over", () => {
    for (const bids of [true, false]) {
      let e = demo.setup({ players: players(3), options: { bids, rounds: 3, handSize: 4 }, seed: 12 })
      expect(demo.progress!(e)).toBe(0)
      let previous = 0
      while (e.phase !== "over") {
        e = playFor(demo, e, waitingPlayers(demo, e)[0]!)
        const now = progressOf(demo, e)!
        expect(now).toBeGreaterThanOrEqual(previous)
        previous = now
      }
      expect(progressOf(demo, e)).toBe(100)
    }
  })

  it("is halfway through a game of two rounds when the first is played", () => {
    let e = demo.setup({ players: players(2), options: { bids: false, rounds: 2, handSize: 3 }, seed: 5 })
    while (e.round === 1) e = playFor(demo, e, waitingPlayers(demo, e)[0]!)
    expect(Math.round(demo.progress!(e))).toBe(50)
  })
})

describe("the turn timer", () => {
  const SECONDS = 10
  const T0 = 1_700_000_000_000
  const table = (options: Record<string, number | boolean> = {}, seed = 6) => beginOf(demo, demo.setup({ players: players(3), options: { turnSeconds: SECONDS, ...options }, seed }), T0)
  const timeout = (at: number): Action => ({ ...systemAction("timeout", at) }) as Action

  it("is off unless the table asks for it: no clock, no deadline, nothing in the view", () => {
    const plain = beginOf(demo, demo.setup({ players: players(3), options: {}, seed: 6 }), T0)
    expect(plain.timer).toBeNull()
    expect(deadlineOf(demo, plain)).toBeNull()
    expect(demo.view(plain, "j0").timer).toBeNull()
    // And a move at a time changes nothing about that
    const moved = demo.apply(bid(plain, waitingPlayers(demo, plain)[0]!, 0), { type: "bid", playerId: waitingPlayers(demo, plain)[0]!, amount: 1, at: T0 + 500 })
    expect(moved.timer).toBeNull()
  })

  it("starts the clock of the first step when the game goes live, not when it is set up", () => {
    const opened = demo.setup({ players: players(3), options: { turnSeconds: SECONDS }, seed: 6 })
    expect(opened.timer).toBeNull()
    expect(deadlineOf(demo, opened)).toBeNull()
    const live = beginOf(demo, opened, T0)
    expect(live.timer).toEqual({ endsAt: T0 + SECONDS * 1000, seconds: SECONDS })
    expect(deadlineOf(demo, live)).toEqual({ at: T0 + SECONDS * 1000, action: { type: "timeout", playerId: SYSTEM_PLAYER, at: T0 + SECONDS * 1000 } })
    expect(deadlineIn(demo, live, T0 + 4_000)).toBe(6_000)
    // Going live again later starts it again from then, and changes nothing else
    expect(beginOf(demo, live, T0 + 5_000)).toEqual({ ...live, timer: { endsAt: T0 + 5_000 + SECONDS * 1000, seconds: SECONDS } })
  })

  it("tells the board how long a step lasts, never when it ends", () => {
    const view = demo.view(table({ bids: false }), "j0")
    expect(view.timer).toEqual({ seconds: SECONDS })
    expect(JSON.stringify(view)).not.toContain(String(T0))
  })

  it("starts the clock of the next turn from the time of the card that was played", () => {
    const state = table({ bids: false })
    const active = state.players[state.activePlayer]!
    const next = demo.apply(state, { type: "playCard", playerId: active.id, cardId: active.hand[0]!.id, at: T0 + 3_000 })
    expect(next.timer).toEqual({ endsAt: T0 + 3_000 + SECONDS * 1000, seconds: SECONDS })
  })

  it("lets the clock of a step run on while the step stays the same: a bid does not start the clock of the others", () => {
    const state = table()
    expect(state.phase).toBe("bidding")
    const [first] = waitingPlayers(demo, state)
    const next = demo.apply(state, { type: "bid", playerId: first!, amount: 1, at: T0 + 4_000 })
    expect(next.phase).toBe("bidding")
    expect(next.timer).toEqual(state.timer)
  })

  it("starts the clock of the playing step when the last bid ends the bidding", () => {
    let state = table()
    const ids = waitingPlayers(demo, state)
    ids.forEach((id, i) => {
      state = demo.apply(state, { type: "bid", playerId: id, amount: 1, at: T0 + 1_000 * (i + 1) })
    })
    expect(state.phase).toBe("playing")
    expect(state.timer).toEqual({ endsAt: T0 + 3_000 + SECONDS * 1000, seconds: SECONDS })
  })

  it("plays for the player whose turn ran out, at the time of the deadline, and starts the next clock from it", () => {
    const state = table({ bids: false })
    const active = state.players[state.activePlayer]!
    const due = state.timer!.endsAt
    const { state: next, events } = stepOf(demo, state, timeout(due))
    // The first card of the hand was played for them, as for an absent player
    expect(next.trick).toEqual([{ playerId: active.id, card: active.hand[0] }])
    expect(events.map(({ event }) => event.type)).toEqual(["cardPlayed"])
    expect(next.timer).toEqual({ endsAt: due + SECONDS * 1000, seconds: SECONDS })
    // It is the next player's turn, and the clock did not play for them as well
    expect(waitingPlayers(demo, next)).toEqual([next.players[next.activePlayer]!.id])
  })

  it("plays for every player who owes a bid when the step runs out", () => {
    const state = table()
    const [first, ...others] = waitingPlayers(demo, state)
    const partly = demo.apply(state, { type: "bid", playerId: first!, amount: 2, at: T0 + 1_000 })
    const next = demo.apply(partly, timeout(state.timer!.endsAt))
    expect(next.phase).toBe("playing")
    // Their own bid is kept, and the others were played for
    expect(next.bids[first!]).toBe(2)
    for (const id of others) expect(next.bids[id]).toBe(Math.floor(next.players[0]!.hand.length / 3))
    expect(next.timer).toEqual({ endsAt: state.timer!.endsAt + SECONDS * 1000, seconds: SECONDS })
  })

  it("is refused to a seat: only the clock may play a timeout", () => {
    const state = table()
    for (const playerId of ["j0", "j1", "stranger"]) expect(() => demo.apply(state, { type: "timeout", playerId, at: state.timer!.endsAt })).toThrow(expect.objectContaining({ code: "INVALID_ACTION" }))
  })

  it("is refused when no clock is running", () => {
    const plain = demo.setup({ players: players(3), options: {}, seed: 6 })
    expect(() => demo.apply(plain, timeout(T0))).toThrow(expect.objectContaining({ code: "INVALID_ACTION" }))
  })

  it("is not an action a client may send", () => {
    expect(demo.clientActions).not.toContain("timeout")
  })

  it("plays a table that nobody looked at for a long time to its end, one deadline after the other, and has no clock then", () => {
    const state = table({ rounds: 1, handSize: 3 })
    const settled = settleDeadlines(demo, state, T0 + 24 * 3600 * 1000)
    expect(settled.state.phase).toBe("over")
    expect(settled.state.timer).toBeNull()
    expect(deadlineOf(demo, settled.state)).toBeNull()
    // A step per turn of the round, and the bids: 3 players, 3 cards each, then the bidding of the round
    expect(settled.applied).toBe(1 + 9)
    expect(settled.events.length).toBeGreaterThan(0)
  })

  it("is the same game whenever the table is settled: the deadlines are played at their own times", () => {
    const state = table({ rounds: 1, handSize: 3 })
    const late = settleDeadlines(demo, state, T0 + 24 * 3600 * 1000).state
    let along = state
    for (const now of [T0 + 5_000, T0 + 10_000, T0 + 10_001, T0 + 37_000, T0 + 40_000, T0 + 24 * 3600 * 1000]) along = settleDeadlines(demo, along, now).state
    expect(along).toEqual(late)
  })

  it("replays the same game from the same seed and the same timestamped moves", () => {
    const play = () => {
      let state = table({ bids: false })
      let clock = T0
      for (let i = 0; i < 6 && state.phase !== "over"; i++) {
        const id = waitingPlayers(demo, state)[0]!
        clock += 1_500
        state = playFor(demo, state, id, clock)
      }
      return state
    }
    expect(play()).toEqual(play())
  })

  it("starts a new round's clock from the card that ended the last one", () => {
    let state = table({ bids: false, rounds: 2, handSize: 3 })
    let clock = T0
    while (state.round === 1) {
      const active = state.players[state.activePlayer]!
      clock += 2_000
      state = demo.apply(state, { type: "playCard", playerId: active.id, cardId: active.hand[0]!.id, at: clock })
    }
    expect(state.timer).toEqual({ endsAt: clock + SECONDS * 1000, seconds: SECONDS })
  })

  it("has no clock for a step that nobody told the time of, rather than one that began in 1970", () => {
    const state = table({ bids: false })
    const active = state.players[state.activePlayer]!
    const next = demo.apply(state, { type: "playCard", playerId: active.id, cardId: active.hand[0]!.id })
    expect(next.timer).toBeNull()
    expect(deadlineOf(demo, next)).toBeNull()
  })
})
