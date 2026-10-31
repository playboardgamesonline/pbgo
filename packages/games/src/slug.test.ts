import { readdirSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"
import { GAMES } from "./registry"
import { MAX_NAME_LENGTH, MAX_SLUG_LENGTH, RESERVED_SLUGS, SLUG_PATTERN, cleanName, nameFromSlug, nameProblem, slugFromName, slugProblem } from "./slug"

describe("slugFromName", () => {
  it.each([
    ["The Crew", "the-crew"],
    ["Flip 7", "flip-7"],
    ["Dracula vs Van Helsing", "dracula-vs-van-helsing"],
    ["Sky Team", "sky-team"],
    ["Hanabi", "hanabi"],
    ["  Skull   King  ", "skull-king"],
    ["7 Wonders: Duel", "7-wonders-duel"],
    ["Dr. Eureka!", "dr-eureka"],
    ["---Hanabi---", "hanabi"],
  ])("turns %j into %j", (name, slug) => {
    expect(slugFromName(name)).toBe(slug)
  })

  it("drops accents, and splits the letters Unicode does not", () => {
    expect(slugFromName("Échecs & Dames")).toBe("echecs-and-dames")
    expect(slugFromName("ÀÉÎÕÜ")).toBe("aeiou")
    expect(slugFromName("Cœur de Lion")).toBe("coeur-de-lion")
    expect(slugFromName("Straße")).toBe("strasse")
    expect(slugFromName("Łódź")).toBe("lodz")
    expect(slugFromName("Zoë")).toBe("zoe")
  })

  it("removes an apostrophe instead of cutting the word in two", () => {
    expect(slugFromName("Queen's Gambit")).toBe("queens-gambit")
    expect(slugFromName("Queen’s Gambit")).toBe("queens-gambit")
  })

  it("makes nothing out of a name with no Latin letter or digit, for the caller to ask", () => {
    expect(slugFromName("")).toBe("")
    expect(slugFromName("   ")).toBe("")
    expect(slugFromName("!!!")).toBe("")
    expect(slugFromName("花札")).toBe("")
  })

  it("always makes a slug shape", () => {
    for (const name of ["The Crew", "Échecs & Dames", "  a  b  ", "Rock'n'Roll", "100%", "x_y.z", ...GAMES.map((game) => game.name)]) {
      const slug = slugFromName(name)
      if (slug) expect(slug, name).toMatch(SLUG_PATTERN)
    }
  })
})

describe("slugProblem", () => {
  it.each(["the-crew", "6-nimmt", "flip-7", "a", "7-wonders", "x".repeat(MAX_SLUG_LENGTH)])("accepts %j", (slug) => {
    expect(slugProblem(slug)).toBeUndefined()
  })

  it("accepts every slug of the registry", () => {
    for (const { slug } of GAMES) expect(slugProblem(slug), slug).toBeUndefined()
  })

  it.each([
    ["", "The slug is empty"],
    ["The-Crew", "not a slug"],
    ["the crew", "not a slug"],
    ["the_crew", "not a slug"],
    ["-crew", "not a slug"],
    ["crew-", "not a slug"],
    ["the--crew", "not a slug"],
    ["échecs", "not a slug"],
    ["x".repeat(MAX_SLUG_LENGTH + 1), `${MAX_SLUG_LENGTH + 1} characters long`],
  ])("refuses %j", (slug, why) => {
    expect(slugProblem(slug)).toContain(why)
  })

  it("refuses a route of the site, whatever else is true of it", () => {
    for (const slug of RESERVED_SLUGS) expect(slugProblem(slug), slug).toBeTruthy()
    expect(slugProblem("gamemaster")).toContain("route of the site")
    expect(slugProblem("api")).toContain("route of the site")
  })

  it("refuses a game that exists", () => {
    expect(slugProblem("hanabi", ["hanabi", "flip-7"])).toContain("already a game")
    expect(slugProblem("hanabi", ["flip-7"])).toBeUndefined()
  })

  it("names the problem it found first: the shape, then the length, the route, the game", () => {
    expect(slugProblem("Api", ["Api"])).toContain("not a slug")
    expect(slugProblem("api", ["api"])).toContain("route of the site")
  })
})

describe("cleanName", () => {
  it("trims, and joins the words with one space", () => {
    expect(cleanName("  Skull   King ")).toBe("Skull King")
    expect(cleanName("Skull\tKing\n")).toBe("Skull King")
    expect(cleanName("   ")).toBe("")
    expect(cleanName("")).toBe("")
  })

  it("leaves a clean name as it is", () => {
    for (const { name } of GAMES) expect(cleanName(name), name).toBe(name)
  })
})

describe("nameFromSlug", () => {
  it.each([
    ["flip-7", "Flip 7"],
    ["the-crew", "The Crew"],
    ["hanabi", "Hanabi"],
    ["6-nimmt", "6 Nimmt"],
    ["exploding-kittens", "Exploding Kittens"],
  ])("turns %j into %j", (slug, name) => {
    expect(nameFromSlug(slug)).toBe(name)
  })

  it("makes a name that is fine, from a slug that is", () => {
    for (const { slug } of GAMES) expect(nameProblem(nameFromSlug(slug)), slug).toBeUndefined()
  })

  it("makes the slug back for a plain name", () => {
    for (const slug of ["the-crew", "flip-7", "skull-king"]) expect(slugFromName(nameFromSlug(slug))).toBe(slug)
  })
})

describe("nameProblem", () => {
  it.each(["The Crew", "Flip 7", "Échecs & Dames", "Queen's Gambit", "花札", "x".repeat(MAX_NAME_LENGTH)])("accepts %j", (name) => {
    expect(nameProblem(name)).toBeUndefined()
  })

  it("accepts every name of the registry", () => {
    for (const { name } of GAMES) expect(nameProblem(name), name).toBeUndefined()
  })

  it.each(["", "   ", "\t\n"])("refuses %j: nothing to print", (name) => {
    expect(nameProblem(name)).toBe("The name is empty")
  })

  it("refuses a control character, which a terminal or a file would obey", () => {
    for (const name of ["Skull\u001bKing", "Skull\u0000King", "Skull\u007fKing", "Skull\u009bKing"]) {
      expect(nameProblem(name), JSON.stringify(name)).toContain("control character")
    }
  })

  it("takes a tab or a line break for the space it becomes", () => {
    expect(nameProblem("Skull\tKing")).toBeUndefined()
    expect(nameProblem("Skull\nKing")).toBeUndefined()
  })

  it("refuses a name that is too long, and counts characters rather than code units", () => {
    expect(nameProblem("x".repeat(MAX_NAME_LENGTH + 1))).toContain(`${MAX_NAME_LENGTH + 1} characters long`)
    expect(nameProblem("😀".repeat(MAX_NAME_LENGTH))).toBeUndefined()
    expect(nameProblem("😀".repeat(MAX_NAME_LENGTH + 1))).toContain("characters long")
  })

  it("judges the name as it is kept: the white space around it is not counted", () => {
    expect(nameProblem(`  ${"x".repeat(MAX_NAME_LENGTH)}  `)).toBeUndefined()
    expect(nameProblem(`${"x".repeat(MAX_NAME_LENGTH / 2)}      ${"x".repeat(MAX_NAME_LENGTH / 2 - 1)}`)).toBeUndefined()
  })
})

describe("RESERVED_SLUGS", () => {
  const app = fileURLToPath(new URL("../../../apps/web/src/app", import.meta.url))

  // A folder that is a URL segment: not a route group `(x)`, a dynamic segment `[x]`, a private folder `_x`
  const segments = (dir: string) =>
    readdirSync(dir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && !/^[([_]/.test(entry.name))
      .map((entry) => entry.name)

  it("holds every top-level route of apps/web, groups included", () => {
    const groups = readdirSync(app, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && entry.name.startsWith("("))
      .map((entry) => entry.name)
    const routes = [...segments(app), ...groups.flatMap((group) => segments(`${app}/${group}`))]
    expect(routes).toContain("gamemaster")
    for (const route of routes) expect(RESERVED_SLUGS, `/${route} is a route of the app`).toContain(route)
  })

  it("holds the pages and routes that sit next to /gamemaster/<slug>", () => {
    const next = segments(`${app}/gamemaster`)
    expect(next).toContain("login")
    for (const route of next) expect(RESERVED_SLUGS, `/gamemaster/${route} sits next to /gamemaster/<slug>`).toContain(route)
  })

  it("holds the global API routes that sit next to /api/<slug>", () => {
    const next = segments(`${app}/api`)
    expect(next).toContain("media")
    expect(next).toContain("catalog")
    for (const route of next) expect(RESERVED_SLUGS, `/api/${route} sits next to /api/<slug>`).toContain(route)
  })

  it("has no duplicate", () => {
    expect(new Set(RESERVED_SLUGS).size).toBe(RESERVED_SLUGS.length)
  })
})
