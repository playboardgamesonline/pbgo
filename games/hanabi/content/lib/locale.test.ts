import { LANGUAGES } from "@pbgo/studio-kit/constants"
import { describe, expect, it } from "vitest"
import { LANGUAGE_IDS, localeString, localeText } from "./locale.ts"
import type { Localized } from "./locale.ts"

const all = (text: (id: string) => string = (id) => `text ${id}`): Localized => Object.fromEntries(LANGUAGE_IDS.map((id) => [id, text(id)])) as Localized

const failure = (build: () => unknown) => {
  try {
    build()
  } catch (error) {
    return (error as Error).message
  }
  return undefined
}

describe("the languages of the site", () => {
  it("are read from the studio kit, the single source", () => {
    expect(LANGUAGE_IDS).toEqual(LANGUAGES.map((language) => language.id))
  })

  it("are French, English, Spanish and German", () => {
    expect([...LANGUAGE_IDS].sort()).toEqual(["de", "en", "es", "fr"])
  })
})

describe("localeString", () => {
  it("builds the value of the shared schema, one text per language", () => {
    const value = localeString(all())
    expect(value._type).toBe("localeString")
    for (const id of LANGUAGE_IDS) expect(value[id]).toBe(`text ${id}`)
    expect(Object.keys(value).sort()).toEqual(["_type", ...LANGUAGE_IDS].sort())
  })

  it("keeps the texts as they are, spaces and typographic signs included", () => {
    const value = localeString(all((id) => (id === "de" ? "„Feuerwerk“ " : " 5 Flamboyants ")))
    expect(value.de).toBe("„Feuerwerk“ ")
    expect(value.fr).toBe(" 5 Flamboyants ")
  })

  it("does not keep a key it does not know", () => {
    const value = localeString({ ...all(), it: "extra" } as unknown as Localized)
    expect(value).not.toHaveProperty("it")
  })

  it.each(LANGUAGE_IDS)("refuses a value without %s", (id) => {
    const values = all()
    delete (values as Partial<Localized>)[id]
    expect(failure(() => localeString(values))).toContain(`localeString without a "${id}" text`)
  })

  it.each(["", "   ", "\n"])("refuses an empty text: %j", (empty) => {
    expect(failure(() => localeString(all((id) => (id === "es" ? empty : "ok"))))).toContain('localeString without a "es" text')
  })

  it("refuses a text that is not a string", () => {
    expect(failure(() => localeString(all((id) => (id === "en" ? (undefined as unknown as string) : "ok"))))).toContain('without a "en" text')
    expect(failure(() => localeString({ ...all(), en: 3 } as unknown as Localized))).toContain('without a "en" text')
  })

  it.each(["two\nlines", "two\r\nlines", "carriage\rreturn"])("refuses a text on several lines: %j", (text) => {
    expect(failure(() => localeString(all((id) => (id === "de" ? text : "ok"))))).toContain('localeString "de" spans several lines')
  })

  it("quotes the French text in the message, cut short, to find the faulty one", () => {
    const message = failure(() => localeString({ ...all(), fr: "x".repeat(200), en: "" }))
    expect(message).toContain('without a "en" text')
    expect(message?.length).toBeLessThan(200)
    expect(message).toContain("xxxx")
  })
})

describe("localeText", () => {
  it("builds the value of the shared schema", () => {
    const value = localeText(all())
    expect(value._type).toBe("localeText")
    for (const id of LANGUAGE_IDS) expect(value[id]).toBe(`text ${id}`)
  })

  it("allows several paragraphs and bold, which is how the rules are written", () => {
    const text = "One **bold** word.\n\nA second paragraph."
    const value = localeText(all(() => text))
    expect(value.fr).toBe(text)
    expect(value.de).toBe(text)
  })

  it.each(LANGUAGE_IDS)("refuses a value without %s", (id) => {
    const values = all()
    values[id] = ""
    expect(failure(() => localeText(values))).toContain(`localeText without a "${id}" text`)
  })
})
