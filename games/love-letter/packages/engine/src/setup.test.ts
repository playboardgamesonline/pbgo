import { viewLog } from "@pbgo/engine-kit"
import { describe, expect, it } from "vitest"
import { CATALOGUE } from "./catalogue"
import { GAME } from "./game"
import { MAX_PLAYERS, MIN_PLAYERS, setupGame } from "./setup"
import { kinds, names, newState, players, problems, refusal, seedOf, waiting } from "./test-utils"

// Rulebook, p. 3: setup of a round. Shuffle the 21 cards, set one aside face down (and three more face up at two players), deal one card to each player.

/** The cards left in the deck after the deal, by number of players (p. 3 and the table of the spec): 21 - 1 aside - 3 face up at two players - one in each hand. */
const AFTER_THE_DEAL: Record<number, number> = { 2: 15, 3: 17, 4: 16, 5: 15, 6: 14 }

describe("setting a game up, at every table size", () => {
  for (let n = MIN_PLAYERS; n <= MAX_PLAYERS; n++) {
    it(`deals ${n} players one card each, sets one aside face down${n === 2 ? " and three face up" : ""}, and the first player draws (pp. 3-4)`, () => {
      const state = newState(n, seedOf(n))
      expect(state.seats).toHaveLength(n)
      expect(state.aside).not.toBeNull()
      expect(state.faceUp).toHaveLength(n === 2 ? 3 : 0)
      // the first player has already drawn: the deck holds one card less than after the deal
      expect(state.deck).toHaveLength(AFTER_THE_DEAL[n]! - 1)
      state.hands.forEach((hand, seat) => expect(hand, `seat ${seat}`).toHaveLength(seat === state.turn ? 2 : 1))
      expect(state.areas.every((area) => area.length === 0)).toBe(true)
      expect(state.out.every((out) => !out)).toBe(true)
      expect(state.shielded.every((shielded) => !shielded)).toBe(true)
      expect(state.won).toEqual(Array.from({ length: n }, () => 0))
      expect(state.spies).toEqual(Array.from({ length: n }, () => 0))
      expect(state.round).toBe(1)
      expect(state.stage).toEqual({ kind: "play" })
      expect(problems(state)).toEqual([])
    })
  }

  it("seats 2 to 6 players, the standard game (p. 2)", () => {
    expect([MIN_PLAYERS, MAX_PLAYERS]).toEqual([2, 6])
    expect([GAME.minPlayers, GAME.maxPlayers]).toEqual([2, 6])
  })

  it("holds every one of the 21 cards in one place", () => {
    for (let n = MIN_PLAYERS; n <= MAX_PLAYERS; n++) {
      const state = newState(n, seedOf(n + 20))
      const placed = [...state.deck, state.aside!, ...state.faceUp, ...state.hands.flat(), ...state.areas.flat()]
      expect(new Set(placed).size).toBe(21)
      expect(names(state, placed).sort()).toEqual([...CATALOGUE].sort())
    }
  })

  it("waits for the first player, who plays a card of their two", () => {
    for (let n = MIN_PLAYERS; n <= MAX_PLAYERS; n++) {
      const state = newState(n, seedOf(n))
      expect(waiting(state)).toEqual([state.seats[state.turn]])
    }
  })

  it("draws the first player from the seed, any of the seats (the booklet says the player who last wrote a letter, which a screen cannot know: pp. 3, 16)", () => {
    const firsts = new Set(Array.from({ length: 60 }, (_, i) => newState(5, seedOf(i)).turn))
    expect([...firsts].sort()).toEqual([0, 1, 2, 3, 4])
  })

  it("is the same game for the same seed, and another game for another", () => {
    expect(newState(4, seedOf(3))).toEqual(newState(4, seedOf(3)))
    expect(newState(4, seedOf(3))).not.toEqual(newState(4, seedOf(4)))
  })

  it("gives the cards opaque ids that do not depend on the shuffle: another seed, other ids", () => {
    expect(newState(3, seedOf(1)).ids).not.toEqual(newState(3, seedOf(2)).ids)
    expect(new Set(newState(3, seedOf(1)).ids).size).toBe(21)
  })

  it("does not read Math.random once it has a seed", () => {
    const real = Math.random
    Math.random = () => {
      throw new Error("Math.random was called")
    }
    try {
      expect(() => newState(6, seedOf(5))).not.toThrow()
    } finally {
      Math.random = real
    }
  })

  it("draws a seed of its own when none is given", () => {
    const state = setupGame({ players: players(3) })
    expect(problems(state)).toEqual([])
  })
})

describe("a table the engine cannot play", () => {
  it("is refused with INVALID_PLAYERS: nobody, one player, seven players, the same id twice, an empty id", () => {
    const seated = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `p${i}`, nickname: `P${i}` }))
    expect(refusal(() => setupGame({ players: [], seed: 1 }))).toBe("INVALID_PLAYERS")
    expect(refusal(() => setupGame({ players: seated(1), seed: 1 }))).toBe("INVALID_PLAYERS")
    expect(refusal(() => setupGame({ players: seated(7), seed: 1 }))).toBe("INVALID_PLAYERS")
    expect(refusal(() => setupGame({ players: [...seated(2), { id: "p0", nickname: "Twin" }], seed: 1 }))).toBe("INVALID_PLAYERS")
    expect(refusal(() => setupGame({ players: [{ id: "", nickname: "Nobody" }, ...seated(2)], seed: 1 }))).toBe("INVALID_PLAYERS")
  })
})

describe("what the game says while it is set up", () => {
  it("opens its log with the round, dealt to its first player, and the card that player draws", () => {
    const opening = GAME.setupStep!({ players: players(3), options: {}, seed: seedOf(7) })
    expect(kinds(opening)).toEqual(["round", "draw"])
    const [round, draw] = opening.events
    const first = opening.state.seats[opening.state.turn]!
    expect(round!.event).toEqual({ kind: "round", number: 1, first, faceUp: [] })
    expect(draw!.to).toEqual([first])
    expect(draw!.event).toMatchObject({ kind: "draw", by: first, card: { type: expect.any(String) as unknown as string } })
    // the others read that a card was drawn, never which
    expect(draw!.masked).toEqual({ kind: "draw", by: first })
  })

  it("names the three cards set aside face up at two players, to everybody", () => {
    const opening = GAME.setupStep!({ players: players(2), options: {}, seed: seedOf(8) })
    const [round] = opening.events
    expect(round!.to).toBeUndefined()
    expect((round!.event as { faceUp: unknown[] }).faceUp).toHaveLength(3)
  })

  it("sets up the state setup gives, and says the same every time", () => {
    const args = { players: players(4), options: {}, seed: seedOf(2) }
    expect(GAME.setupStep!(args).state).toEqual(GAME.setup(args))
    expect(GAME.setupStep!(args)).toEqual(GAME.setupStep!(args))
  })

  it("shows the draw to its player only (a viewer reads the entry as `viewLog` gives it)", () => {
    const opening = GAME.setupStep!({ players: players(3), options: {}, seed: seedOf(9) })
    const first = opening.state.seats[opening.state.turn]!
    const read = (viewer: string | null) => viewLog(opening.events, viewer).find((event) => event.kind === "draw")
    expect(read(first)).toHaveProperty("card")
    for (const viewer of opening.state.seats.filter((id) => id !== first)) expect(read(viewer)).toEqual({ kind: "draw", by: first })
    expect(read(null)).toEqual({ kind: "draw", by: first })
  })
})
