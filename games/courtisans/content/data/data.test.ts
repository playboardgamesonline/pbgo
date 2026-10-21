import { existsSync, readFileSync } from "node:fs"
import { basename, join } from "node:path"
import { assertSeedId, LANGUAGE_IDS } from "@pbgo/content-kit"
import type { LanguageId } from "@pbgo/content-kit"
import { imagesOf } from "@pbgo/content-kit/testing"
import type { Doc } from "@pbgo/content-kit/testing"
import { UI_TEXTS } from "@pbgo/studio-kit/constants"
import { describe, expect, it } from "vitest"
import { FAMILIES, ROLES } from "../../apps/studio/schemaTypes/constants.ts"
import { CONTENT_DIR, DATASET, ENV_FILE, GAME_DIR, PROJECT_ID, REPO_ROOT, SLUG } from "../config.ts"
import { FAMILY_KEYS, familyId } from "./families.ts"
import { MISSION_IDS } from "./missions.ts"
import { ROLE_KEYS, roleId } from "./roles.ts"
import { seedDocs } from "./test-fixtures.ts"
import { TEXTS_ID } from "./texts.ts"

type LocaleObject = { _type: "localeString" | "localeText" } & Record<LanguageId, string>
// The tests read documents of every shape without a type for each of them
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Item = { _key: string; _type: string } & Record<string, any>

const docs = seedDocs

const docOf = (id: string): Doc => {
  const doc = docs().find((candidate) => candidate._id === id)
  if (!doc) throw new Error(`No seed document "${id}"`)
  return doc
}

const ofType = (type: string) => docs().filter((doc) => doc._type === type)

/** Every localeString and localeText of a value, with the path where it sits. */
function localeObjects(value: unknown, path: string): { path: string; value: LocaleObject }[] {
  if (Array.isArray(value)) return value.flatMap((item, index) => localeObjects(item, `${path}[${index}]`))
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>
    if (record._type === "localeString" || record._type === "localeText") return [{ path, value: record as LocaleObject }]
    return Object.entries(record).flatMap(([key, child]) => localeObjects(child, `${path}.${key}`))
  }
  return []
}

const allLocaleObjects = () => docs().flatMap((doc) => localeObjects(doc, doc._id))

/** The lists of wordings of the texts singleton: a localeStringList holds a list per language, which `localeObjects` does not walk. */
const LIST_FIELDS = ["victoryPhrases", "statusLight", "statusDisgrace", "genres"] as const

const listTexts = (field: (typeof LIST_FIELDS)[number]) => {
  const lists = docOf(TEXTS_ID)[field] as Record<LanguageId, string[]>
  return LANGUAGE_IDS.flatMap((language) => lists[language].map((text, index) => ({ where: `${TEXTS_ID}.${field}.${language}[${index}]`, language, kind: "localeString", text })))
}

const victoryTexts = () => listTexts("victoryPhrases")

/** Every single text, with the document, field and language it belongs to. */
const allTexts = () => [
  ...allLocaleObjects().flatMap(({ path, value }) => LANGUAGE_IDS.map((language) => ({ where: `${path}.${language}`, language, kind: value._type as string, text: value[language] }))),
  ...LIST_FIELDS.flatMap((field) => listTexts(field)),
]

/** The kinds of texts the game fills in, in braces: the nickname, the points, the code of a table, the owner of a domain and a number of cards. */
const TOKENS = ["pseudo", "points", "code", "name", "count"]
const tokensOf = (text: string) => [...text.matchAll(/\{([^{}]*)\}/g)].map((match) => match[1]!).sort()
const withoutTokens = (text: string) => text.replace(new RegExp(`\\{(${TOKENS.join("|")})\\}`, "g"), "")

const ERROR_CODES = [
  "INVALID_PHASE",
  "NOT_YOUR_TURN",
  "UNKNOWN_CARD",
  "ZONE_ALREADY_PLAYED",
  "INVALID_TARGET",
  "INVALID_ASSASSINATION",
  "INVALID_PLAYERS",
  "NOT_ENOUGH_MISSIONS",
  "UNKNOWN_PLAYER",
  "NOT_READY",
  "NOT_ENOUGH_PLAYERS",
  "GAME_FULL",
]

