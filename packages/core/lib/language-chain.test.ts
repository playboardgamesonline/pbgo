import { ENGLISH_ONLY_TEXTS, UI_TEXTS, type UiTextKey } from "@pbgo/studio-kit/constants"
import { ERROR_TRANSLATIONS, UI_TRANSLATIONS } from "@pbgo/studio-kit/translations"
import { describe, expect, it, vi } from "vitest"

vi.mock("server-only", () => ({}))
vi.mock("./locale-server", () => ({ getLocale: async () => "en" }))

import { ApiClientError, CORE_ERROR_MESSAGES, setErrorOverrides } from "./api"
import type { GameBinding, GameModule } from "./binding"
import { DEFAULT_LOCALE, LOCALES, type Locale } from "./i18n"
import { isMissing } from "./missing"
import { toSettings } from "./settings-server"
import { baseSkin, DEFAULT_TEXTS, mergeSkin } from "./skin"
import { toSkin, type SkinDoc } from "./skin-server"

// The chain of every text: the language asked, then English, then nothing, which a page shows as `[missing: <key>]` when it requires the text and leaves out when it does not.
// Never French (the default before English) and never the first language that has a value.

/**
 * The messages of the platform that exist in English only: the code holds English, and the other languages are added by the language pass (thirteen languages, PLT-32), not written
 * one by one in the code. A visitor reads them in English until then. Translate one in every language of `ERROR_TRANSLATIONS`, then take it out of this list.
 */
const ENGLISH_ONLY = [
  "INVALID_PLAYERS",
  "INVALID_ACTION",
  "INVALID_PHASE",
  "GAME_OVER",
  "UNKNOWN_PLAYER",
  "INVALID_TARGET",
  "GAME_NOT_STARTED",
  "GAME_NOT_OVER",
  "CODE_UNAVAILABLE",
  "INVALID_REQUEST",
  "AGE_SIGN_IN_REQUIRED",
  "AGE_DATE_REQUIRED",
  "AGE_TOO_YOUNG",
  "AGE_TABLE_NOT_ALLOWED",
  "NOT_SIGNED_IN",
  "BIRTHDATE_INVALID",
  "BIRTHDATE_UNDER_MINIMUM",
  "BIRTHDATE_LOCKED",
  "PROFILE_TAKEN",
  "PROFILE_INVALID",
  "PROFILE_UNAVAILABLE",
  "CROSS_ORIGIN",
  "PLAYER_BUSY",
  "RANK_TOO_LOW",
  "LANGUAGE_MISMATCH",
  "SETTINGS_UNAVAILABLE",
  "LEFT_GAME",
]

const game = { sanityProjectId: "abc123xy" }
const texts = (fields: Record<string, unknown>): SkinDoc => ({ texts: fields }) as SkinDoc

/** What a page of the game shows in a language, from the texts of its Sanity project. */
const skinOf = (doc: SkinDoc, locale: Locale) => mergeSkin(baseSkin({} as GameBinding, locale), toSkin(game, doc, locale))

