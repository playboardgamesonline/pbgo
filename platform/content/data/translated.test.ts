import { describe, expect, it } from "vitest"
import { missingEnglish, translatedRow, translatedRows, withEnglishRows } from "./translated.ts"

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

type Doc = { _id: string; _type: string; [field: string]: unknown }

describe("withEnglishRows", () => {
  const empty = (kind: string) => ({ _key: "en", _type: `internationalizedArray${kind}Value`, language: "en" })

  it("gives each translated field of a game, an expansion and a category its empty row of English", () => {
    const game = withEnglishRows<Doc>({ _id: "game-a", _type: "game", name: "A" })
    expect(Object.keys(game).sort()).toEqual(["_id", "_type", "boxFront", "cover", "description", "logo", "name", "names", "rules", "tagline"])
    expect(game.tagline).toEqual([empty("String")])
    expect(game.description).toEqual([empty("Description")])
    expect(game.logo).toEqual([empty("Image")])
    expect(Object.keys(withEnglishRows<Doc>({ _id: "expansion-a", _type: "expansion", name: "A" })).sort()).toEqual(["_id", "_type", "boxFront", "cover", "description", "name", "names", "rules"])
    expect(withEnglishRows({ _id: "category-a", _type: "category", name: "A" })).toEqual({ _id: "category-a", _type: "category", name: "A", names: [empty("LocalizedName")] })
  })

  it("puts it before the other languages of a field that has some, and keeps their rows", () => {
    const game = withEnglishRows<Doc>({ _id: "game-a", _type: "game", description: [{ _key: "fr", _type: "internationalizedArrayDescriptionValue", language: "fr", value: "Un jeu." }] })
    expect((game.description as { language: string }[]).map((row) => row.language)).toEqual(["en", "fr"])
  })

  it("leaves a field alone that has its row of English, filled or not", () => {
    const description = [{ _key: "k1", _type: "internationalizedArrayDescriptionValue", language: "en", value: "A game." }]
    expect(withEnglishRows<Doc>({ _id: "game-a", _type: "game", description }).description).toBe(description)
  })

  it("leaves the documents that have no translated field as they are", () => {
    for (const doc of [{ _id: "creator-a", _type: "creator", name: "A" }, { _id: "publisher-a", _type: "publisher", name: "A" }]) expect(withEnglishRows({ ...doc })).toEqual(doc)
  })
})
