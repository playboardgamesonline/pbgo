import { viewLog } from "@pbgo/engine-kit"
import { describe, expect, it } from "vitest"
import { step } from "./actions"
import { GAME } from "./game"
import { cardIn, layout, newState, playCard, playRandomly, seedOf, viewOf } from "./test-utils"
import type { PlayerView, State } from "./types"

// Hidden information (rulebook, pp. 4-6): the hands of the other players, the order of the deck and the card set aside face down are hidden; the cards played
// and discarded, the three set aside face up at two players, the tokens, who is out and who is protected are in view of everybody.

/** Every number a view holds, wherever it is: an id is a number, and a hidden one must be in none of them. */
function numbersIn(view: PlayerView): number[] {
  const found: number[] = []
  const walk = (value: unknown) => {
    if (typeof value === "number") found.push(value)
    else if (Array.isArray(value)) value.forEach(walk)
    else if (value !== null && typeof value === "object") Object.values(value).forEach(walk)
  }
  walk(view)
  return found
}

const viewers = (state: State): (string | null)[] => [...state.seats, "stranger", null]

/** What a viewer must not be shown: the deck, the card set aside, and every hand but their own, unless a round that ended on a comparison laid them face up. */
function hiddenFrom(state: State, viewer: string | null): number[] {
  const shown = state.stage.kind === "between" && state.stage.revealed
  const hands = shown ? [] : state.hands.filter((_, seat) => state.seats[seat] !== viewer).flat()
  return [...state.deck, ...(state.aside === null ? [] : [state.aside]), ...hands]
}

describe("what a viewer is shown", () => {
  it("never the id of a card in the deck, the card set aside, or the hand of another player, whoever looks (a stranger and a spectator included)", () => {
    for (const seed of [1, 2, 3]) {
      for (const n of [2, 3, 6]) {
        for (const state of playRandomly(newState(n, seedOf(seed)), seed).filter((_, i) => i % 5 === 0)) {
          for (const viewer of viewers(state)) {
            const mentioned = new Set(numbersIn(viewOf(state, viewer)))
            for (const id of hiddenFrom(state, viewer)) expect(mentioned.has(id), `${n} players, ${viewer} sees ${id}`).toBe(false)
          }
        }
      }
    }
  })

  it("shows a player their own hand face up, the card they drew last, and the hand of each other player as a count (p. 4)", () => {
    const state = layout({ hands: { ana: ["spy", "king"], bob: ["guard"], cleo: ["priest"] }, deck: ["baron"] })
    const view = viewOf(state, "ana")
    expect(view.me!.hand.map((face) => face.type)).toEqual(["spy", "king"])
    expect(view.players.map((player) => player.cards)).toEqual([2, 1, 1])
    expect(view.players.every((player) => player.hand === null)).toBe(true)
    expect(JSON.stringify(view.players)).not.toContain('"king"')
  })

  it("shows the cards played, face up, to everybody (p. 5)", () => {
    const state = playCard(layout({ hands: { ana: ["spy", "king"], bob: ["guard"] }, deck: ["baron", "priest"] }), "ana", "spy")
    for (const viewer of viewers(state)) expect(viewOf(state, viewer).players[0]!.area.map((face) => face.type), String(viewer)).toEqual(["spy"])
  })

  it("shows the deck as its size and the card set aside face down as one card, never which (p. 3)", () => {
    const state = newState(4, seedOf(4))
    for (const viewer of viewers(state)) {
      const view = viewOf(state, viewer)
      expect(view.deck).toEqual({ size: 15 })
      expect(view.aside).toBe(1)
      expect(Object.keys(view.deck)).toEqual(["size"])
    }
  })

  it("shows the three cards set aside face up at two players to everybody, and none at the other tables (p. 3)", () => {
    const two = newState(2, seedOf(5))
    for (const viewer of viewers(two)) expect(viewOf(two, viewer).faceUp.map((face) => face.id)).toEqual(two.faceUp)
    expect(viewOf(two, null).faceUp).toHaveLength(3)
    expect(viewOf(newState(3, seedOf(5)), null).faceUp).toEqual([])
  })

  it("gives a spectator, and a player who is not at the table, no hand of their own", () => {
    const state = newState(3, seedOf(6))
    expect(viewOf(state, null).me).toBeNull()
    expect(viewOf(state, "stranger").me).toBeNull()
    expect(viewOf(state, "ana").me).not.toBeNull()
  })

  it("lists what a player may play: their whole hand on their turn, nothing on another's", () => {
    const state = layout({ hands: { ana: ["spy", "king"], bob: ["guard"] }, deck: ["baron"] })
    const ana = viewOf(state, "ana").me!
    expect(ana.playable).toEqual(ana.hand.map((face) => face.id))
    expect(viewOf(state, "bob").me!.playable).toEqual([])
    expect(viewOf(state, null).me).toBeNull()
  })

  it("is the same for everybody but the hand of the viewer", () => {
    const state = playCard(layout({ hands: { ana: ["spy", "king"], bob: ["guard"], cleo: ["priest"] }, deck: ["baron", "spy"] }), "ana", "spy")
    const bare = (viewer: string | null) => ({ ...viewOf(state, viewer), me: null })
    for (const viewer of viewers(state)) expect(bare(viewer)).toEqual(bare(null))
  })

  it("carries the tokens as standings, one for each seat in seat order, the same for every viewer (the list of the players of the HUD)", () => {
    const state = layout({ players: 4, won: { bob: 2 }, spies: { cleo: 1 } })
    for (const viewer of viewers(state)) {
      expect(viewOf(state, viewer).standings, String(viewer)).toEqual([
        { playerId: "ana", score: 0 },
        { playerId: "bob", score: 2 },
        { playerId: "cleo", score: 1 },
        { playerId: "dan", score: 0 },
      ])
    }
  })

  it("says whose turn it is, the players a card can pick, and the number of tokens that win (p. 7)", () => {
    for (let n = 2; n <= 6; n++) {
      const state = newState(n, seedOf(n))
      const view = viewOf(state, null)
      expect(view.phase).toEqual({ kind: "turn", player: state.seats[state.turn], targets: state.seats.filter((_, seat) => seat !== state.turn) })
      expect(view.target).toBe([6, 5, 4, 3, 3][n - 2])
      expect(view.round).toBe(1)
    }
  })
})

