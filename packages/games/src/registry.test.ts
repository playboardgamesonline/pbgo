import { existsSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"
import { isProjectId } from "@pbgo/core/sanity/env"
import { GAMES, listedGames } from "./registry"

describe("game registry", () => {
  it("has unique, URL-safe slugs", () => {
    const slugs = GAMES.map((g) => g.slug)
    expect(new Set(slugs).size).toBe(slugs.length)
    for (const slug of slugs) expect(slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/)
  })

  it("keeps slugs clear of the app's own routes", () => {
    // top-level routes of apps/web (and /api/media: a global API route next to /api/<slug>), the pages and API routes under /gamemaster
    // that sit next to /gamemaster/<slug> (login, api, logout), plus a game's own segments. `ingest` is the PostHog proxy (a rewrite)
    const reserved = ["api", "legal", "design", "gamemaster", "ingest", "login", "logout", "media", "admin", "preview", "game", "icons", "robots.txt", "sitemap.xml", "favicon.ico"]
    for (const { slug } of GAMES) expect(reserved).not.toContain(slug)
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

  it("points the cover art at an existing file of the game's own public folder", () => {
    const publicDir = fileURLToPath(new URL("../../../apps/web/public", import.meta.url))
    for (const g of GAMES) {
      const visual = "visual" in g ? g.visual : undefined
      if (!visual) continue
      expect(visual.startsWith(`/${g.slug}/`), g.slug).toBe(true)
      expect(existsSync(publicDir + visual), `${g.slug}: ${visual}`).toBe(true)
    }
  })

  it("lists the live games on the hub", () => {
    expect(listedGames().map((g) => g.slug)).toContain("courtisans")
    expect(listedGames().every((g) => g.live)).toBe(true)
  })
})