/** The labels of the `texts` form the seed fills in, by group. `UI_TEXTS` of the studio-kit says which group of the form each one belongs to. */
const LABELS = {
  ui_home: { group: "home", keys: ["nicknamePlaceholder", "createButton", "joinButton", "chooseNickname", "linkCopied", "codeLabel", "copyLink"] },
  ui_lobby: { group: "lobby", keys: ["joinGameButton", "gameNotFound", "alreadyStarted", "shareInvite", "startButton", "waitingPlayers"] },
  ui_game: { group: "game", keys: ["waiting", "gameOver", "leave", "winnerTitle"] },
} as const

/** The vocabulary of the board the seed fills in, in the order of the form (`WORD_FIELDS` of `src/lib/catalog.ts` reads the same fields), with what each one is filled with. */
const BOARD = {
  courtier: [],
  zoneTable: [],
  zoneYours: [],
  zoneTheirs: [],
  zoneOther: ["name"],
  youPlay: [],
  youEliminate: [],
  youDrawOne: ["count"],
  youDrawMany: ["count"],
  theyPlay: [],
  theyEliminate: [],
  theyDrawOne: ["count"],
  theyDrawMany: ["count"],
  gameOverLog: [],
  missionsSucceeded: [],
  noAssassination: [],
  skip: [],
} as const satisfies Record<string, readonly string[]>

