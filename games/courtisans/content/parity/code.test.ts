import type { Family, Role } from "@courtisans/engine"
import { LANGUAGE_IDS } from "@pbgo/content-kit"
import type { LanguageId } from "@pbgo/content-kit"
import type { Doc } from "@pbgo/content-kit/testing"
import { describe, expect, it } from "vitest"
import { familyId } from "../data/families.ts"
import { MISSION_IDS } from "../data/missions.ts"
import { roleId } from "../data/roles.ts"
import { seedDocs } from "../data/test-fixtures.ts"
import { TEXTS_ID } from "../data/texts.ts"
import { GAME, I18N, defaultMissionTexts } from "../../src/lib/i18n"
import { ROLE_RULE_TEXTS } from "../../src/lib/i18n-rules"
import { ERROR_MESSAGES, TAGLINE } from "../../src/lib/site"
import { DEFAULT_SKIN } from "../../src/lib/skin"

// The seed against the code (GAM-20), read from the code itself rather than copied: the translations the seed writes into Sanity are the ones the
// game shows today when Sanity has none, word for word. This test keeps the two equal until the fallbacks are removed from the code (the last step of
// "everything in Sanity"); then the code side of this folder goes with them, and the seed stays as the record of what was written.
//
// This folder has its own tsconfig. The code is read by Vitest only: the seed runs directly with Node and never imports it.
// The modules of `src/lib` import without extensions and from `@pbgo/core` and `@courtisans/engine`, which is not the erasable syntax the rest of `content/` keeps for Node.

/** The missions of the code that the seed leaves out: the live Studio words them differently (and sets another condition), and an editor decides which wording stays. */
const LEFT_OUT = ["mission-dark-8", "mission-dark-9", "mission-dark-10"]

/** What the code holds in the dictionary of a language beyond the texts of the seed: the board and the rules page, which have no field in the Studio. */
const COVERED_BY_THE_SEED = ["families", "roles", "missions", "missionsButton", "banquetStart"]
const LEFT_IN_THE_CODE = [
  "courtier",
  "status",
  "zone",
  "you",
  "they",
  "gameOverLog",
  "missionsSucceeded",
  "noAssassination",
  "skip",
  "homeHeading",
  "seo",
  "rules",
]

const GROUPS = ["ui_home", "ui_lobby", "ui_game"] as const

const docOf = (id: string): Doc => {
  const doc = seedDocs().find((candidate) => candidate._id === id)
  if (!doc) throw new Error(`No seed document "${id}"`)
  return doc
}

/** A value the code must have: the test says what is missing instead of comparing with nothing. */
function defined<T>(value: T | null | undefined, what: string): T {
  if (value === undefined || value === null) throw new Error(`The code has no ${what}`)
  return value
}

const families = Object.keys(GAME.fr.families) as Family[]
const roles = Object.keys(GAME.fr.roles) as Role[]

/** The skin the code carries in a language: the defaults of the game for French, its `I18N` for the others. */
const skinOf = (language: LanguageId) => (language === "fr" ? DEFAULT_SKIN : defined(I18N[language]?.skin, `skin in ${language}`))

const homeOf = (language: LanguageId) => defined(skinOf(language).home, `home in ${language}`)

const textsOf = (language: LanguageId) => defined(skinOf(language).texts, `interface texts in ${language}`) as Record<string, string | undefined>

const errorsOf = (language: LanguageId): Record<string, string> => (language === "fr" ? ERROR_MESSAGES : defined(I18N[language]?.errors, `error messages in ${language}`))

/** The interface labels of the seed, group by group. */
const labels = () =>
  GROUPS.flatMap((group) => Object.entries(docOf(TEXTS_ID)[group] as Record<string, Record<LanguageId, string>>).map(([key, value]) => ({ group, key, value })))

const errorMessages = () => docOf(TEXTS_ID).errorMessages as { code: string; message: Record<LanguageId, string> }[]