describe("what the log says to each viewer", () => {
  it("shows the card a player drew to them alone, and to the others that one was drawn", () => {
    const state = layout({ hands: { ana: ["spy", "king"], bob: ["guard"] }, deck: ["baron", "spy"] })
    const { events } = GAME.step!(state, { type: "play", playerId: "ana", card: cardIn(state, "ana", "spy") })
    const read = (viewer: string | null) => viewLog(events, viewer).filter((event) => event.kind === "draw")
    expect(read("bob")).toEqual([{ kind: "draw", by: "bob", card: expect.objectContaining({ type: "baron" }) as unknown }])
    expect(read("ana")).toEqual([{ kind: "draw", by: "bob" }])
    expect(read("cleo")).toEqual([{ kind: "draw", by: "bob" }])
    expect(read(null)).toEqual([{ kind: "draw", by: "bob" }])
    expect(read("stranger")).toEqual([{ kind: "draw", by: "bob" }])
  })

  it("shows every viewer the card played, face up, the same", () => {
    const state = layout({ hands: { ana: ["spy", "king"], bob: ["guard"] }, deck: ["baron", "spy"] })
    const { events } = step(state, { type: "play", playerId: "ana", card: cardIn(state, "ana", "spy") })
    const plays = (viewer: string | null) => viewLog(events, viewer).filter((event) => event.kind === "play")
    for (const viewer of viewers(state)) expect(plays(viewer), String(viewer)).toEqual(plays(null))
  })

  it("names the hands that every player still in lays face up at the end of a round to everybody (p. 6)", () => {
    const state = layout({ hands: { ana: ["countess", "guard"], bob: ["priest"], cleo: ["baron"] }, deck: [], rest: "away" })
    const { events } = GAME.step!(state, { type: "play", playerId: "ana", card: cardIn(state, "ana", "countess") })
    for (const viewer of viewers(state)) {
      const reveal = viewLog(events, viewer).find((event) => event.kind === "reveal")
      expect(reveal, String(viewer)).toMatchObject({ hands: [{ player: "ana" }, { player: "bob" }, { player: "cleo" }] })
    }
  })
})