describe("the seed documents", () => {
  it("are 28: 6 families, 4 roles, 17 missions and the texts singleton", () => {
    expect(docs()).toHaveLength(28)
    expect({ family: ofType("family").length, role: ofType("role").length, mission: ofType("mission").length, texts: ofType("texts").length }).toEqual({ family: 6, role: 4, mission: 17, texts: 1 })
  })

  it("have unique ids", () => {
    const ids = docs().map((doc) => doc._id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it("have plain published ids: the writer adds the draft prefix, nothing here is a draft or a version", () => {
    for (const { _id } of docs()) {
      expect(() => assertSeedId(_id), _id).not.toThrow()
      expect(_id.startsWith("drafts.") || _id.startsWith("versions.")).toBe(false)
    }
  })

  it("keep the texts singleton under the name of its type, which is how the Studio addresses it", () => {
    expect(TEXTS_ID).toBe("texts")
    expect(ofType("texts").map((doc) => doc._id)).toEqual(["texts"])
    for (const doc of docs().filter((candidate) => candidate._type !== "texts")) expect(doc._id, doc._id).not.toBe(doc._type)
  })

  it("seed no rules document: the rules are links to PDFs, in the settings", () => {
    expect(docs().filter((doc) => doc._type === "rules" || doc._id === "rules")).toEqual([])
  })

  it("carry nothing but content: no revision, no date, no image reference", () => {
    for (const doc of docs()) {
      for (const field of ["_rev", "_createdAt", "_updatedAt"]) expect(doc, `${doc._id} ${field}`).not.toHaveProperty(field)
      expect(imagesOf(doc), doc._id).toEqual([])
    }
  })

  it("are plain JSON: nothing is lost on its way to the API", () => {
    const all = docs()
    expect(JSON.parse(JSON.stringify(all))).toStrictEqual(all)
  })

  it("are built afresh each time, so that a run cannot change the next one", () => {
    const first = docs()
    const second = docs()
    expect(second).toStrictEqual(first)
    const texts = first.find((doc) => doc._type === "texts") as Doc
    texts.tagline.fr = "changed"
    texts.victoryPhrases.fr[0] = "changed"
    texts.genres.fr[0] = "changed"
    texts.statusLight.fr.push("changed")
    texts.errorMessages[0].message.fr = "changed"
    texts.extra = true
    const again = second.find((doc) => doc._type === "texts") as Doc
    expect(again.tagline.fr).toBe("Le banquet de la Reine, en ligne et entre amis")
    expect(again.victoryPhrases.fr[0]).not.toBe("changed")
    expect(again.genres.fr[0]).not.toBe("changed")
    expect(again.statusLight.fr).not.toContain("changed")
    expect(again.errorMessages[0].message.fr).not.toBe("changed")
    expect(again).not.toHaveProperty("extra")
    expect(docOf(TEXTS_ID)).not.toHaveProperty("extra")
    expect(docOf(TEXTS_ID).tagline.fr).toBe("Le banquet de la Reine, en ligne et entre amis")
  })

  it("give every array item a stable key and a type, unique in its array", () => {
    const arrays: string[] = []
    for (const doc of docs()) {
      for (const [field, value] of Object.entries(doc)) {
        if (!Array.isArray(value)) continue
        arrays.push(`${doc._id}.${field}`)
        const keys = (value as Item[]).map((item) => item._key)
        expect(keys.every((key) => typeof key === "string" && key.length > 0), `${doc._id}.${field} keys`).toBe(true)
        expect(new Set(keys).size, `${doc._id}.${field} unique keys`).toBe(keys.length)
        expect((value as Item[]).every((item) => typeof item._type === "string"), `${doc._id}.${field} types`).toBe(true)
      }
    }
    // the lists of wordings (victory sentences, statuses, genres) are lists of plain strings, which Sanity keeps without keys, and they sit inside a localeStringList
    expect(arrays).toEqual(["texts.errorMessages"])
  })
})

describe("the families", () => {
  it("are the six of the Studio, in its order", () => {
    expect(ofType("family").map((doc) => doc._id)).toEqual(FAMILY_KEYS.map(familyId))
    expect([...FAMILY_KEYS]).toEqual(FAMILIES.map((family) => family.value))
  })

  it("hold the name and nothing else: the key, the colour and the pictogram stay the Studio's", () => {
    for (const doc of ofType("family")) expect(Object.keys(doc).sort(), doc._id).toEqual(["_id", "_type", "name"])
  })

  it("have a name in each language, different from one family to the next", () => {
    for (const language of LANGUAGE_IDS) {
      const names = ofType("family").map((doc) => (doc.name as LocaleObject)[language])
      expect(new Set(names).size, language).toBe(names.length)
    }
    for (const doc of ofType("family")) expect((doc.name as LocaleObject)._type, doc._id).toBe("localeString")
  })
})

describe("the roles", () => {
  it("are the four of the Studio, in its order", () => {
    expect(ofType("role").map((doc) => doc._id)).toEqual(ROLE_KEYS.map(roleId))
    expect([...ROLE_KEYS]).toEqual(ROLES.map((role) => role.value))
  })

  it("hold the name and the rule and nothing else: the key, the number per family and the pictogram stay the Studio's", () => {
    for (const doc of ofType("role")) expect(Object.keys(doc).sort(), doc._id).toEqual(["_id", "_type", "name", "rule"])
  })

  it("have a name in each language, different from one role to the next", () => {
    // a name may be the same in two languages (the noble is "Noble" in French and English), but not for two roles of one language
    for (const language of LANGUAGE_IDS) {
      const names = ofType("role").map((doc) => (doc.name as LocaleObject)[language])
      expect(new Set(names).size, language).toBe(names.length)
    }
    for (const doc of ofType("role")) expect((doc.name as LocaleObject)._type, doc._id).toBe("localeString")
  })

  it("have a rule in each language, of the same number of paragraphs in all of them", () => {
    const paragraphs = { noble: 1, spy: 2, assassin: 2, guard: 1 }
    for (const key of ROLE_KEYS) {
      const rule = docOf(roleId(key)).rule as LocaleObject
      expect(rule._type, key).toBe("localeText")
      for (const language of LANGUAGE_IDS) expect(rule[language].split("\n\n"), `${key} ${language}`).toHaveLength(paragraphs[key])
    }
  })
})

describe("the missions", () => {
  const LIGHT = Array.from({ length: 10 }, (_, index) => `mission-light-${index + 1}`)
  const DARK = Array.from({ length: 7 }, (_, index) => `mission-dark-${index + 1}`)

  it("are the ten missions in the light and the seven in disgrace that exist the same in the code and in the Studio", () => {
    expect(ofType("mission").map((doc) => doc._id)).toEqual([...LIGHT, ...DARK])
    expect(MISSION_IDS).toEqual([...LIGHT, ...DARK])
  })

  it("leave out the three missions in disgrace that the Studio words differently from the code", () => {
    // mission-dark-8 to 10 differ in the Studio (text and condition): the seed does not translate the code's version into a document that says something else
    for (const id of ["mission-dark-8", "mission-dark-9", "mission-dark-10"]) expect(docs().map((doc) => doc._id)).not.toContain(id)
  })

  it("hold the text and nothing else: the colour, the card and the condition stay the Studio's", () => {
    for (const doc of ofType("mission")) expect(Object.keys(doc).sort(), doc._id).toEqual(["_id", "_type", "text"])
  })

  it("have a text in each language, different from one mission to the next", () => {
    for (const doc of ofType("mission")) expect((doc.text as LocaleObject)._type, doc._id).toBe("localeText")
    for (const language of LANGUAGE_IDS) {
      const texts = ofType("mission").map((doc) => (doc.text as LocaleObject)[language])
      expect(new Set(texts).size, language).toBe(texts.length)
    }
  })
})

describe("the texts", () => {
  const texts = () => docOf(TEXTS_ID)

  it("hold the home and victory texts, the interface labels, the error messages, the two buttons of the opening, the search-engine texts and the board vocabulary", () => {
    expect(Object.keys(texts())).toEqual([
      ...["_id", "_type", "tagline", "homeTitle", "homeIntro", "victoryPhrases", "ui_home", "ui_lobby", "ui_game", "errorMessages", "missionsButton", "banquetStarts", "homeHeading", "genres"],
      ...Object.keys(BOARD),
      ...["statusLight", "statusDisgrace"],
    ])
    expect([texts().tagline._type, texts().homeTitle._type, texts().homeIntro._type, texts().missionsButton._type, texts().banquetStarts._type, texts().homeHeading._type]).toEqual([
      "localeString",
      "localeString",
      "localeText",
      "localeString",
      "localeString",
      "localeString",
    ])
  })

  it("fill the 17 words of the board, each one a localeString, the zone of another player with the name of its owner and the draw lines with their number of cards", () => {
    expect(Object.keys(BOARD)).toHaveLength(17)
    for (const [field, tokens] of Object.entries(BOARD)) {
      const word = texts()[field] as LocaleObject
      expect(word._type, field).toBe("localeString")
      for (const language of LANGUAGE_IDS) expect(tokensOf(word[language]), `${field}.${language}`).toEqual([...tokens])
    }
  })

  it("give a singular and a plural to the lines that draw cards, in every language", () => {
    for (const [one, many] of [
      ["youDrawOne", "youDrawMany"],
      ["theyDrawOne", "theyDrawMany"],
    ] as const) {
      for (const language of LANGUAGE_IDS) expect((texts()[one] as LocaleObject)[language], `${one}.${language}`).not.toBe((texts()[many] as LocaleObject)[language])
    }
  })

  it("list the wordings of a status and the genres of the game, one list per language, and no wording for both statuses", () => {
    for (const field of ["statusLight", "statusDisgrace", "genres"] as const) {
      const lists = texts()[field] as { _type: string } & Record<LanguageId, string[]>
      expect(lists._type, field).toBe("localeStringList")
      expect(Object.keys(lists).sort(), field).toEqual(["_type", ...LANGUAGE_IDS].sort())
      for (const language of LANGUAGE_IDS) expect(lists[language].length, `${field}.${language}`).toBeGreaterThan(0)
    }
    const light = listTexts("statusLight").map(({ text }) => text)
    const disgrace = listTexts("statusDisgrace").map(({ text }) => text)
    expect(light.filter((wording) => disgrace.includes(wording))).toEqual([])
    // the genres are the same three kinds of game in every language
    for (const language of LANGUAGE_IDS) expect((texts().genres as Record<LanguageId, string[]>)[language], language).toHaveLength(3)
  })

  it("fill the 17 interface labels of the three groups, each one a label of the shared list in the group of its form", () => {
    for (const [field, { group, keys }] of Object.entries(LABELS)) {
      const group_ = texts()[field] as Record<string, LocaleObject>
      expect(Object.keys(group_), field).toEqual([...keys])
      for (const key of keys) {
        expect(UI_TEXTS.find((label) => label.key === key)?.group, `${field}.${key}`).toBe(group)
        expect(group_[key]!._type, `${field}.${key}`).toBe("localeString")
      }
    }
    expect(Object.values(LABELS).reduce((sum, { keys }) => sum + keys.length, 0)).toBe(17)
  })

  it("give the 12 error codes of the game the shape the gamemaster writes: the code is the key of the item", () => {
    const items = texts().errorMessages as Item[]
    expect(items.map((item) => item.code)).toEqual(ERROR_CODES)
    for (const item of items) {
      expect(item._key, item.code).toBe(item.code)
      expect(item._type, item.code).toBe("errorMessage")
      expect(item.code, item.code).toMatch(/^[A-Z]+(_[A-Z]+)*$/)
      expect(Object.keys(item).sort(), item.code).toEqual(["_key", "_type", "code", "message"])
      expect((item.message as LocaleObject)._type, item.code).toBe("localeString")
    }
  })

  it("give three victory sentences in each language, each naming the winner and the points", () => {
    const phrases = texts().victoryPhrases as { _type: string } & Record<LanguageId, string[]>
    expect(phrases._type).toBe("localeStringList")
    expect(Object.keys(phrases).sort()).toEqual(["_type", ...LANGUAGE_IDS].sort())
    for (const language of LANGUAGE_IDS) {
      expect(phrases[language], language).toHaveLength(3)
      for (const phrase of phrases[language]) expect(tokensOf(phrase), `${language} ${phrase}`).toEqual(["points", "pseudo"])
    }
    // each sentence is a translation of the one in the same place
    for (const index of [0, 1, 2]) {
      const sentences = LANGUAGE_IDS.map((language) => phrases[language][index])
      expect(new Set(sentences).size, `sentence ${index}`).toBe(sentences.length)
    }
  })

  it("name the table in the message of a table that cannot be found, in every language", () => {
    const message = ((texts().ui_lobby as Record<string, LocaleObject>).gameNotFound)!
    for (const language of LANGUAGE_IDS) expect(tokensOf(message[language]), language).toEqual(["code"])
  })
})

describe("every text", () => {
  it("is in the four languages, for every localeString and localeText of every document", () => {
    const objects = allLocaleObjects()
    // 6 family names, 4 role names and rules, 17 missions, and in the texts: 6 (tagline, title, intro, two buttons, hidden heading) + 17 board words + 17 labels + 12 errors
    expect(objects).toHaveLength(6 + 4 * 2 + 17 + (6 + 17 + 17 + 12))
    for (const { path, value } of objects) {
      expect(Object.keys(value).sort(), path).toEqual(["_type", ...LANGUAGE_IDS].sort())
    }
  })

  it("counts the lists of wordings with the others: 12 victory sentences, 6 wordings of the light, 5 of the disgrace and 12 genres", () => {
    expect(victoryTexts()).toHaveLength(12)
    expect(LIST_FIELDS.map((field) => listTexts(field).length)).toEqual([12, 6, 5, 12])
    expect(allTexts()).toHaveLength(83 * 4 + 35)
  })

  it("has no space around it, no double space, no tab", () => {
    for (const { where, text } of allTexts()) {
      expect(text, where).toBe(text.trim())
      expect(text, where).not.toMatch(/ {2}|\t/)
    }
  })

  // No test on the apostrophe: these are the source texts of the drafts, as the game wrote them, with the straight one (the other games' seeds use the
  // typographic ’). They may also end with an ellipsis ("En attente de convives…").

  it("keeps a title on one line, and its paragraphs apart by one blank line", () => {
    for (const { where, kind, text } of allTexts()) {
      if (kind === "localeString") expect(text, where).not.toMatch(/[\r\n]/)
      else expect(text, where).not.toMatch(/\r|\n{3}|\n[ \t]+\n/)
    }
  })

  it("has no placeholder, no markup, no address", () => {
    for (const { where, language, text } of allTexts()) {
      expect(text, where).not.toMatch(/\b(tbd|fixme|lorem|ipsum|placeholder|xxx)\b/i)
      // "todo" is a draft marker in English, and a plain word in Spanish ("todo vale": anything goes)
      if (language !== "es") expect(text, where).not.toMatch(/\btodo\b/i)
      expect(text, where).not.toMatch(/\?\?|<\/?[a-z]|https?:\/\//i)
    }
  })

  it("closes every bold mark", () => {
    for (const { where, text } of allTexts()) expect((text.match(/\*\*/g) ?? []).length % 2, where).toBe(0)
  })

  it("is written in its own language: no long text is the same in two languages", () => {
    for (const { path, value } of allLocaleObjects()) {
      const longOnes = LANGUAGE_IDS.map((language) => value[language]).filter((text) => text.length >= 30)
      expect(new Set(longOnes).size, path).toBe(longOnes.length)
    }
  })

  it("is at most 4 000 characters, so that a Studio text field stays readable", () => {
    for (const { where, text } of allTexts()) expect(text.length, where).toBeLessThan(4000)
  })

  it("fills the same placeholders in every language, and only the ones the game knows", () => {
    for (const { path, value } of allLocaleObjects()) {
      const french = tokensOf(value.fr)
      for (const language of LANGUAGE_IDS) {
        expect(tokensOf(value[language]), `${path}.${language}`).toEqual(french)
        expect(withoutTokens(value[language]), `${path}.${language}`).not.toMatch(/[{}]/)
      }
    }
    for (const { where, text } of LIST_FIELDS.flatMap((field) => listTexts(field))) {
      expect(withoutTokens(text), where).not.toMatch(/[{}]/)
      for (const token of tokensOf(text)) expect(TOKENS, where).toContain(token)
    }
  })
})

describe("the configuration", () => {
  it("points at the Courtisans project of the registry, the single source of project ids", async () => {
    // Loaded by its path, as scripts/lib.sh does: a static import would pull all of @pbgo/core into the typecheck of this folder
    const { GAMES } = (await import(/* @vite-ignore */ join(REPO_ROOT, "packages/games/src/registry.ts"))) as { GAMES: { slug: string; sanityProjectId: string }[] }
    const entries = GAMES.filter((game) => game.slug === SLUG)
    expect(entries).toHaveLength(1)
    expect(entries[0]?.sanityProjectId).toBe(PROJECT_ID)
    expect(PROJECT_ID).toBe("2lo2f5sv")
  })

  it("points at the same project as the studio", () => {
    for (const file of ["sanity.config.ts", "sanity.cli.ts"]) expect(readFileSync(join(GAME_DIR, "apps/studio", file), "utf8"), file).toContain(PROJECT_ID)
  })

  it("writes to the production dataset of the game it lives in", () => {
    expect(DATASET).toBe("production")
    expect(SLUG).toBe("courtisans")
    expect(basename(GAME_DIR)).toBe(SLUG)
    expect(basename(CONTENT_DIR)).toBe("content")
  })

  it("finds the repository root, and the env file where the web app keeps it", () => {
    expect(existsSync(join(REPO_ROOT, "pnpm-workspace.yaml"))).toBe(true)
    expect(ENV_FILE).toBe(join(REPO_ROOT, "apps/web/.env.local"))
  })
})
