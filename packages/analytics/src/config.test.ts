import { describe, expect, it } from "vitest"
import { isExcludedPath, resolveConfig } from "./config"

const KEY = "phc_abcDEF123456"

describe("resolveConfig", () => {
  it("is off without a key or without a host", () => {
    expect(resolveConfig({})).toBeNull()
    expect(resolveConfig({ key: KEY })).toBeNull()
    expect(resolveConfig({ host: "https://eu.i.posthog.com" })).toBeNull()
    expect(resolveConfig({ key: "", host: "" })).toBeNull()
    expect(resolveConfig({ key: "   ", host: "https://eu.i.posthog.com" })).toBeNull()
  })

  it("refuses anything but a project key: a secret key must never ship to the browser", () => {
    for (const key of ["phx_abc123", "phs_abc123", "phc_", "phc_a b", "abc123", "PHC_abc"]) {
      expect(resolveConfig({ key, host: "https://eu.i.posthog.com" })).toBeNull()
    }
  })

  it("derives the assets and app hosts of PostHog Cloud from the region", () => {
    expect(resolveConfig({ key: KEY, host: "https://eu.i.posthog.com" })).toEqual({
      key: KEY,
      ingestHost: "https://eu.i.posthog.com",
      assetsHost: "https://eu-assets.i.posthog.com",
      uiHost: "https://eu.posthog.com",
      appEnv: "development",
    })
    const us = resolveConfig({ key: KEY, host: "https://us.i.posthog.com" })
    expect(us?.assetsHost).toBe("https://us-assets.i.posthog.com")
    expect(us?.uiHost).toBe("https://us.posthog.com")
  })

  it("takes any other https host as it is, for a reverse proxy of the project's own", () => {
    const config = resolveConfig({ key: KEY, host: "https://t.example.com" })
    expect(config?.ingestHost).toBe("https://t.example.com")
    expect(config?.assetsHost).toBe("https://t.example.com")
    expect(config?.uiHost).toBe("https://t.example.com")
  })

  it("drops trailing slashes and refuses a host with more than an origin", () => {
    expect(resolveConfig({ key: KEY, host: "https://eu.i.posthog.com/" })?.ingestHost).toBe("https://eu.i.posthog.com")
    expect(resolveConfig({ key: KEY, host: " https://eu.i.posthog.com// " })?.ingestHost).toBe("https://eu.i.posthog.com")
    for (const host of [
      "https://eu.i.posthog.com/ingest",
      "https://eu.i.posthog.com?x=1",
      "https://eu.i.posthog.com#top",
      "https://user:pass@eu.i.posthog.com",
      "eu.i.posthog.com",
      "not a url",
    ]) {
      expect(resolveConfig({ key: KEY, host })).toBeNull()
    }
  })

  it("accepts plain http only for a loopback address (a local stand-in of PostHog)", () => {
    expect(resolveConfig({ key: KEY, host: "http://localhost:8123" })?.ingestHost).toBe("http://localhost:8123")
    expect(resolveConfig({ key: KEY, host: "http://127.0.0.1:8123" })?.ingestHost).toBe("http://127.0.0.1:8123")
    expect(resolveConfig({ key: KEY, host: "http://eu.i.posthog.com" })).toBeNull()
    expect(resolveConfig({ key: KEY, host: "http://example.com" })).toBeNull()
  })

  it("reads the environment of the deployment, development when unknown", () => {
    const host = "https://eu.i.posthog.com"
    expect(resolveConfig({ key: KEY, host, appEnv: "production" })?.appEnv).toBe("production")
    expect(resolveConfig({ key: KEY, host, appEnv: "preview" })?.appEnv).toBe("preview")
    expect(resolveConfig({ key: KEY, host, appEnv: "development" })?.appEnv).toBe("development")
    expect(resolveConfig({ key: KEY, host, appEnv: "staging" })?.appEnv).toBe("development")
    expect(resolveConfig({ key: KEY, host })?.appEnv).toBe("development")
  })
})

describe("isExcludedPath", () => {
  it("never reports from the gamemaster, the previews it shows, the design reference nor the docs", () => {
    for (const path of [
      "/design",
      "/design/components/controls",
      "/docs",
      "/docs/design",
      "/docs/engine/rules",
      "/gamemaster",
      "/gamemaster/login",
      "/gamemaster/hanabi/setup/identity",
      "/gamemaster/hanabi/preview/home",
      "/gamemaster/hanabi/preview/game",
      "/hanabi/preview/home",
      "/hanabi/preview/game",
      "/hanabi/preview",
    ]) {
      expect(isExcludedPath(path), path).toBe(true)
    }
  })

  it("reports from the hub, the legal page and the games", () => {
    for (const path of [
      "/",
      "/legal",
      "/hanabi",
      "/hanabi/game/ABC123",
      "/gamemasters",
      "/designs",
      "/documents",
      "/docs-and-more",
      "/preview/game/ABC123",
      "/hanabi/previews",
    ]) {
      expect(isExcludedPath(path), path).toBe(false)
    }
  })
})
