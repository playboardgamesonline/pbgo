import { UI_TEXTS } from "@pbgo/studio-kit/constants"
import { ERROR_TRANSLATIONS, UI_TRANSLATIONS } from "@pbgo/studio-kit/translations"
import { describe, expect, it, vi } from "vitest"

vi.mock("server-only", () => ({}))
vi.mock("./locale-server", () => ({ getLocale: async () => "en" }))

import { CORE_ERROR_MESSAGES } from "./api"
import type { GameBinding, GameModule } from "./binding"
import { LOCALES, type Locale } from "./i18n"
import { isMissing } from "./missing"
import { toSettings } from "./settings-server"
import { baseSkin, DEFAULT_TEXTS, mergeSkin } from "./skin"
import { toSkin, type SkinDoc } from "./skin-server"

// The chain of every text: the language asked, then English, then nothing, which a page shows as `[missing: <key>]` when it requires the text and leaves out when it does not.
// Never French (the default before English) and never the first language that has a value.

const game = { sanityProjectId: "abc123xy" }
const texts = (fields: Record<string, unknown>): SkinDoc => ({ texts: fields }) as SkinDoc

/** What a page of the game shows in a language, from the texts of its Sanity project. */
const skinOf = (doc: SkinDoc, locale: Locale) => mergeSkin(baseSkin({} as GameBinding, locale), toSkin(game, doc, locale))

describe("the skin of a game", () => {
  const tagline = { _type: "localeString", fr: "Une accroche", en: "A tagline" }

  it("reads the language asked, then English", () => {
    expect(skinOf(texts({ tagline }), "fr").home.tagline).toBe("Une accroche")
    expect(skinOf(texts({ tagline }), "en").home.tagline).toBe("A tagline")
    expect(skinOf(texts({ tagline }), "es").home.tagline).toBe("A tagline")
    expect(skinOf(texts({ tagline }), "de").home.tagline).toBe("A tagline")
  })

  it("reads [missing: <key>] when neither the language asked nor English has the text, French or not", () => {
    const frenchOnly = texts({ tagline: { fr: "Une accroche" }, victoryPhrases: { fr: ["Bravo"] } })
    for (const locale of ["en", "es", "de"] as const) {
      const skin = skinOf(frenchOnly, locale)
      expect(skin.home.tagline).toBe("[missing: home.tagline]")
      expect(skin.victoryPhrases).toEqual(["[missing: victoryPhrases]"])
    }
    expect(skinOf(frenchOnly, "fr").home.tagline).toBe("Une accroche")
  })

  it("draws nothing for the optional texts that nobody wrote, and takes English for them in the other languages", () => {
    const doc = texts({ homeTitle: { en: "Welcome" }, homeIntro: { fr: "Bienvenue" } })
    expect(skinOf(doc, "en").home).toMatchObject({ title: "Welcome", intro: null })
    expect(skinOf(doc, "es").home).toMatchObject({ title: "Welcome", intro: null })
    expect(skinOf(doc, "fr").home).toMatchObject({ title: "Welcome", intro: "Bienvenue" })
  })

  it("takes the victory sentences of the language asked, else those of English", () => {
    const doc = texts({ victoryPhrases: { fr: ["Bravo"], en: ["Well played", "Champion"], es: [] } })
    expect(skinOf(doc, "fr").victoryPhrases).toEqual(["Bravo"])
    expect(skinOf(doc, "es").victoryPhrases).toEqual(["Well played", "Champion"])
    expect(skinOf(doc, "en").victoryPhrases).toEqual(["Well played", "Champion"])
  })

  it("replaces a label of the interface only in the language it is written in: the platform has its own wording in the others", () => {
    const doc = texts({ ui_home: { createButton: { en: "Start a table" } } })
    expect(skinOf(doc, "en").texts.createButton).toBe("Start a table")
    expect(skinOf(doc, "es").texts.createButton).toBe(UI_TRANSLATIONS.es.createButton)
    expect(skinOf(doc, "fr").texts.createButton).toBe(UI_TRANSLATIONS.fr.createButton)
    expect(skinOf(doc, "de").texts.createButton).toBe(UI_TRANSLATIONS.de.createButton)
  })

  it("does the same for the messages of the platform's own errors, and the chain for those of the game", () => {
    const message = (code: string, values: Record<string, string>) => ({ _key: code, _type: "errorMessage", code, message: { _type: "localeString", ...values } })
    const doc = texts({
      errorMessages: [message("GAME_FULL", { en: "Table full!" }), message("NOT_ENOUGH_MISSIONS", { en: "Not enough missions" }), message("GAME_OVER_ALREADY", { fr: "Déjà fini" })],
    })
    // a code of the platform: written in the language, else the platform's own wording of that language
    expect(skinOf(doc, "en").errors.GAME_FULL).toBe("Table full!")
    expect(skinOf(doc, "es").errors.GAME_FULL).toBe(ERROR_TRANSLATIONS.es.GAME_FULL)
    expect(skinOf(doc, "fr").errors.GAME_FULL).toBe(ERROR_TRANSLATIONS.fr.GAME_FULL)
    // a code of the game, which the platform has no wording for: the language asked, then English, then nothing (the page then reads [missing: errorMessages.<code>])
    expect(skinOf(doc, "es").errors.NOT_ENOUGH_MISSIONS).toBe("Not enough missions")
    expect(skinOf(doc, "en").errors.NOT_ENOUGH_MISSIONS).toBe("Not enough missions")
    expect(skinOf(doc, "en").errors.GAME_OVER_ALREADY).toBeUndefined()
    expect(skinOf(doc, "de").errors.GAME_OVER_ALREADY).toBeUndefined()
    expect(skinOf(doc, "fr").errors.GAME_OVER_ALREADY).toBe("Déjà fini")
  })

  it("is in English when no language is asked", () => {
    expect(toSkin(game, texts({ tagline }))).toMatchObject({ home: { tagline: "A tagline" } })
  })

  it("keeps the platform's default skin, markers included, when Sanity holds nothing", () => {
    const skin = skinOf(null, "en")
    expect(isMissing(skin.home.tagline ?? "")).toBe(true)
    expect(skin.texts).toEqual(DEFAULT_TEXTS)
  })
})

