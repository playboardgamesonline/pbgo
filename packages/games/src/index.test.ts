import { describe, expect, it, vi } from "vitest"

const loads = vi.hoisted(() => ({ template: 0, skyjo: 0 }))
vi.mock("server-only", () => ({}))
vi.mock("@pbgo-game/template/server", () => {
  // the first import fails, like a chunk that did not load
  if (++loads.template === 1) throw new Error("Failed to load chunk")
  return { SLUG: "template" }
})
vi.mock("@pbgo-game/skyjo/server", () => {
  loads.skyjo++
  return { SLUG: "skyjo" }
})

import { getGame } from "./index"

describe("getGame", () => {
  it("does not keep a failed import: the next call loads the game again", async () => {
    await expect(getGame("template")).rejects.toThrow()
    const game = await getGame("template")
    expect(game).toMatchObject({ slug: "template", binding: { SLUG: "template" } })
    expect(loads.template).toBe(2)
  })

  it("loads a game once and shares it between calls, including concurrent ones", async () => {
    const [a, b] = await Promise.all([getGame("skyjo"), getGame("skyjo")])
    expect(a).toBe(b)
    expect(await getGame("skyjo")).toBe(a)
    expect(loads.skyjo).toBe(1)
  })

  it("answers null for an unknown slug without loading anything", async () => {
    expect(await getGame("favicon.ico")).toBeNull()
  })
})
