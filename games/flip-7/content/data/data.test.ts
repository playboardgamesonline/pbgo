import { existsSync, readFileSync } from "node:fs"
import { basename, join } from "node:path"
import { assertSeedId, LANGUAGE_IDS } from "@pbgo/content-kit"
import type { LanguageId } from "@pbgo/content-kit"
import { imagesOf, imageValue } from "@pbgo/content-kit/testing"
import type { Doc } from "@pbgo/content-kit/testing"
import { describe, expect, it } from "vitest"
import { CARD_TYPE_KEYS, CARD_TYPES, KIND_KEYS, titleOf } from "../../apps/studio/schemaTypes/constants.ts"
import type { CardTypeKey } from "../../apps/studio/schemaTypes/constants.ts"
import { CONTENT_DIR, DATASET, ENV_FILE, GAME_DIR, PROJECT_ID, REPO_ROOT, SLUG } from "../config.ts"
import { ART_SLOTS } from "./art-manifest.ts"
import { buildCardTypes, cardTypeId, COPIES } from "./card-types.ts"
import { buildGame, GAME_ID } from "./game.ts"
import { buildSettings, SETTINGS_ID } from "./settings.ts"
import { seedDocs } from "./test-fixtures.ts"

type LocaleObject = { _type: "localeString" | "localeText" } & Record<LanguageId, string>

const docs = seedDocs
const digitsOf = (text: string) => (text.match(/\d+/g) ?? []).map(Number).sort((a, b) => a - b)

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
/** Every single text, with the document, field and language it belongs to. */
const allTexts = () =>
  allLocaleObjects().flatMap(({ path, value }) => LANGUAGE_IDS.map((language) => ({ where: `${path}.${language}`, language, kind: value._type, text: value[language] })))

// The keys of the engine catalogue (`CARDS` of @flip-7/engine): kebab-case, in this order. `parity/engine.test.ts` reads them from the engine itself.
const ENGINE_KEYS = [
  ...Array.from({ length: 13 }, (_, value) => `number-${value}`),
  "plus-2",
  "plus-4",
  "plus-6",
  "plus-8",
  "plus-10",
  "times-2",
  "freeze",
  "flip-three",
  "second-chance",
]
const MODIFIERS = ["plus-2", "plus-4", "plus-6", "plus-8", "plus-10", "times-2"]
const ACTIONS = ["freeze", "flip-three", "second-chance"]

