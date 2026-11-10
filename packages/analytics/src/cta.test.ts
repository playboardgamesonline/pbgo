import { describe, expect, it } from "vitest"
import { gamePageClickOf, isGameSlug } from "./cta"
import { assertNoPersonalData } from "./privacy"

describe("isGameSlug", () => {
  it.each(["flip-7", "courtisans", "6-nimmt", "a"])("accepts %s", (slug) => {
    expect(isGameSlug(slug)).toBe(true)
  })

  it.each([undefined, "", "Flip 7", "-flip", "game/ABC234", "marly@example.com", "a".repeat(41)])("refuses %s", (value) => {
    expect(isGameSlug(value)).toBe(false)
  })
})

describe("gamePageClickOf", () => {
  it.each(["create_table", "buy"])("reads the attributes of a %s button", (target) => {
    expect(gamePageClickOf(target, "flip-7")).toEqual({ game: "flip-7", target })
  })

  it.each([
    ["no target", undefined, "flip-7"],
    ["a target that is not one", "delete_everything", "flip-7"],
    ["a target in capitals", "BUY", "flip-7"],
    ["no game", "buy", undefined],
    ["a game that is not a slug", "buy", "Flip 7"],
    ["a sentence", "buy", "this is not a slug"],
    ["a table's code", "buy", "ABC234"],
    ["an address", "buy", "marly@example.com"],
    ["a slug that is too long", "buy", "a".repeat(41)],
    ["an empty game", "buy", ""],
  ])("is null for %s", (_what, target, game) => {
    expect(gamePageClickOf(target, game)).toBeNull()
  })

  it("holds nothing personal", () => {
    assertNoPersonalData(gamePageClickOf("buy", "courtisans")!)
  })
})
