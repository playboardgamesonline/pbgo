import { describe, expect, it } from "vitest"
import { step } from "./actions"
import type { CharacterKey } from "./catalogue"
import { areaNames, cardIn, handNames, kinds, layout, playCard, playStep, refusal, viewOf, waiting } from "./test-utils"

// Rulebook, pp. 5 and 11: choosing a player. A card that asks to choose another player can choose any player still in the round except the one who plays it and
// a player a Handmaid protects (p. 11); the Prince asks to choose any player and can choose its own (p. 10); a player who is out cannot be chosen (p. 5).

/** The four characters that pick another player, and what they are given alongside the player (the Guard names a character). */
const PICKERS: CharacterKey[] = ["guard", "priest", "baron", "king"]
const given = (key: CharacterKey) => (key === "guard" ? { guess: "baron" as CharacterKey } : {})

/** A table of four: ana plays the card `key` and keeps a Countess, who is worth the most of the cards that pick nobody. */
const table = (key: CharacterKey, spec: Parameters<typeof layout>[0] = {}) =>
  layout({ players: 4, hands: { ana: [key, "spy"], bob: ["handmaid"], cleo: ["priest"], dan: ["baron"] }, deck: ["spy", "guard"], ...spec })

describe("a card that picks another player", () => {
  for (const key of PICKERS) {
    it(`can be the ${key}: it picks any other player still in the round (pp. 5, 9, 12)`, () => {
      for (const target of ["bob", "cleo", "dan"]) {
        const state = table(key)
        expect(() => playCard(state, "ana", key, { target, ...given(key) }), target).not.toThrow()
      }
    })

    it(`never picks the player who plays the ${key} (INVALID_TARGET)`, () => {
      const state = table(key)
      expect(refusal(() => playCard(state, "ana", key, { target: "ana", ...given(key) }))).toBe("INVALID_TARGET")
    })

    it(`never picks a player who is out of the round (INVALID_TARGET) (p. 5)`, () => {
      const state = table(key, { out: ["cleo"], hands: { ana: [key, "spy"], bob: ["handmaid"], dan: ["baron"] } })
      expect(refusal(() => playCard(state, "ana", key, { target: "cleo", ...given(key) }))).toBe("INVALID_TARGET")
      expect(() => playCard(state, "ana", key, { target: "dan", ...given(key) })).not.toThrow()
    })

    it(`never picks a player a Handmaid protects (INVALID_TARGET) (p. 11)`, () => {
      const state = table(key, { shielded: ["cleo"] })
      expect(refusal(() => playCard(state, "ana", key, { target: "cleo", ...given(key) }))).toBe("INVALID_TARGET")
      expect(() => playCard(state, "ana", key, { target: "bob", ...given(key) })).not.toThrow()
    })

    it(`must be given the player to pick when one can be picked (INVALID_TARGET): none, nobody at the table, a number, null`, () => {
      const state = table(key)
      for (const target of [undefined, "zed", "", 2, null, {}]) {
        expect(refusal(() => step(state, { type: "play", playerId: "ana", card: cardIn(state, "ana", key), target, ...given(key) } as never)), String(target)).toBe("INVALID_TARGET")
      }
    })
  }
})

describe("a card that picks another player when every other player in the round is protected (p. 11)", () => {
  for (const key of PICKERS) {
    it(`is played with no effect, as the ${key} is, and is still played: it lies in front of its player`, () => {
      const state = table(key, { shielded: ["bob", "cleo", "dan"] })
      const stepped = playStep(state, "ana", key)
      expect(areaNames(stepped.state, "ana")).toEqual([key])
      expect(handNames(stepped.state, "ana")).toEqual(["spy"])
      expect(kinds(stepped)).toEqual(["play", "fizzled", "draw"])
      // nothing happened to anybody else, but the draw of the next player, whose protection ended with the start of their turn
      expect(stepped.state.out).toEqual([false, false, false, false])
      expect(handNames(stepped.state, "cleo")).toEqual(["priest"])
      expect(waiting(stepped.state)).toEqual(["bob"])
    })

    it(`is played with no effect when the others are protected or out, and no player may be named then (INVALID_TARGET)`, () => {
      const state = table(key, { shielded: ["bob", "dan"], out: ["cleo"], hands: { ana: [key, "spy"], bob: ["handmaid"], dan: ["baron"] } })
      expect(refusal(() => playCard(state, "ana", key, { target: "bob", ...given(key) }))).toBe("INVALID_TARGET")
      expect(refusal(() => playCard(state, "ana", key, { target: "cleo", ...given(key) }))).toBe("INVALID_TARGET")
      expect(kinds(playStep(state, "ana", key))).toEqual(["play", "fizzled", "draw"])
    })
  }

  it("is a Guard that needs no character to name: there is nobody to name it to", () => {
    const state = table("guard", { shielded: ["bob", "cleo", "dan"] })
    expect(() => playCard(state, "ana", "guard")).not.toThrow()
  })
})