describe("the seed against the code", () => {
  describe("the families", () => {
    it("are the families of the code", () => {
      const seeded = seedDocs().filter((doc) => doc._type === "family")
      expect(seeded.map((doc) => doc._id).sort()).toEqual(families.map((key) => familyId(key)).sort())
    })

    it.each(LANGUAGE_IDS)("are named in %s as the code names them", (language) => {
      for (const key of families) expect(docOf(familyId(key)).name[language], `${key} in ${language}`).toBe(GAME[language].families[key].name)
    })
  })

  describe("the roles", () => {
    it("are the roles of the code", () => {
      const seeded = seedDocs().filter((doc) => doc._type === "role")
      expect(seeded.map((doc) => doc._id).sort()).toEqual(roles.map((key) => roleId(key)).sort())
    })

    it.each(LANGUAGE_IDS)("are named in %s as the code names them", (language) => {
      for (const key of roles) expect(docOf(roleId(key)).name[language], `${key} in ${language}`).toBe(GAME[language].roles[key].name)
    })

    it.each(LANGUAGE_IDS)("have in %s the rule the code gives them", (language) => {
      for (const key of roles) expect(docOf(roleId(key)).rule[language], `${key} in ${language}`).toBe(ROLE_RULE_TEXTS[language][key])
    })
  })

  describe("the missions", () => {
    it("are the missions of the code, but the three whose wording the live Studio keeps", () => {
      const inTheCode = Object.keys(defaultMissionTexts("fr"))
      expect(inTheCode.filter((id) => !LEFT_OUT.includes(id)).sort()).toEqual([...MISSION_IDS].sort())
      expect(inTheCode.filter((id) => LEFT_OUT.includes(id)).sort()).toEqual([...LEFT_OUT].sort())
    })

    it("are the same in every language of the code", () => {
      const ids = Object.keys(defaultMissionTexts("fr")).sort()
      for (const language of LANGUAGE_IDS) expect(Object.keys(defaultMissionTexts(language)).sort(), language).toEqual(ids)
    })

    it.each(LANGUAGE_IDS)("read in %s as the code writes them", (language) => {
      const inTheCode = defaultMissionTexts(language)
      for (const id of MISSION_IDS) expect(docOf(id).text[language], `${id} in ${language}`).toBe(inTheCode[id])
    })
  })

  describe("the texts", () => {
    it.each(LANGUAGE_IDS)("give in %s the tagline, the title and the introduction of the home page that the code shows", (language) => {
      const texts = docOf(TEXTS_ID)
      expect(texts.tagline[language], "tagline").toBe(language === "fr" ? TAGLINE : defined(homeOf(language).tagline, `tagline in ${language}`))
      expect(texts.homeTitle[language], "homeTitle").toBe(defined(homeOf(language).title, `home title in ${language}`))
      expect(texts.homeIntro[language], "homeIntro").toBe(defined(homeOf(language).intro, `home introduction in ${language}`))
    })

    it.each(LANGUAGE_IDS)("give in %s the victory sentences that the code shows", (language) => {
      const phrases = docOf(TEXTS_ID).victoryPhrases as Record<LanguageId, string[]>
      expect(phrases[language]).toEqual(defined(skinOf(language).victoryPhrases, `victory sentences in ${language}`))
    })

    it.each(LANGUAGE_IDS)("give in %s the button of the missions and the start of the banquet that the code shows", (language) => {
      const texts = docOf(TEXTS_ID)
      expect(texts.missionsButton[language], "missionsButton").toBe(GAME[language].missionsButton)
      expect(texts.banquetStarts[language], "banquetStarts").toBe(GAME[language].banquetStart)
    })
  })

  describe("the interface labels", () => {
    it.each(LANGUAGE_IDS)("are the ones the code has in %s, no more and no less", (language) => {
      expect(labels().map(({ key }) => key).sort()).toEqual(Object.keys(textsOf(language)).sort())
    })

    it.each(LANGUAGE_IDS)("read in %s as the code writes them", (language) => {
      const inTheCode = textsOf(language)
      for (const { group, key, value } of labels()) expect(value[language], `${group}.${key} in ${language}`).toBe(inTheCode[key])
    })
  })

  describe("the error messages", () => {
    it.each(LANGUAGE_IDS)("are the ones the code has in %s, no more and no less", (language) => {
      expect(errorMessages().map(({ code }) => code).sort()).toEqual(Object.keys(errorsOf(language)).sort())
    })

    it.each(LANGUAGE_IDS)("read in %s as the code writes them", (language) => {
      const inTheCode = errorsOf(language)
      for (const { code, message } of errorMessages()) expect(message[language], `${code} in ${language}`).toBe(inTheCode[code])
    })
  })

  describe("what the code keeps beyond the seed", () => {
    it("is the board and the rules page: a new text of the dictionary has to be put in the seed, or listed here as one that stays in the code", () => {
      // `statusVariants` is optional (French only: other wordings of a status that mission texts use), so it is not a key every language has
      for (const language of LANGUAGE_IDS) expect(Object.keys(GAME[language]).filter((key) => key !== "statusVariants").sort(), language).toEqual([...COVERED_BY_THE_SEED, ...LEFT_IN_THE_CODE].sort())
    })

    it("holds the description and the authors of each language, which the settings of the Studio already have in the four languages", () => {
      for (const language of LANGUAGE_IDS.filter((candidate) => candidate !== "fr")) {
        const i18n = defined(I18N[language], `I18N in ${language}`)
        expect(Object.keys(i18n).sort(), language).toEqual(["authors", "description", "errors", "skin"])
        expect(Object.keys(defined(i18n.skin, `skin in ${language}`)).sort(), language).toEqual(["home", "texts", "victoryPhrases"])
      }
    })
  })
})
