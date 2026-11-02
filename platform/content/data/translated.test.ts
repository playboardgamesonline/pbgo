import { describe, expect, it } from "vitest"
import { missingEnglish, translatedRow, translatedRows } from "./translated.ts"

describe("translatedRows", () => {
  it("makes a row for each language that has a value, in the order of the platform's languages, whatever the order they are given in", () => {
    const rows = translatedRows("description", { de: "Ein Spiel.", fr: "Un jeu.", en: "A game.", es: "Un juego." })
    expect(rows.map((entry) => entry.language)).toEqual(["en", "fr", "es", "de"])
  })

  it("makes each row of the type of its kind, its key its language and its value the text", () => {
    expect(translatedRows("url", { en: "https://example.com/en.pdf" })).toEqual([
      { _key: "en", _type: "internationalizedArrayUrlValue", language: "en", value: "https://example.com/en.pdf" },
    ])
    expect(translatedRow("image", "fr", { _type: "image" })).toEqual({ _key: "fr", _type: "internationalizedArrayImageValue", language: "fr", value: { _type: "image" } })
  })

  it("makes none for a language that has no value, an empty one, or that the platform does not have: no empty row", () => {
    expect(translatedRows("description", {})).toEqual([])
    expect(translatedRows("description", { en: "", fr: undefined })).toEqual([])
    expect(translatedRows("description", { xx: "Nope." })).toEqual([])
  })
})

describe("missingEnglish", () => {
  const row = (language: string, value?: string) => ({ _key: language, _type: "internationalizedArrayTextValue", language, ...(value === undefined ? {} : { value }) })

  it("names the documents that have a language in a translated field and no English there", () => {
    const docs = [
      { _id: "game-a", _type: "game", description: [row("fr", "Un jeu."), row("de", "Ein Spiel.")], rules: [row("en", "https://example.com/en.pdf")] },
      { _id: "expansion-b", _type: "expansion", rules: [row("es", "https://example.com/es.pdf")] },
    ]
    expect(missingEnglish(docs)).toEqual(["game-a: description is in fr, de and not in English", "expansion-b: rules is in es and not in English"])
  })

  it("is silent when English is there, when a field is empty, and for documents with no translated field", () => {
    const docs = [
      { _id: "game-a", _type: "game", description: [row("en", "A game."), row("fr", "Un jeu.")] },
      { _id: "game-b", _type: "game", description: [row("en")] },
      { _id: "game-c", _type: "game" },
      { _id: "creator-d", _type: "creator", name: "D" },
    ]
    expect(missingEnglish(docs)).toEqual([])
  })

  it("does not count an empty row of English as English", () => {
    expect(missingEnglish([{ _id: "game-a", _type: "game", description: [row("en", ""), row("fr", "Un jeu.")] }])).toEqual(["game-a: description is in fr and not in English"])
  })
})
