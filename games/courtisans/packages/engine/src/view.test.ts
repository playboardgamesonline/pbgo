import { describe, expect, it } from "vitest"
import { step } from "./actions"
import { autoPlayFor } from "./autoplay"
import { typeOf, waitingFor } from "./machine"
import { card, handOfPlayer, layout, newState, PLAYER_IDS, seedOf } from "./test-utils"
import type { PlayerView, State } from "./types"
import { playerView } from "./view"

/** Ana plays her hidden spy on the table, above the mat; Bob holds a carp and the deck a toad. */
function afterASpy(): { state: State; spy: number } {
  const state = layout({
    players: 2,
    hands: { ana: [card("hare", "spy"), card("stag"), card("stag")], bob: [card("carp")] },
    deck: [card("toad")],
    missions: { ana: ["mission-light-1", "mission-dark-1"], bob: ["mission-light-2", "mission-dark-2"] },
  })
  const spy = handOfPlayer(state, "ana")[0]!
  return { state: step(state, { type: "playCard", playerId: "ana", cardId: spy, target: { zone: "table", level: "up" } }).state, spy }
}

describe("playerView", () => {
  it("only exposes the viewer's own hand and missions", () => {
    const { state } = afterASpy()
    const view = playerView(state, "ana")
    expect(view.me?.hand).toHaveLength(2)
    expect(view.me?.missions).toEqual(["mission-light-1", "mission-dark-1"])
    expect(view.players[1]).toMatchObject({ handCount: 1, missions: null })
    expect(JSON.stringify(view)).not.toContain("carp")
    expect(JSON.stringify(view)).not.toContain("mission-light-2")
    expect(view.deckCount).toBe(1)
  })

  it("shows a hand to its holder with every card's family and role, and nothing else of it to the others", () => {
    const state = layout({ players: 2, hands: { ana: [card("hare", "noble"), card("stag"), card("carp", "guard")], bob: [card("butterfly", "assassin")] } })
    const mine = playerView(state, "ana").me!.hand
    expect(mine.map(({ family, role }) => ({ family, role }))).toEqual([
      { family: "hare", role: "noble" },
      { family: "stag", role: null },
      { family: "carp", role: "guard" },
    ])
    for (const viewer of ["bob", null, "stranger"]) expect(JSON.stringify(playerView(state, viewer))).not.toMatch(new RegExp(`"id":${mine[0]!.id}[,}]`))
  })

  it("gives a spectator, and a player who is not at the table, the same view of everything but `me`", () => {
    const { state } = afterASpy()
    const spectator = playerView(state, null)
    expect(spectator.me).toBeNull()
    expect(playerView(state, "stranger")).toEqual(spectator)
    expect({ ...playerView(state, "bob"), me: null }).toEqual(spectator)
  })

  it("hides the family of played spies, even from their owner", () => {
    const { state, spy } = afterASpy()
    for (const viewer of ["ana", "bob", null]) expect(playerView(state, viewer).table[0]!.card).toEqual({ id: spy, family: null, role: "spy" })
  })

  it("hides it in a domain as well, and keeps no trace of it in what the step says", () => {
    const state = layout({ players: 2, hands: { ana: [card("hare", "spy"), card("stag")], bob: [card("carp")] } })
    const hidden = handOfPlayer(state, "ana")[0]!
    const played = step(state, { type: "playCard", playerId: "ana", cardId: hidden, target: { zone: "domain", playerId: "bob" } })
    for (const viewer of ["ana", "bob", null]) {
      const view = playerView(played.state, viewer)
      expect(view.players[1]!.domain[0]).toEqual({ id: hidden, family: null, role: "spy" })
      expect(JSON.stringify(view.players[1]!.domain)).not.toContain("hare")
    }
    expect(JSON.stringify(played.events)).not.toContain("hare")
  })

  it("keeps the same id when a spy is revealed at the end (animations follow the card)", () => {
    const { state, spy } = afterASpy()
    // the rest of the game, played for the players
    let over = state
    while (waitingFor(over).length > 0) over = autoPlayFor(over, waitingFor(over)[0]!)
    expect(playerView(over, "bob").table.map((placed) => placed.card).find((visible) => visible.id === spy)).toEqual({ id: spy, family: "hare", role: "spy" })
  })

  it("reveals everything at the end with the results: the spies' families, every player's missions", () => {
    const state = layout({
      players: 2,
      domains: { ana: [card("hare", "spy")] },
      table: [[card("hare", "spy"), "up"]],
      missions: { ana: ["mission-light-1", "mission-dark-1"], bob: ["mission-light-2", "mission-dark-2"] },
    })
    const view = playerView(state, "bob")
    expect(view.phase).toBe("over")
    expect(view.table[0]!.card.family).toBe("hare")
    expect(view.players[0]!.domain[0]!.family).toBe("hare")
    expect(view.players.map((player) => player.missions)).toEqual([
      ["mission-light-1", "mission-dark-1"],
      ["mission-light-2", "mission-dark-2"],
    ])
    expect(view.results?.players).toHaveLength(2)
  })

  it("lists the zones still available this turn, and who plays", () => {
    const { state } = afterASpy()
    // Ana's turn went on with her first card: the zone of the table is played
    expect(playerView(state, "ana").availableZones).toEqual(["domain", "opponentDomain"])
    expect(playerView(state, "ana").activePlayerId).toBe("ana")
    expect(playerView(newState(3), "ana").availableZones).toEqual(["table", "domain", "opponentDomain"])
  })

  it("keeps no name, no seed and no stream position", () => {
    const json = JSON.stringify(playerView(newState(4, seedOf(3)), "ana"))
    expect(json).not.toMatch(/ANA|BOB|CLEO|DAN/)
    expect(json).not.toMatch(/seed|rng/)
  })
})

