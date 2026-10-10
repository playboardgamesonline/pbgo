import { describe, expect, it } from "vitest"
import { applyAction } from "./actions"
import { autoMove } from "./debug"
import { setupGame } from "./setup"
import { card, makeState, player, testMissions } from "./test-utils"
import { FAMILIES, ROLES, type GameState } from "./types"
import { type PlayerView, playerView } from "./view"

describe("playerView", () => {
  const spy = card("hare", "spy")
  const state = makeState({
    players: [player("a", { hand: [spy, card("stag"), card("stag")] }), player("b", { hand: [card("carp")] })],
    deck: [card("toad")],
  })
  const after = applyAction(state, { type: "playCard", playerId: "a", cardId: spy.id, target: { zone: "table", level: "up" } })

  it("only exposes the viewer's own hand and missions", () => {
    const view = playerView(after, "a")
    expect(view.me?.hand).toHaveLength(2)
    expect(view.players[1]).toMatchObject({ handCount: 1, missions: null })
    expect(JSON.stringify(view)).not.toContain("carp")
    expect(view.deckCount).toBe(1)
  })

  it("hides the famille of played espions, even from their owner and in the journal", () => {
    const view = playerView(after, "a")
    expect(view.table[0]!.card).toEqual({ id: spy.id, family: null, role: "spy" })
    expect(view.log[0]).toMatchObject({ type: "cardPlayed", card: { family: null, role: "spy" } })
  })

  it("gives masked espions an id that says nothing about their famille, in domains and at the table", () => {
    const hidden = card("hare", "spy")
    const state = makeState({
      players: [player("a", { hand: [hidden, card("stag")], domain: [] }), player("b", { hand: [card("carp")] })],
    })
    const inDomain = applyAction(state, { type: "playCard", playerId: "a", cardId: hidden.id, target: { zone: "domain", playerId: "b" } })
    for (const viewer of ["a", "b", null]) {
      const view = playerView(inDomain, viewer)
      const masked = view.players[1]!.domain[0]!
      expect(masked).toEqual({ id: hidden.id, family: null, role: "spy" })
      expect(masked.id).not.toMatch(/hare|spy/)
      expect(JSON.stringify(view.players[1]!.domain)).not.toContain("hare")
      expect(JSON.stringify(view.log)).not.toContain("hare")
    }
    expect(JSON.stringify(playerView(after, "b").table)).not.toContain("hare")
  })

  it("keeps the same id when a spy is revealed at the end (animations follow the card)", () => {
    const hiddenId = playerView(after, "b").table[0]!.card.id
    expect(playerView({ ...after, phase: "over" }, "b").table[0]!.card).toEqual({ id: hiddenId, family: "hare", role: "spy" })
  })

  it("reveals everything at the end with resultats", () => {
    const view = playerView({ ...after, phase: "over" }, "b")
    expect(view.table[0]!.card.family).toBe("hare")
    expect(view.results?.players).toHaveLength(2)
    expect(view.players[0]!.missions).toEqual([])
  })

  it("lists the zones still available this turn", () => {
    expect(playerView(after, "a").availableZones).toEqual(["domain", "opponentDomain"])
  })
})

describe("playerView leaks (full games)", () => {
  const players = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `p${i}`, nickname: `P${i}` }))
  const words = [...FAMILIES, ...ROLES, "courtier"]

  type Seen = { id: string; family: unknown; role: unknown }
  function cardsIn(value: unknown, out: Seen[] = []): Seen[] {
    if (Array.isArray(value)) for (const v of value) cardsIn(v, out)
    else if (value && typeof value === "object") {
      if ("id" in value && "family" in value && "role" in value) out.push(value as Seen)
      for (const v of Object.values(value)) cardsIn(v, out)
    }
    return out
  }

  /** Every way a viewer could learn something it should not see from its view of `state` (returns the leaks). */
  function leaks(state: GameState, viewer: string | null, view: PlayerView): string[] {
    const found: string[] = []
    const json = JSON.stringify(view)
    const over = state.phase === "over"
    // cards nobody may see: other hands, the deck, the cards set aside
    const secret = [...state.deck, ...state.setAside, ...state.players.filter((j) => j.id !== viewer).flatMap((j) => j.hand)]
    for (const c of secret) if (json.includes(c.id)) found.push(`secret card ${c.id}`)
    // spies in play keep their famille hidden until the end, wherever they show up (domains, table, log)
    const spies = new Set(
      [...state.table.map((p) => p.card), ...state.players.flatMap((j) => j.domain), ...state.eliminated].filter((c) => c.role === "spy").map((c) => c.id),
    )
    for (const c of cardsIn({ ...view, me: null })) if (!over && spies.has(c.id) && c.family !== null) found.push(`spy ${c.id} shows ${c.family}`)
    // ids are opaque: no famille or role name inside
    for (const c of cardsIn(view)) if (words.some((w) => c.id.includes(w))) found.push(`id ${c.id}`)
    if (json.includes(String(state.seed)) || "seed" in view) found.push("seed")
    return found
  }

  it.each([2, 3, 4, 5])("never leaks hidden information to any viewer during a %i-player game", (n) => {
    let state = setupGame({ players: players(n), missions: testMissions(), seed: 1000 + n })
    for (const j of state.players) state = applyAction(state, { type: "readMissions", playerId: j.id })
    let steps = 0
    while (true) {
      for (const viewer of [...state.players.map((j) => j.id), null]) expect(leaks(state, viewer, playerView(state, viewer))).toEqual([])
      if (state.phase === "over") break
      state = autoMove(state)
      expect(++steps).toBeLessThan(200)
    }
  })

  it("does not tie an id to a famille across games", () => {
    const families = new Map<string, Set<string>>()
    for (let seed = 1; seed <= 30; seed++) {
      const state = setupGame({ players: players(5), missions: testMissions(), seed })
      for (const c of [...state.deck, ...state.players.flatMap((j) => j.hand)]) {
        families.set(c.id, (families.get(c.id) ?? new Set()).add(c.family))
      }
    }
    const fixed = [...families.values()].filter((f) => f.size === 1).length
    expect(fixed / families.size).toBeLessThan(0.1)
  })
})
