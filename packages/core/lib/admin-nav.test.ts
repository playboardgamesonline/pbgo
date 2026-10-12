import { describe, expect, it } from "vitest"
import {
  ADMIN_ITEMS,
  GAMEMASTER_PATH,
  LOGIN_PATH,
  adminApiBase,
  adminHref,
  findAdminItem,
  previewHref,
  safeNext,
  sectionOf,
  switchHref,
} from "./admin-nav"
import { PREVIEW_PATH } from "./preview"

describe("safeNext", () => {
  it("keeps a page of the gamemaster, with its query and hash", () => {
    for (const next of [
      "/gamemaster",
      "/gamemaster/",
      "/gamemaster/skyjo",
      "/gamemaster/skyjo/identity",
      "/gamemaster/6-nimmt/tasks/launch",
      "/gamemaster/skyjo/identity?saved=1",
      "/gamemaster/skyjo/identity#top",
      "/gamemaster?x=1",
    ]) {
      expect(safeNext(next)).toBe(next)
    }
  })

  it("sends anything else to the overview, so the parameter is not an open redirect", () => {
    for (const next of [
      undefined,
      null,
      42,
      ["/gamemaster/skyjo/identity"],
      "",
      "/",
      "/skyjo/admin",
      "//evil.example",
      "//evil.example/gamemaster",
      "https://evil.example/gamemaster",
      "javascript:alert(1)",
      "gamemaster",
      "/gamemasterx",
      "/gamemaster.evil.example",
      "/gamemaster\\evil.example",
      "/gamemaster/\\evil.example",
      "/\\evil.example",
      "/gamemaster/skyjo\r\nSet-Cookie: a=b",
      "/gamemaster/skyjo\tidentity",
      "/gamemaster/skyjo/\u0000",
    ]) {
      expect(safeNext(next)).toBe(GAMEMASTER_PATH)
    }
  })

  it("never comes back to the login page or the API after signing in", () => {
    for (const next of [LOGIN_PATH, `${LOGIN_PATH}/`, `${LOGIN_PATH}?next=/gamemaster`, "/gamemaster/api", "/gamemaster/api/login", "/gamemaster/api/skyjo/settings"]) {
      expect(safeNext(next)).toBe(GAMEMASTER_PATH)
    }
    // A game that merely starts with the same letters is a normal page.
    expect(safeNext("/gamemaster/login-game/identity")).toBe("/gamemaster/login-game/identity")
    expect(safeNext("/gamemaster/apiary/identity")).toBe("/gamemaster/apiary/identity")
  })
})

describe("gamemaster URLs", () => {
  it("builds the page of a game, the first one when no page is given", () => {
    expect(adminHref("skyjo")).toBe("/gamemaster/skyjo")
    expect(adminHref("skyjo", "")).toBe("/gamemaster/skyjo")
    expect(adminHref("6-nimmt", "tasks/launch")).toBe("/gamemaster/6-nimmt/tasks/launch")
  })

  it("keeps the admin API and the previews below /gamemaster, where the session cookie is sent", () => {
    expect(adminApiBase("skyjo")).toBe("/gamemaster/api/skyjo")
    expect(previewHref("skyjo", "home")).toBe("/gamemaster/skyjo/preview/home")
    expect(previewHref("skyjo", "game")).toBe("/gamemaster/skyjo/preview/game")
  })

  it("is read as a preview by the game, which the rewrite serves at the same URL", () => {
    expect(PREVIEW_PATH.test(previewHref("skyjo", "home"))).toBe(true)
    expect(PREVIEW_PATH.test("/skyjo/preview/game")).toBe(true)
    expect(PREVIEW_PATH.test("/skyjo/game/ABCD")).toBe(false)
    expect(PREVIEW_PATH.test("/gamemaster/skyjo/identity")).toBe(false)
  })
})

describe("sectionOf", () => {
  it("finds the sidebar page of an admin pathname", () => {
    expect(sectionOf("/gamemaster/skyjo/identity")).toBe("identity")
    expect(sectionOf("/gamemaster/6-nimmt/tasks/launch")).toBe("tasks/launch")
    expect(sectionOf("/gamemaster/skyjo/monitoring/health")).toBe("monitoring/health")
  })

  it("is null on the overview, the login page, a bare game and unknown pages", () => {
    for (const pathname of [undefined, null, "", "/", "/gamemaster", "/gamemaster/login", "/gamemaster/skyjo", "/gamemaster/skyjo/unknown", "/gamemaster/skyjo/tasks", "/skyjo/identity"]) {
      expect(sectionOf(pathname)).toBeNull()
    }
  })

  it("knows every page of the sidebar", () => {
    for (const { path } of ADMIN_ITEMS) {
      expect(sectionOf(adminHref("skyjo", path))).toBe(path)
      expect(findAdminItem(path)?.path).toBe(path)
    }
  })
})

describe("switchHref", () => {
  it("keeps the current page when the game changes", () => {
    expect(switchHref("trio", "/gamemaster/skyjo/mechanics")).toBe("/gamemaster/trio/mechanics")
    expect(switchHref("6-nimmt", "/gamemaster/skyjo/tasks/bugs")).toBe("/gamemaster/6-nimmt/tasks/bugs")
  })

  it("opens the first page (Identity) from the overview and from pages that are not in the sidebar", () => {
    expect(switchHref("trio", "/gamemaster")).toBe("/gamemaster/trio/identity")
    expect(switchHref("trio", "/gamemaster/skyjo")).toBe("/gamemaster/trio/identity")
    expect(switchHref("trio", null)).toBe("/gamemaster/trio/identity")
  })
})
