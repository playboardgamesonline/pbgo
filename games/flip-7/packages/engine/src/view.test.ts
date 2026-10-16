import { describe, expect, it } from "vitest"
import { CARDS, CATALOGUE } from "./catalogue"
import { deal, give, hit, layout, newState, playRandomly, seedOf, stay, titleOf, viewOf } from "./test-utils"
import type { Face, PlayerView, State } from "./types"

// What a viewer sees. Nothing is hidden in Flip 7 but the order of the draw pile: every card is turned face up as it is drawn.

/** Every card id a view shows, wherever it is. */
function idsIn(view: PlayerView): number[] {
  const faces: Face[] = [...view.players.flatMap((player) => [...player.cards, ...player.held]), ...view.discard]
  if (view.phase.kind === "target") faces.push(view.phase.card)
  return faces.map((face) => face.id)
}

/** What the draw pile holds, worked out from what everybody sees: the box less the lines, the cards set aside and the discard. */
function deckFromPublicCards(view: PlayerView): Record<string, number> {
  const left: Record<string, number> = Object.fromEntries(Object.keys(CARDS).map((face) => [face, CATALOGUE.filter((candidate) => candidate === face).length]))
  const faces: Face[] = [...view.players.flatMap((player) => [...player.cards, ...player.held]), ...view.discard]
  if (view.phase.kind === "target") faces.push(view.phase.card)
  for (const { type } of faces) left[type]! -= 1
  return left
}

describe("the view of a table", () => {
  const state = layout({
    lines: { ana: ["number-4", "plus-2"], bob: ["number-9", "second-chance"], cleo: ["number-6"] },
    discard: ["number-12", "freeze"],
    deck: ["number-1", "number-2"],
    rounds: [[10, 20, 30]],
  })

  it("lists the players in seat order with what is in front of them, what it is worth and what they banked", () => {
    const view = viewOf(state, "ana")
    expect(view.players.map((player) => player.id)).toEqual(["ana", "bob", "cleo"])
    expect(view.players[0]!.cards.map((face) => face.type)).toEqual(["number-4", "plus-2"])
    expect(view.players.map((player) => [player.status, player.score, player.total])).toEqual([
      ["active", 6, 10],
      ["active", 9, 20],
      ["active", 6, 30],
    ])
    expect(view.rounds).toEqual([[10, 20, 30]])
    expect(view.round).toBe(2)
    expect(view.dealer).toBe("cleo")
    expect(view.target).toBe(200)
    expect(view.options).toEqual({ targetScore: 200 })
    expect(view.phase).toEqual({ kind: "turn", player: "ana", canStay: true })
    expect(view.results).toBeNull()
  })

  it("shows the discard whole, the top card first", () => {
    expect(viewOf(state, null).discard.map((face) => face.type)).toEqual(["number-12", "freeze"])
  })

  it("gives each card the id it holds, and what it is", () => {
    const view = viewOf(state, null)
    for (const player of view.players) for (const face of player.cards) expect(titleOf(state, face.id)).toBe(face.type)
  })

  it("tells the viewer who they are, and nothing else: a spectator and a stranger get the same view", () => {
    expect(viewOf(state, "ana").me).toBe("ana")
    expect(viewOf(state, "cleo").me).toBe("cleo")
    expect(viewOf(state, null).me).toBeNull()
    expect(viewOf(state, "stranger").me).toBeNull()
    for (const viewer of ["bob", "cleo", null, "stranger"]) expect({ ...viewOf(state, viewer), me: null }).toEqual({ ...viewOf(state, "ana"), me: null })
  })

  it("does not share anything with the state: changing a view changes nothing", () => {
    const view = viewOf(state, "ana")
    const before = structuredClone(state)
    view.players[0]!.cards.length = 0
    view.rounds[0]![0] = 999
    view.discard.pop()
    view.options.targetScore = 1
    expect(state).toEqual(before)
  })

  it("is plain data: it survives JSON", () => {
    const view = viewOf(state, "ana")
    expect(JSON.parse(JSON.stringify(view))).toEqual(view)
  })
})

describe("the draw pile in a view", () => {
  it("shows its size and the faces it holds, in the order of the box, and never an id of its cards", () => {
    const state = newState(5, seedOf(8))
    const view = viewOf(state, "ana")
    expect(view.deck.size).toBe(state.deck.length)
    expect(view.deck.counts.map(({ type }) => type)).toEqual(Object.keys(CARDS))
    expect(view.deck.counts.reduce((sum, { count }) => sum + count, 0)).toBe(state.deck.length)
    const shown = new Set(idsIn(view))
    const text = JSON.stringify(view)
    for (const id of state.deck) {
      expect(shown.has(id), `the view shows the id ${id} of a card of the draw pile`).toBe(false)
      // nor anywhere else in it, whatever the field
      expect(new RegExp(`(^|[^0-9])${id}([^0-9]|$)`).test(text), `the view holds the id ${id} of a card of the draw pile`).toBe(false)
    }
  })

  it("holds exactly the faces that nobody sees: what the players could count themselves, nothing more", () => {
    // all along a whole game, at every move
    const seed = seedOf(9)
    for (const state of playRandomly(newState(6, seed), seed)) {
      const view = viewOf(state, null)
      const counted = deckFromPublicCards(view)
      expect(Object.fromEntries(view.deck.counts.map(({ type, count }) => [type, count]))).toEqual(counted)
    }
  })

  it("counts the cards of the discard and the lines out of the pile, and the ones flipped on the way", () => {
    const flipped = give(hit(layout({ deck: ["flip-three", "freeze", "number-3", "number-4", "number-9"] }), "ana"), "ana", "bob")
    const view = viewOf(flipped, null)
    expect(view.deck.counts.find(({ type }) => type === "freeze")!.count).toBe(2)
    expect(deckFromPublicCards(view)).toEqual(Object.fromEntries(view.deck.counts.map(({ type, count }) => [type, count])))
  })
})

describe("the phase of a view", () => {
  it("is the turn of a player, who can stay once they hold a card", () => {
    expect(viewOf(layout({}), null).phase).toEqual({ kind: "turn", player: "ana", canStay: false })
    expect(viewOf(layout({ lines: { ana: ["plus-2"] } }), null).phase).toEqual({ kind: "turn", player: "ana", canStay: true })
  })

  it("is the choice of a target, with the card in the air and who may get it", () => {
    const drawn = hit(layout({ deck: ["freeze"] }), "ana")
    expect(viewOf(drawn, "bob").phase).toMatchObject({ kind: "target", player: "ana", card: { type: "freeze" }, targets: ["ana", "bob", "cleo"] })
  })

  it("is the next dealer between two rounds, and nothing once it is over", () => {
    const between = stay(stay(stay(layout({ lines: { ana: ["number-5"], bob: ["number-6"], cleo: ["number-7"] } }), "ana"), "bob"), "cleo")
    expect(viewOf(between, null).phase).toEqual({ kind: "between", dealer: "ana" })
    const dealt: State = deal(between, "ana")
    expect(viewOf(dealt, null).phase.kind).toBe("turn")
  })
})
