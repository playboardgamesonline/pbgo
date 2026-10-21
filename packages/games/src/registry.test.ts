import { readdirSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"
import { isProjectId } from "@pbgo/core/sanity/env"
import { GAMES, listedGames } from "./registry"
import { RESERVED_SLUGS, SLUG_PATTERN } from "./slug"

describe("game registry", () => {
  it("has unique, URL-safe slugs", () => {
    const slugs = GAMES.map((g) => g.slug)
    expect(new Set(slugs).size).toBe(slugs.length)
    for (const slug of slugs) expect(slug).toMatch(SLUG_PATTERN)
  })

  it("keeps slugs clear of the app's own routes", () => {
    // RESERVED_SLUGS (slug.ts) lists them, and slug.test.ts keeps that list equal to the folders of apps/web
    for (const { slug } of GAMES) expect(RESERVED_SLUGS).not.toContain(slug)
  })

  it("gives every game a Sanity project id, or the placeholder of a game created by new-game", () => {
    for (const g of GAMES) expect(g.sanityProjectId, g.slug).toMatch(/^([a-z0-9]{8}|__SANITY_PROJECT_ID__)$/)
  })

  it("gives live games a real Sanity project", () => {
    for (const g of GAMES) if (g.live) expect(isProjectId(g.sanityProjectId), g.slug).toBe(true)
  })

  it("only indexes live games", () => {
    for (const g of GAMES) if (g.indexable) expect(g.live, g.slug).toBe(true)
  })

  it("has consistent player counts", () => {
    for (const g of GAMES) {
      const players = "players" in g ? g.players : undefined
      if (players) expect(players.min, g.slug).toBeLessThanOrEqual(players.max)
    }
  })

  it("has consistent durations", () => {
    for (const g of GAMES) {
      const duration = "duration" in g ? g.duration : undefined
      if (!duration) continue
      expect(Number.isInteger(duration.min) && duration.min > 0, g.slug).toBe(true)
      expect(duration.min, g.slug).toBeLessThanOrEqual(duration.max)
    }
  })

  it("keeps apps/web/public to the platform's own files", () => {
    // What a game shows (images, sounds, fonts) comes from its Sanity project: a copy in the code or here would hide a missing value.
    // The build runs the same check (scripts/check-public.mjs, before `next build`), since a deployment never runs the tests.
    const publicDir = fileURLToPath(new URL("../../../apps/web/public", import.meta.url))
    const files = (dir: string): string[] =>
      readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
        if (entry.name === ".DS_Store") return []
        const path = `${dir}/${entry.name}`
        return entry.isDirectory() ? files(path) : [path.slice(publicDir.length + 1)]
      })
    expect(files(publicDir).sort()).toEqual(["favicon.ico"])
  })

  it("lists the live games on the hub", () => {
    expect(listedGames().map((g) => g.slug)).toContain("courtisans")
    expect(listedGames().every((g) => g.live)).toBe(true)
  })
})
