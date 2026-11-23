import { GAME, type PlayerView } from "@skyjo/engine"
import { describe, expect, it } from "vitest"
import { WORD_FIELDS, type Vocabulary } from "../../lib/words"
import { promptOf } from "./prompt"

/** Every word reads as its own name, so that a test says which one was chosen */
const words = Object.fromEntries(WORD_FIELDS.map((field) => [field, field])) as Vocabulary

const PLAYERS = [
  { id: "ana", nickname: "Ana" },
  { id: "bob", nickname: "Bob" },
  { id: "cleo", nickname: "Cleo" },
]

const state = () => GAME.setup({ players: PLAYERS, options: {}, seed: 7 })

/** The view of `viewer` with the phase of the round set to `phase`: the sentence only reads the phase and who the viewer is */
const viewOf = (viewer: string | null, phase: PlayerView["phase"]): PlayerView => ({ ...GAME.view(state(), viewer), phase })

describe("what the ticker tells the viewer to do", () => {
  it("asks the players who still have cards to turn over to turn them, and nobody else", () => {
    const phase: PlayerView["phase"] = { kind: "reveal", waiting: ["ana", "bob"], starter: null }
    expect(promptOf(viewOf("ana", phase), words)).toBe("promptReveal")
    expect(promptOf(viewOf("cleo", phase), words)).toBeNull()
  })

  it("asks the player of the turn to draw or take, and nobody else: the ticker says whose turn it is", () => {
    const phase: PlayerView["phase"] = { kind: "choose", player: "bob" }
    expect(promptOf(viewOf("bob", phase), words)).toBe("promptChoose")
    expect(promptOf(viewOf("ana", phase), words)).toBeNull()
  })

  it("tells the player who holds a card to place it, or to place it or throw it away when it came from the pile", () => {
    const drawn: PlayerView["phase"] = { kind: "place", player: "bob", from: "deck", card: null, canDiscard: true }
    const taken: PlayerView["phase"] = { kind: "place", player: "bob", from: "discard", card: null, canDiscard: false }
    expect(promptOf(viewOf("bob", drawn), words)).toBe("promptPlaceDrawn")
    expect(promptOf(viewOf("bob", taken), words)).toBe("promptPlaceTaken")
    expect(promptOf(viewOf("ana", drawn), words)).toBeNull()
  })

  it("asks the player who threw the card away to turn one over", () => {
    const phase: PlayerView["phase"] = { kind: "flip", player: "cleo" }
    expect(promptOf(viewOf("cleo", phase), words)).toBe("promptFlip")
    expect(promptOf(viewOf("bob", phase), words)).toBeNull()
  })

  it("asks the dealer to deal between two rounds, and says nothing at the end of the game", () => {
    const between: PlayerView["phase"] = { kind: "between", dealer: "ana" }
    expect(promptOf(viewOf("ana", between), words)).toBe("promptDeal")
    expect(promptOf(viewOf("bob", between), words)).toBeNull()
    expect(promptOf(viewOf("ana", { kind: "over" }), words)).toBeNull()
  })

  it("says nothing to somebody who looks on", () => {
    for (const phase of [{ kind: "reveal", waiting: ["ana"], starter: null }, { kind: "choose", player: "ana" }, { kind: "between", dealer: "ana" }] satisfies PlayerView["phase"][]) {
      expect(promptOf(viewOf(null, phase), words)).toBeNull()
    }
  })
})
