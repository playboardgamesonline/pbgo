import { existsSync, readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"
import { isProjectId } from "@pbgo/core/sanity/env"
import { GAMES, listedGames } from "./registry"
import { RESERVED_SLUGS, SLUG_PATTERN } from "./slug"

// `live` and `indexable` are turned by the pull request that puts a game online (`game-go-live`). A test of a game's seed that holds one to a value passes for every game that is not online yet and
// fails the day its game goes, so none may: the test is what is wrong then, never the switch. The pattern is a switch written as a key with a value (`live: false`, `"indexable": true`) or read from an entry (`entry.live`).
const SWITCH_HELD = /\b(live|indexable)\b["']?\s*:\s*(true|false)\b|\.(live|indexable)\b/

/** The test files of every game's `content` folder (its seed and its parity tests), as paths from the games' folder. */
function contentTests(games: string): string[] {
  return readdirSync(games, { withFileTypes: true }).flatMap((game) => {
    const content = join(games, game.name, "content")
    if (!game.isDirectory() || !existsSync(content)) return []
    return readdirSync(content, { recursive: true, encoding: "utf8" }).filter((file) => file.endsWith(".test.ts")).map((file) => `${game.name}/content/${file}`)
  })
}

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

  it("leaves the switches to the go-live stage: no test of a game's content holds `live` or `indexable` to a value", () => {
    const games = fileURLToPath(new URL("../../../games", import.meta.url))
    const files = contentTests(games)
    expect(files.length, "no test file found under games/*/content: the guard would pass for nothing").toBeGreaterThan(0)
    const held = files.flatMap((file) =>
      readFileSync(join(games, file), "utf8")
        .split("\n")
        .flatMap((line, at) => (SWITCH_HELD.test(line) ? [`games/${file}:${at + 1}  ${line.trim()}`] : [])),
    )
    expect(held, "a seed test that holds a switch fails the day its game goes live: remove the test, never the switch").toEqual([])
  })

  it("sees a switch held to a value in the forms a seed test would write it, and no other line", () => {
    for (const line of ["expect(own).toMatch(/live: false/)", 'expect(own).toContain("indexable: true")', 'expect(entry).toMatchObject({ "live": false })', "expect(entry.live).toBe(false)", "expect(GAMES.find((g) => g.slug === SLUG)?.indexable).toBe(true)"]) {
      expect(SWITCH_HELD.test(line), line).toBe(true)
    }
    for (const line of ['expect(own).toContain(`sanityProjectId: "${PROJECT_ID}"`)', 'it("never goes live on its own", () => {', "const alive = true", "return isIndexable(entry)"]) {
      expect(SWITCH_HELD.test(line), line).toBe(false)
    }
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