describe("the seed documents", () => {
  const count = (type: string) => docs().filter((doc) => doc._type === type).length

  it("are the 24 documents of the Flip 7 seed: 22 card faces, the game and the settings", () => {
    expect(docs()).toHaveLength(24)
    expect({ cardType: count("cardType"), game: count("game"), settings: count("settings") }).toEqual({ cardType: 22, game: 1, settings: 1 })
    expect(docs().map((doc) => doc._id)).toEqual([...ENGINE_KEYS.map((key) => `card-type-${key}`), "game", "settings"])
  })

  it("have unique ids", () => {
    const ids = docs().map((doc) => doc._id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it("have plain published ids: the runner makes the drafts", () => {
    for (const { _id } of docs()) {
      expect(() => assertSeedId(_id), _id).not.toThrow()
      expect(_id.startsWith("drafts.") || _id.startsWith("versions."), _id).toBe(false)
    }
  })

  it("keep the game and the settings as singletons under the id of their type", () => {
    for (const type of ["game", "settings"]) expect(docs().find((doc) => doc._type === type)?._id).toBe(type)
    expect([GAME_ID, SETTINGS_ID]).toEqual(["game", "settings"])
  })

  it("hold content only: no system field, no image (the art comes with the files)", () => {
    for (const doc of docs()) {
      for (const field of ["_rev", "_createdAt", "_updatedAt"]) expect(doc, `${doc._id} ${field}`).not.toHaveProperty(field)
      expect(imagesOf(doc), doc._id).toEqual([])
    }
  })

  it("are plain JSON", () => {
    const all = docs()
    expect(JSON.parse(JSON.stringify(all))).toStrictEqual(all)
  })

  it("are built afresh each time, so that a run can never alter the next one", () => {
    const first = docs()
    const second = docs()
    expect(second).toStrictEqual(first)

    // The number cards share one effect text in the data: changing one must not touch the others
    const three = first.find((doc) => doc._id === cardTypeId("number-3")) as Doc
    const four = first.find((doc) => doc._id === cardTypeId("number-4")) as Doc
    const effect = four.effect.fr
    three.name.fr = "changed"
    three.effect.fr = "changed"
    three.extra = true

    expect(four.effect.fr).toBe(effect)
    const untouched = second.find((doc) => doc._id === cardTypeId("number-3")) as Doc
    expect(untouched.name.fr).toBe("3")
    expect(untouched.effect.fr).toBe(effect)
    expect(untouched).not.toHaveProperty("extra")
    expect(docs()).toStrictEqual(second)
  })
})

describe("the card faces", () => {
  const cardTypes = () => buildCardTypes() as Doc[]
  const typeOf = (key: string) => cardTypes().find((doc) => doc.key === key) as Doc

  it("are the 22 faces of the engine catalogue, under its kebab-case keys, in its order", () => {
    expect(cardTypes().map((doc) => doc.key)).toEqual(ENGINE_KEYS)
    expect([...CARD_TYPE_KEYS]).toEqual(ENGINE_KEYS)
    for (const key of ENGINE_KEYS) expect(key, key).toMatch(/^[a-z]+(-[a-z0-9]+)*$/)
    expect(CARD_TYPES.map((type) => type.value)).toEqual(ENGINE_KEYS)
  })

  it("get the id card-type-<key>", () => {
    expect(cardTypes().map((doc) => doc._id)).toEqual(ENGINE_KEYS.map((key) => `card-type-${key}`))
    for (const key of CARD_TYPE_KEYS) expect(cardTypeId(key)).toBe(`card-type-${key}`)
    for (const doc of cardTypes()) expect(doc._type, doc.key).toBe("cardType")
  })

  it("have the kind the engine reads: 13 numbers, 6 score modifiers and 3 action cards", () => {
    for (const doc of cardTypes()) {
      const expected = doc.key.startsWith("number-") ? "number" : ACTIONS.includes(doc.key) ? "action" : "modifier"
      expect(doc.kind, doc.key).toBe(expected)
      expect(KIND_KEYS as readonly string[], doc.key).toContain(doc.kind)
    }
    const count = (kind: string) => cardTypes().filter((doc) => doc.kind === kind).length
    expect({ number: count("number"), modifier: count("modifier"), action: count("action") }).toEqual({ number: 13, modifier: 6, action: 3 })
    expect([...KIND_KEYS]).toEqual(["number", "modifier", "action"])
    expect(cardTypes().filter((doc) => doc.kind === "modifier").map((doc) => doc.key)).toEqual(MODIFIERS)
  })

  it("carry their place in the box, from 0, so that the Studio lists them in the order of the deck", () => {
    expect(cardTypes().map((doc) => doc.order)).toEqual(ENGINE_KEYS.map((_, index) => index))
  })

  it("carry the copies of the box: as many of a number as its value and a single 0, one of each modifier, three of each action card", () => {
    for (let value = 1; value <= 12; value++) expect(typeOf(`number-${value}`).copies, `number-${value}`).toBe(value)
    expect(typeOf("number-0").copies).toBe(1)
    for (const key of MODIFIERS) expect(typeOf(key).copies, key).toBe(1)
    for (const key of ACTIONS) expect(typeOf(key).copies, key).toBe(3)
  })

  it("make the 94 cards of the box: 79 numbers, 6 score modifiers and 9 action cards (booklet pages 2 and 3)", () => {
    const sum = (keys: readonly string[]) => keys.reduce((total, key) => total + (COPIES[key as CardTypeKey] ?? 0), 0)
    expect(sum(ENGINE_KEYS)).toBe(94)
    expect(sum(ENGINE_KEYS.filter((key) => key.startsWith("number-")))).toBe(79)
    expect(sum(MODIFIERS)).toBe(6)
    expect(sum(ACTIONS)).toBe(9)
    expect(cardTypes().reduce((total, doc) => total + (doc.copies as number), 0)).toBe(94)
  })

  describe("names", () => {
    it("are a localeString for the name and a localeText for the effect", () => {
      for (const doc of cardTypes()) {
        expect(doc.name._type, doc.key).toBe("localeString")
        expect(doc.effect._type, doc.key).toBe("localeText")
      }
    })

    it("are the figure on the card for the numbers and the modifiers, and the printed English title for the action cards, in every language", () => {
      for (const language of LANGUAGE_IDS) {
        for (let value = 0; value <= 12; value++) expect(typeOf(`number-${value}`).name[language], `number-${value} ${language}`).toBe(String(value))
        for (const points of [2, 4, 6, 8, 10]) expect(typeOf(`plus-${points}`).name[language], `plus-${points} ${language}`).toBe(`+${points}`)
        expect(typeOf("times-2").name[language]).toBe("x2")
        expect(typeOf("freeze").name[language]).toBe("Freeze")
        expect(typeOf("flip-three").name[language]).toBe("Flip Three")
        expect(typeOf("second-chance").name[language]).toBe("Second Chance")
      }
    })

    it("are, for the action cards, the titles the Studio lists", () => {
      for (const key of ACTIONS) expect(typeOf(key).name.en, key).toBe(titleOf(CARD_TYPES, key))
    })

    it("are unique within a language", () => {
      for (const language of LANGUAGE_IDS) {
        const names = cardTypes().map((doc) => doc.name[language] as string)
        expect(new Set(names).size, language).toBe(names.length)
      }
    })
  })

  describe("effects", () => {
    it("are one short paragraph that ends with a full stop", () => {
      for (const doc of cardTypes()) {
        for (const language of LANGUAGE_IDS) {
          const text = doc.effect[language] as string
          expect(text, `${doc.key} ${language}`).not.toContain("\n")
          expect(text, `${doc.key} ${language}`).toMatch(/\.$/)
          expect(text.length, `${doc.key} ${language}`).toBeLessThan(340)
        }
      }
    })

    it("give the same figures in every language: the points of a modifier, the seven numbers of a Flip 7", () => {
      const expected = (key: string): number[] => {
        if (key === "number-0" || key === "flip-three") return [7]
        if (key.startsWith("plus-")) return [Number(key.slice("plus-".length)), 7].sort((a, b) => a - b)
        if (key === "times-2") return [2, 7, 10]
        return []
      }
      for (const doc of cardTypes()) for (const language of LANGUAGE_IDS) expect(digitsOf(doc.effect[language]), `${doc.key} ${language}`).toEqual(expected(doc.key))
    })

    it("are one and the same for the twelve numbers that carry points, and their own for the 10 other faces", () => {
      for (let value = 2; value <= 12; value++) expect(typeOf(`number-${value}`).effect, `number-${value}`).toEqual(typeOf("number-1").effect)
      for (const language of LANGUAGE_IDS) {
        const effects = cardTypes().map((doc) => doc.effect[language] as string)
        // 1 shared by the numbers 1 to 12, then the zero, five +N, the x2 and the three action cards
        expect(new Set(effects).size, language).toBe(11)
      }
    })

    it("say what the booklet says of each kind of card", () => {
      const words: Record<LanguageId, Record<string, string[]>> = {
        fr: { "number-5": ["déjà devant vous", "élimine"], "second-chance": ["défaussez", "Second Chance"], freeze: ["met ses points en banque"], "flip-three": ["trois cartes", "Flip 7"], "times-2": ["Double"] },
        en: { "number-5": ["already have", "busts"], "second-chance": ["discard", "Second Chance"], freeze: ["bank their points"], "flip-three": ["three cards", "Flip 7"], "times-2": ["Doubles"] },
        es: { "number-5": ["ya tienes", "eliminado"], "second-chance": ["descarta", "Second Chance"], freeze: ["guarda sus puntos"], "flip-three": ["tres cartas", "Flip 7"], "times-2": ["Duplica"] },
        de: { "number-5": ["schon vor dir", "scheidest"], "second-chance": ["doppelte Karte", "Second Chance"], freeze: ["sichert ihre Punkte"], "flip-three": ["drei Karten", "Flip 7"], "times-2": ["Verdoppelt"] },
      }
      for (const language of LANGUAGE_IDS) {
        for (const [key, terms] of Object.entries(words[language])) {
          for (const term of terms) expect(typeOf(key).effect[language], `${key} ${language}: ${term}`).toContain(term)
        }
      }
    })
  })
})

describe("the game", () => {
  it("is an empty singleton: its images (card back, box, mat) come with the art", () => {
    expect(GAME_ID).toBe("game")
    expect(buildGame()).toEqual({ _id: "game", _type: "game" })
  })
})

describe("the settings", () => {
  const settings = () => buildSettings() as Doc

  it("hold the credits and the publisher, and nothing else", () => {
    expect(Object.keys(settings()).sort()).toEqual(["_id", "_type", "creditsAuthors", "creditsAuthorsI18n", "publisher", "publisherUrl"])
    expect(settings()._id).toBe(SETTINGS_ID)
    expect(settings()._type).toBe("settings")
  })

  it("credit the author of the game, Eric Olsen, in every language", () => {
    expect(settings().creditsAuthorsI18n._type).toBe("localeString")
    for (const language of LANGUAGE_IDS) expect(settings().creditsAuthorsI18n[language], language).toBe("Eric Olsen")
    // The footer falls back to the French field when the localized one is empty, so both are filled
    expect(settings().creditsAuthors).toBe(settings().creditsAuthorsI18n.fr)
  })

  it("name the publisher of the booklet and link to it", () => {
    expect(settings().publisher).toBe("The OP Games")
    const url = new URL(settings().publisherUrl)
    expect(url.protocol).toBe("https:")
    expect(url.hostname).toBe("www.theopgames.com")
  })

  it("leave the rulebook link to the Studio: the booklet has no address of its own to link", () => {
    for (const field of ["rulesPdfFr", "rulesPdfEn", "rulesPdfEs", "rulesPdfDe", "rulesPdfFrFile", "rulesPdfEnFile", "rulesPdfEsFile", "rulesPdfDeFile"]) {
      expect(settings(), field).not.toHaveProperty(field)
    }
  })

  it("hold short strings only", () => {
    for (const [field, value] of Object.entries(settings())) {
      if (typeof value === "string") expect(value.length, field).toBeLessThan(200)
    }
  })
})

describe("every text", () => {
  it("is in the four languages, for every localeString and localeText of every document", () => {
    const objects = allLocaleObjects()
    // 22 card faces (name, effect) and the credits
    expect(objects).toHaveLength(45)
    for (const { path, value } of objects) expect(Object.keys(value).sort(), path).toEqual(["_type", ...LANGUAGE_IDS].sort())
  })

  it("has no space around it, no double space, no tab", () => {
    for (const { where, text } of allTexts()) {
      expect(text, where).toBe(text.trim())
      expect(text, where).not.toMatch(/ {2}|\t/)
    }
  })

  it("uses the typographic apostrophe, never the straight one", () => {
    for (const { where, text } of allTexts()) expect(text, where).not.toContain("'")
  })

  it("keeps a title on one line", () => {
    for (const { where, kind, text } of allTexts()) if (kind === "localeString") expect(text, where).not.toMatch(/[\r\n]/)
  })

  it("has no placeholder, no markup, no address", () => {
    for (const { where, text } of allTexts()) {
      // `todo` is also a Spanish word ("sobre todo"): only the capitalised marker counts
      expect(text, where).not.toMatch(/\bTODO\b/)
      expect(text, where).not.toMatch(/\b(tbd|fixme|lorem|ipsum|placeholder|xxx)\b/i)
      expect(text, where).not.toMatch(/\?\?|…\s*$|<\/?[a-z]|https?:\/\//i)
    }
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
})

describe("the configuration", () => {
  it("points at the Flip 7 project of the registry, the single source of project ids", async () => {
    // Loaded by its path, as scripts/lib.sh does: a static import would pull all of @pbgo/core into the typecheck of this folder
    const { GAMES } = (await import(/* @vite-ignore */ join(REPO_ROOT, "packages/games/src/registry.ts"))) as { GAMES: { slug: string; sanityProjectId: string }[] }
    const entries = GAMES.filter((game) => game.slug === SLUG)
    expect(entries).toHaveLength(1)
    expect(entries[0]?.sanityProjectId).toBe(PROJECT_ID)
    expect(PROJECT_ID).toBe("fj3grahy")
  })

  it("points at the same project as the studio", () => {
    for (const file of ["sanity.config.ts", "sanity.cli.ts"]) expect(readFileSync(join(GAME_DIR, "apps/studio", file), "utf8"), file).toContain(PROJECT_ID)
  })

  it("writes to the production dataset of the game it lives in", () => {
    expect(DATASET).toBe("production")
    expect(SLUG).toBe("flip-7")
    expect(basename(GAME_DIR)).toBe(SLUG)
    expect(basename(CONTENT_DIR)).toBe("content")
  })

  it("finds the repository root, and the env file where the web app keeps it", () => {
    expect(existsSync(join(REPO_ROOT, "pnpm-workspace.yaml"))).toBe(true)
    expect(ENV_FILE).toBe(join(REPO_ROOT, "apps/web/.env.local"))
  })
})

describe("the art slots", () => {
  const image = imageValue
  const faces = ART_SLOTS.filter((slot) => slot.docId.startsWith("card-type-"))
  const docOf = (slot: (typeof ART_SLOTS)[number]) => docs().find((candidate) => candidate._id === slot.docId) as Doc

  it("are 27: a face per card face (22), the card back, the box (front and back), the mat and the logo", () => {
    expect(ART_SLOTS).toHaveLength(27)
    expect(faces).toHaveLength(22)
    expect(ART_SLOTS.filter((slot) => slot.docId === GAME_ID).map((slot) => slot.name)).toEqual(["card-back", "box-front", "box-back", "mat"])
    expect(ART_SLOTS.filter((slot) => slot.docId === SETTINGS_ID).map((slot) => slot.name)).toEqual(["logo"])
  })

  it("name each face after its key, in the order of the catalogue (number-7, plus-4, times-2, freeze…)", () => {
    expect(faces.map((slot) => slot.name)).toEqual(ENGINE_KEYS)
    expect(faces.map((slot) => slot.docId)).toEqual(ENGINE_KEYS.map((key) => `card-type-${key}`))
  })

  it("also accept the figure printed on the card (7, +4, x2) and `back` for the card back", () => {
    const aliases = Object.fromEntries(ART_SLOTS.filter((slot) => slot.aliases?.length).map((slot) => [slot.name, slot.aliases]))
    expect(aliases).toEqual({
      ...Object.fromEntries(Array.from({ length: 13 }, (_, value) => [`number-${value}`, [String(value)]])),
      "plus-2": ["+2"],
      "plus-4": ["+4"],
      "plus-6": ["+6"],
      "plus-8": ["+8"],
      "plus-10": ["+10"],
      "times-2": ["x2"],
      "card-back": ["back"],
    })
  })

  it("are named in lower-case words joined by hyphens, a figure or a sign included", () => {
    for (const slot of ART_SLOTS) for (const name of [slot.name, ...(slot.aliases ?? [])]) expect(name, name).toMatch(/^\+?[a-z0-9]+(-[a-z0-9]+)*$/)
  })

  it("share no name, aliases included", () => {
    const names = ART_SLOTS.flatMap((slot) => [slot.name, ...(slot.aliases ?? [])])
    expect(new Set(names).size).toBe(names.length)
  })

  it("have a label and a sensible size", () => {
    for (const slot of ART_SLOTS) {
      expect(slot.label.length, slot.name).toBeGreaterThan(3)
      expect(slot.maxSize, slot.name).toBeGreaterThanOrEqual(256)
      expect(slot.maxSize, slot.name).toBeLessThanOrEqual(2400)
    }
    const labels = ART_SLOTS.map((slot) => slot.label)
    expect(new Set(labels).size).toBe(labels.length)
  })

  it("ask for the proportions of a card (5:7) on the faces and the back, and for none on the rest", () => {
    for (const slot of ART_SLOTS) {
      if (slot.docId.startsWith("card-type-") || slot.name === "card-back") expect(slot.ratio, slot.name).toEqual([5, 7])
      else expect(slot.ratio, slot.name).toBeUndefined()
    }
  })

  it("all aim at a document of the seed", () => {
    const ids = new Set(docs().map((doc) => doc._id))
    for (const slot of ART_SLOTS) expect(ids.has(slot.docId), slot.name).toBe(true)
  })

  it("put the image in one field of their document, and nowhere else", () => {
    for (const slot of ART_SLOTS) {
      const doc = docOf(slot)
      const before = JSON.parse(JSON.stringify(doc))
      slot.place(doc, image(slot.name))
      expect(imagesOf(before), slot.name).toEqual([])
      expect(imagesOf(doc), slot.name).toHaveLength(1)
      // everything but that field is as it was
      const copy = JSON.parse(JSON.stringify(doc))
      const path = imagesOf(doc)[0]!.path
      const segments = path.replace(/^\$\./, "").split(".")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let holder: any = copy
      for (const segment of segments.slice(0, -1)) holder = holder[segment]
      delete holder[segments.at(-1) as string]
      expect(copy, slot.name).toEqual(before)
    }
  })

  describe("aim at", () => {
    const where = (name: string) => {
      const slot = ART_SLOTS.find((candidate) => candidate.name === name)
      if (!slot) throw new Error(`no slot ${name}`)
      const doc = docOf(slot)
      slot.place(doc, image(name))
      return `${doc._type}:${imagesOf(doc)[0]?.path}`
    }

    it("the image of the card face that carries its key", () => {
      for (const name of ["number-7", "plus-4", "times-2", "freeze", "flip-three", "second-chance"]) expect(where(name)).toBe("cardType:$.image")
    })

    it("the images of the game singleton and the shared logo of the settings", () => {
      expect(where("card-back")).toBe("game:$.cardBack")
      expect(where("box-front")).toBe("game:$.boxFront")
      expect(where("box-back")).toBe("game:$.boxBack")
      expect(where("mat")).toBe("game:$.mat")
      expect(where("logo")).toBe("settings:$.logo")
    })

    it("a field of its own: no two slots aim at the same one", () => {
      const targets = ART_SLOTS.map((slot) => {
        const doc = docOf(slot)
        slot.place(doc, image(slot.name))
        return `${doc._id}${imagesOf(doc)[0]?.path}`
      })
      expect(new Set(targets).size).toBe(targets.length)
    })
  })
})