describe("the settings of a game", () => {
  const sample = {
    slug: "sample",
    name: "Sample",
    sanityProjectId: "abc123xy",
    binding: { SLUG: "sample", NAME: "Sample", GAME: { minPlayers: 2, maxPlayers: 5, options: {} } },
  } as unknown as GameModule

  const doc = { title: "Sample", descriptionI18n: { fr: "Une description", en: "A description" }, creditsAuthorsI18n: { fr: "Jeanne", en: "Jane" } }

  it("reads the language asked, then English", () => {
    expect(toSettings(sample, doc, "fr")).toMatchObject({ description: "Une description", credits: { authors: "Jeanne" } })
    expect(toSettings(sample, doc, "en")).toMatchObject({ description: "A description", credits: { authors: "Jane" } })
    expect(toSettings(sample, doc, "es")).toMatchObject({ description: "A description", credits: { authors: "Jane" } })
  })

  it("is in English when no language is asked", () => {
    expect(toSettings(sample, doc).description).toBe("A description")
  })

  it("reads no description rather than the French one when English has none", () => {
    const frenchOnly = { title: "Sample", descriptionI18n: { fr: "Une description" }, creditsAuthorsI18n: { fr: "Jeanne" } }
    for (const locale of ["en", "es", "de"] as const) expect(toSettings(sample, frenchOnly, locale)).toMatchObject({ description: "", credits: { authors: null } })
    expect(toSettings(sample, frenchOnly, "fr")).toMatchObject({ description: "Une description", credits: { authors: "Jeanne" } })
  })

  it("reads the single-language fields that the translated ones replaced as French", () => {
    const legacy = { title: "Sample", description: "Une description", creditsAuthors: "Jeanne" }
    expect(toSettings(sample, legacy, "fr")).toMatchObject({ description: "Une description", credits: { authors: "Jeanne" } })
    expect(toSettings(sample, legacy, "en")).toMatchObject({ description: "", credits: { authors: null } })
    expect(toSettings(sample, legacy).descriptions.fr).toBe("Une description")
  })
})

describe("the platform's own wording", () => {
  it("has every shared label in every language of the games, English being the default", () => {
    const keys = UI_TEXTS.map((t) => t.key).sort()
    for (const locale of LOCALES) {
      expect(Object.keys(UI_TRANSLATIONS[locale]).sort(), locale).toEqual(keys)
      for (const key of keys) expect(UI_TRANSLATIONS[locale][key as keyof (typeof UI_TRANSLATIONS)["en"]]?.trim(), `${locale}.${key}`).toBeTruthy()
    }
    expect(DEFAULT_TEXTS).toEqual(UI_TRANSLATIONS.en)
  })

  it("keeps French as the text each label of the interface carries", () => {
    for (const { key, fr } of UI_TEXTS) expect(UI_TRANSLATIONS.fr[key], key).toBe(fr)
    expect(UI_TRANSLATIONS.fr.scoreboard).toBe("Tableau des scores")
    expect(UI_TRANSLATIONS.en.scoreboard).toBe("Scoreboard")
  })

  it("has every error of the platform in every language, English being the one core carries", () => {
    const codes = Object.keys(CORE_ERROR_MESSAGES).sort()
    for (const locale of LOCALES) expect(Object.keys(ERROR_TRANSLATIONS[locale]).sort(), locale).toEqual(codes)
    expect(CORE_ERROR_MESSAGES).toEqual(ERROR_TRANSLATIONS.en)
    expect(ERROR_TRANSLATIONS.fr.GAME_FULL).toBe("Cette partie est complète.")
    expect(CORE_ERROR_MESSAGES.GAME_FULL).toBe("This game is full.")
  })

  it("keeps the variables of each label and each message in every language", () => {
    const variables = (text: string) => (text.match(/\{\w+\}/g) ?? []).sort().join(" ")
    for (const locale of LOCALES) {
      for (const key of Object.keys(UI_TRANSLATIONS.en) as (keyof (typeof UI_TRANSLATIONS)["en"])[]) expect(variables(UI_TRANSLATIONS[locale][key]), `${locale}.${key}`).toBe(variables(UI_TRANSLATIONS.en[key]))
      for (const code of Object.keys(CORE_ERROR_MESSAGES)) expect(variables(ERROR_TRANSLATIONS[locale][code]!), `${locale}.${code}`).toBe(variables(CORE_ERROR_MESSAGES[code]!))
    }
  })
})