describe("playerView leaks (full games)", () => {
  /** Every way a viewer could learn something it should not see from its view of `state` (returns the leaks). */
  function leaks(state: State, viewer: string | null, view: PlayerView): string[] {
    const found: string[] = []
    const json = JSON.stringify(view)
    const over = view.phase === "over"
    const seat = viewer === null ? -1 : state.seats.indexOf(viewer)
    // cards nobody may see: other hands, the deck, the cards set aside, the cards eliminated (they are out of the game, never shown)
    const secret = [...state.deck, ...state.setAside, ...state.eliminated, ...state.hands.filter((_, i) => i !== seat).flat()]
    for (const id of secret) if (new RegExp(`"id":${id}[,}]`).test(json)) found.push(`secret card ${id}`)
    // the missions of the others stay hidden until the end
    if (!over) for (const mission of state.missions.filter((_, i) => i !== seat).flat()) if (json.includes(mission) && !state.missions[seat]?.includes(mission)) found.push(`mission ${mission}`)
    // spies in play keep their family hidden until the end, wherever they show up
    if (!over) {
      for (const { card: visible } of view.table) if (typeOf(state, visible.id).role === "spy" && visible.family !== null) found.push(`spy ${visible.id} shows ${visible.family}`)
      for (const player of view.players) for (const visible of player.domain) if (typeOf(state, visible.id).role === "spy" && visible.family !== null) found.push(`spy ${visible.id} shows ${visible.family}`)
    }
    return found
  }

  it.each([2, 3, 4, 5])("never leaks hidden information to any viewer during a %i-player game", (n) => {
    let state = newState(n, seedOf(1000 + n))
    let steps = 0
    for (;;) {
      for (const viewer of [...PLAYER_IDS.slice(0, n), null]) expect(leaks(state, viewer, playerView(state, viewer))).toEqual([])
      const [next] = waitingFor(state)
      if (next === undefined) break
      state = autoPlayFor(state, next)
      expect(++steps).toBeLessThan(200)
    }
  })
})
