import { FAMILIES, ROLES } from "@courtisans/engine"
import type { LoaderContext } from "@pbgo/core/lib/binding"
import type { Locale } from "@pbgo/core/lib/i18n"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("server-only", () => ({}))

const sanity = vi.hoisted(() => ({ catalog: null as unknown }))
vi.mock("./catalog", () => ({ getCatalog: async () => sanity.catalog }))

import { WORD_FIELDS } from "../lib/catalog"
import { getClientCatalog } from "./catalog-client"

// What a player reads on the cards and the board of Courtisans is in Sanity, in the language asked, else English. A text that neither language has reads [missing: <key>]: the game of the
// platform is read in English by default, and no mission may read in French for a player who asked for something else.

const words = (values: Record<string, string>) => ({ _type: "localeString", ...values })

/** The `texts`, `families` and `roles` of a project that has every text in French and English, and the missions given. */
function project(missions: { _id: string; text: Record<string, string> }[]) {
  return {
    game: null,
    texts: {
      missionsButton: words({ fr: "Missions", en: "Missions" }),
      banquetStarts: words({ fr: "Le banquet commence", en: "The banquet starts" }),
      statusLight: { _type: "localeStringList", fr: ["dans la lumière"], en: ["in the light"] },
      statusDisgrace: { _type: "localeStringList", fr: ["en disgrâce"], en: ["in disgrace"] },
      ...Object.fromEntries(WORD_FIELDS.map((field) => [field, words({ fr: `${field} (fr)`, en: `${field} (en)` })])),
    },
    families: FAMILIES.map((key) => ({ _id: key, key, name: words({ fr: `${key} (fr)`, en: `${key} (en)` }), color: "#336699", pictogram: null })),
    roles: ROLES.map((key) => ({ _id: key, key, name: words({ fr: `${key} (fr)`, en: `${key} (en)` }), countPerFamily: 1, pictogram: null })),
    courtiers: [],
    missions: missions.map((m) => ({ ...m, color: "white", text: { _type: "localeText", ...m.text }, card: null, condition: {} })),
  }
}

const load = (locale: Locale) => getClientCatalog({ game: { slug: "courtisans" }, locale, sanity: {} } as unknown as LoaderContext)

const errors = vi.spyOn(console, "error").mockImplementation(() => {})

beforeEach(() => {
  errors.mockClear()
  sanity.catalog = project([
    { _id: "mission-white-1", text: { fr: "Texte français", en: "English text", es: "Texto español", de: "Deutscher Text" } },
    { _id: "mission-dark-8", text: { fr: "Seulement en français" } },
    { _id: "mission-dark-9", text: { fr: "Français et allemand", de: "Deutsch" } },
  ])
})

afterEach(() => errors.mockClear())

describe("the mission texts of Courtisans", () => {
  it("are read in the language asked", async () => {
    expect((await load("fr")).missionTexts["mission-white-1"]).toBe("Texte français")
    expect((await load("es")).missionTexts["mission-white-1"]).toBe("Texto español")
    expect((await load("de")).missionTexts["mission-dark-9"]).toBe("Deutsch")
    expect((await load("en")).missionTexts["mission-white-1"]).toBe("English text")
  })

  it("are read in English when the language asked has none of its own", async () => {
    sanity.catalog = project([{ _id: "mission-white-2", text: { fr: "Texte français", en: "English text" } }])
    expect((await load("es")).missionTexts["mission-white-2"]).toBe("English text")
    expect((await load("de")).missionTexts["mission-white-2"]).toBe("English text")
  })

  it("read [missing: <key>] when neither the language asked nor English has one, even if French has: never French, never another language", async () => {
    for (const locale of ["en", "es"] as const) {
      const { missionTexts } = await load(locale)
      expect(missionTexts["mission-dark-8"], locale).toBe("[missing: missions.mission-dark-8]")
      expect(missionTexts["mission-dark-9"], locale).toBe("[missing: missions.mission-dark-9]")
    }
    expect((await load("fr")).missionTexts["mission-dark-8"]).toBe("Seulement en français")
  })

  it("are reported once in the server log, with the key of the text", async () => {
    // a fresh copy of the loader: it remembers what it has reported
    vi.resetModules()
    const { getClientCatalog: fresh } = await import("./catalog-client")
    const ask = () => fresh({ game: { slug: "courtisans" }, locale: "en", sanity: {} } as unknown as LoaderContext)
    await ask()
    await ask()
    const lines = errors.mock.calls.map((call) => String(call[0]))
    expect(lines.filter((line) => line.includes("missions.mission-dark-8"))).toHaveLength(1)
    expect(lines.find((line) => line.includes("missions.mission-dark-8"))).toBe("[missing] courtisans (en): missions.mission-dark-8 is not in Sanity")
  })
})

describe("the other texts of Courtisans", () => {
  it("are read in the language asked, else English", async () => {
    const fr = await load("fr")
    const es = await load("es")
    expect(fr.missionsButtonText).toBe("Missions")
    expect(fr.banquetStartText).toBe("Le banquet commence")
    expect(es.banquetStartText).toBe("The banquet starts")
    expect(es.words.youPlay).toBe("youPlay (en)")
    expect(fr.words.youPlay).toBe("youPlay (fr)")
    expect(es.families.toad.name).toBe("toad (en)")
    expect(es.roles.spy.name).toBe("spy (en)")
    expect(fr.families.toad.name).toBe("toad (fr)")
  })

  it("read [missing: <key>] when English has none either", async () => {
    sanity.catalog = {
      ...(project([]) as object),
      texts: { missionsButton: words({ fr: "Missions" }), banquetStarts: words({}), statusLight: { _type: "localeStringList" }, statusDisgrace: { _type: "localeStringList" } },
    }
    const en = await load("en")
    expect(en.missionsButtonText).toBe("[missing: missionsButton]")
    expect(en.banquetStartText).toBe("[missing: banquetStarts]")
    expect(en.words.youPlay).toBe("[missing: youPlay]")
    expect((await load("fr")).missionsButtonText).toBe("Missions")
  })
})