describe("the Prince (p. 10)", () => {
  const prince = (spec: Parameters<typeof layout>[0] = {}) => table("prince", spec)

  it("can pick any player, the one who plays it included", () => {
    for (const target of ["ana", "bob", "cleo", "dan"]) expect(() => playCard(prince(), "ana", "prince", { target }), target).not.toThrow()
  })

  it("cannot pick a player who is out of the round, nor one a Handmaid protects (INVALID_TARGET)", () => {
    const state = prince({ shielded: ["cleo"], out: ["dan"], hands: { ana: ["prince", "spy"], bob: ["handmaid"], cleo: ["priest"] } })
    expect(refusal(() => playCard(state, "ana", "prince", { target: "cleo" }))).toBe("INVALID_TARGET")
    expect(refusal(() => playCard(state, "ana", "prince", { target: "dan" }))).toBe("INVALID_TARGET")
    expect(() => playCard(state, "ana", "prince", { target: "bob" })).not.toThrow()
  })

  it("must pick its own player when every other player in the round is protected (INVALID_TARGET for any other)", () => {
    const state = prince({ shielded: ["bob", "cleo", "dan"] })
    for (const target of ["bob", "cleo", "dan"]) expect(refusal(() => playCard(state, "ana", "prince", { target })), target).toBe("INVALID_TARGET")
    expect(refusal(() => playCard(state, "ana", "prince"))).toBe("INVALID_TARGET")
    const after = playCard(state, "ana", "prince", { target: "ana" })
    expect(areaNames(after, "ana")).toEqual(["prince", "spy"])
  })

  it("must be given a player: none, nobody at the table (INVALID_TARGET)", () => {
    const state = prince()
    expect(refusal(() => playCard(state, "ana", "prince"))).toBe("INVALID_TARGET")
    expect(refusal(() => playCard(state, "ana", "prince", { target: "zed" }))).toBe("INVALID_TARGET")
  })
})

describe("a card that picks nobody", () => {
  it("ignores a player it is given: the Spy, the Handmaid, the Countess and the Princess pick nobody (pp. 8, 9, 11, 13)", () => {
    for (const key of ["spy", "countess"] as const) {
      const state = layout({ players: 3, hands: { ana: [key, "guard"], bob: ["priest"], cleo: ["baron"] }, deck: ["spy"] })
      expect(() => playCard(state, "ana", key, { target: "bob" }), key).not.toThrow()
      expect(() => playCard(state, "ana", key, { target: "nobody" }), key).not.toThrow()
    }
  })
})

describe("the players a card can pick, as the view says them (pp. 5, 11)", () => {
  it("are the other players still in the round who are not protected, in seat order, the same for every viewer", () => {
    const state = layout({ players: 5, hands: { ana: ["guard", "spy"], bob: ["priest"], dan: ["baron"], eva: ["king"] }, shielded: ["bob"], out: ["cleo"] })
    for (const viewer of ["ana", "bob", "cleo", "dan", "eva", "stranger", null]) {
      expect(viewOf(state, viewer).phase, String(viewer)).toEqual({ kind: "turn", player: "ana", targets: ["dan", "eva"] })
    }
  })

  it("are nobody when every other player is protected: the card will be played with no effect", () => {
    const state = layout({ players: 3, shielded: ["bob", "cleo"] })
    expect(viewOf(state, "ana").phase).toEqual({ kind: "turn", player: "ana", targets: [] })
  })

  it("are the same players the engine accepts: each is accepted, any other is refused", () => {
    const state = layout({ players: 5, hands: { ana: ["guard", "spy"], bob: ["priest"], dan: ["baron"], eva: ["king"] }, shielded: ["bob"], out: ["cleo"] })
    const { targets } = viewOf(state, "ana").phase as { targets: string[] }
    for (const id of state.seats) {
      const accepted = (() => {
        try {
          playCard(state, "ana", "guard", { target: id, guess: "baron" })
          return true
        } catch {
          return false
        }
      })()
      expect(accepted, id).toBe(targets.includes(id))
    }
  })
})

describe("a player who is out of the round (p. 5)", () => {
  it("cannot be chosen and has their turn skipped", () => {
    const state = layout({ players: 3, hands: { ana: ["countess", "spy"], cleo: ["baron"] }, deck: ["guard", "guard", "guard"], out: ["bob"] })
    const after = playCard(state, "ana", "countess")
    expect(waiting(after)).toEqual(["cleo"])
    expect(viewOf(after, "cleo").phase).toMatchObject({ kind: "turn", targets: ["ana"] })
  })
})