describe("the skin of a game", () => {
  const victoryPhrases = { _type: "localeStringList", fr: ["Bravo"], en: ["Well played"] }

  it("reads the words of the engine's options and score lines in the language asked, then in English", () => {
    const engineTexts = [
      { key: "option.rounds.label", text: { _type: "localeText", en: "Rounds", fr: "Manches" } },
      { key: "option.fast.label", text: { _type: "localeText", en: "Fast game" } },
      { key: "score.round", text: { _type: "localeText", fr: "Manche {n}" } },
    ]
    expect(skinOf(texts({ engineTexts }), "fr").engineTexts).toEqual({ "option.rounds.label": "Manches", "option.fast.label": "Fast game", "score.round": "Manche {n}" })
    expect(skinOf(texts({ engineTexts }), "de").engineTexts).toEqual({ "option.rounds.label": "Rounds", "option.fast.label": "Fast game" })
    expect(skinOf(texts({}), "fr").engineTexts).toEqual({})
  })

  it("reads the language asked, then English", () => {
    expect(skinOf(texts({ victoryPhrases }), "fr").victoryPhrases).toEqual(["Bravo"])
    expect(skinOf(texts({ victoryPhrases }), "en").victoryPhrases).toEqual(["Well played"])
    expect(skinOf(texts({ victoryPhrases }), "es").victoryPhrases).toEqual(["Well played"])
    expect(skinOf(texts({ victoryPhrases }), "de").victoryPhrases).toEqual(["Well played"])
  })

  it("reads [missing: <key>] when neither the language asked nor English has the text, French or not", () => {
    const frenchOnly = texts({ victoryPhrases: { fr: ["Bravo"] } })
    for (const locale of ["en", "es", "de"] as const) expect(skinOf(frenchOnly, locale).victoryPhrases).toEqual(["[missing: victoryPhrases]"])
    expect(skinOf(frenchOnly, "fr").victoryPhrases).toEqual(["Bravo"])
  })

  it("takes the victory sentences of the language asked, else those of English", () => {
    const doc = texts({ victoryPhrases: { fr: ["Bravo"], en: ["Well played", "Champion"], es: [] } })
    expect(skinOf(doc, "fr").victoryPhrases).toEqual(["Bravo"])
    expect(skinOf(doc, "es").victoryPhrases).toEqual(["Well played", "Champion"])
    expect(skinOf(doc, "en").victoryPhrases).toEqual(["Well played", "Champion"])
  })

  it("replaces a label of the interface only in the language it is written in: the platform has its own wording in the others", () => {
    const doc = texts({ ui_home: { menu: { en: "Open the menu" } } })
    expect(skinOf(doc, "en").texts.menu).toBe("Open the menu")
    expect(skinOf(doc, "es").texts.menu).toBe(UI_TRANSLATIONS.es.menu)
    expect(skinOf(doc, "fr").texts.menu).toBe(UI_TRANSLATIONS.fr.menu)
    expect(skinOf(doc, "de").texts.menu).toBe(UI_TRANSLATIONS.de.menu)
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
    expect(toSkin(game, texts({ victoryPhrases }))).toMatchObject({ victoryPhrases: ["Well played"] })
  })

  it("keeps the platform's default skin, markers included, when Sanity holds nothing", () => {
    const skin = skinOf(null, "en")
    expect(skin.victoryPhrases.every(isMissing)).toBe(true)
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

  it("gives the labels that exist in English only to every language, in English, until the language pass translates them", () => {
    expect(Object.keys(ENGLISH_ONLY_TEXTS).filter((key) => !UI_TEXTS.some((t) => t.key === key)), "a label of ENGLISH_ONLY_TEXTS that UI_TEXTS does not list").toEqual([])
    for (const [key, text] of Object.entries(ENGLISH_ONLY_TEXTS)) {
      for (const locale of LOCALES) expect(UI_TRANSLATIONS[locale][key as UiTextKey], `${locale}.${key}`).toBe(text)
    }
    expect(baseSkin({} as GameBinding, "de").texts.defeatTitle).toBe("Defeat")
  })

  it("has every error of the platform in English, the one core carries, and in each other language every one but the ones that exist in English only", () => {
    const codes = Object.keys(CORE_ERROR_MESSAGES).sort()
    expect(CORE_ERROR_MESSAGES).toEqual(ERROR_TRANSLATIONS.en)
    for (const locale of LOCALES) {
      const expected = locale === DEFAULT_LOCALE ? codes : codes.filter((code) => !ENGLISH_ONLY.includes(code))
      expect(Object.keys(ERROR_TRANSLATIONS[locale]).sort(), locale).toEqual(expected)
    }
    expect(ENGLISH_ONLY.filter((code) => !(code in CORE_ERROR_MESSAGES)), "a code of ENGLISH_ONLY that core no longer words").toEqual([])
    expect(ERROR_TRANSLATIONS.fr.GAME_FULL).toBe("Cette partie est complète.")
    expect(CORE_ERROR_MESSAGES.GAME_FULL).toBe("This game is full.")
  })

  it("lets a visitor read an error that has no translation in their language in English", () => {
    setErrorOverrides(baseSkin({} as GameBinding, "fr").errors)
    expect(ERROR_TRANSLATIONS.fr.GAME_OVER).toBeUndefined()
    expect(new ApiClientError("GAME_OVER").message).toBe(CORE_ERROR_MESSAGES.GAME_OVER)
    expect(new ApiClientError("GAME_FULL").message).toBe(ERROR_TRANSLATIONS.fr.GAME_FULL)
    setErrorOverrides({})
  })

  it("keeps the variables of each label and each message in every language", () => {
    const variables = (text: string) => (text.match(/\{\w+\}/g) ?? []).sort().join(" ")
    for (const locale of LOCALES) {
      for (const key of Object.keys(UI_TRANSLATIONS.en) as (keyof (typeof UI_TRANSLATIONS)["en"])[]) expect(variables(UI_TRANSLATIONS[locale][key]), `${locale}.${key}`).toBe(variables(UI_TRANSLATIONS.en[key]))
      for (const code of Object.keys(ERROR_TRANSLATIONS[locale])) expect(variables(ERROR_TRANSLATIONS[locale][code]!), `${locale}.${code}`).toBe(variables(CORE_ERROR_MESSAGES[code]!))
    }
  })
})
