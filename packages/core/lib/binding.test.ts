import { afterEach, describe, expect, it, vi } from "vitest"
import { type GameModule, hasEngine, isPlayable } from "./binding"

const game = ({ live, engine }: { live: boolean; engine: boolean }) =>
  ({ slug: "sample", live, binding: engine ? { GAME: {} } : {} }) as unknown as GameModule

afterEach(() => vi.unstubAllEnvs())

describe("hasEngine", () => {
  it("only depends on the engine, not on the game being live or on the environment", () => {
    vi.stubEnv("VERCEL_ENV", "production")
    expect(hasEngine(game({ live: false, engine: true }))).toBe(true)
    expect(hasEngine(game({ live: true, engine: true }))).toBe(true)
    expect(hasEngine(game({ live: true, engine: false }))).toBe(false)
  })
})

describe("isPlayable", () => {
  it("in production: a live game with an engine only", () => {
    vi.stubEnv("VERCEL_ENV", "production")
    expect(isPlayable(game({ live: true, engine: true }))).toBe(true)
    expect(isPlayable(game({ live: false, engine: true }))).toBe(false)
    expect(isPlayable(game({ live: true, engine: false }))).toBe(false)
    expect(isPlayable(game({ live: false, engine: false }))).toBe(false)
  })

  it.each(["preview", "development", undefined])("with VERCEL_ENV=%s: any game with an engine, live or not", (env) => {
    vi.stubEnv("VERCEL_ENV", env)
    expect(isPlayable(game({ live: false, engine: true }))).toBe(true)
    expect(isPlayable(game({ live: true, engine: true }))).toBe(true)
    expect(isPlayable(game({ live: true, engine: false }))).toBe(false)
  })
})
