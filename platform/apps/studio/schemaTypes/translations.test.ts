import { pluginTypes, studioTypes } from "@pbgo/content-kit/form-rules"
import { DEFAULT_PLATFORM_LANGUAGE, PLATFORM_LANGUAGES, translatedRowType, translatedType } from "@pbgo/studio-kit/constants"
import { createSchema, validateDocument } from "sanity"
import { describe, expect, it } from "vitest"
import studio from "../sanity.config"
import { TRANSLATED_FIELDS, TRANSLATED_KINDS } from "./constants"
import { TRANSLATED_FIELD_TYPES, englishRow } from "./translations"

// The translated fields as the Studio builds them: the schema compiled with the plugin's own types, and a document run through the Studio's
// validation. The form itself (the buttons, the rows, the picture input) cannot be opened by a test; what decides how it behaves is checked
// here, from the schema and from the code of the plugin it is made by.

const schema = createSchema({ name: "default", types: [...studioTypes(studio).values(), ...pluginTypes(studio).values()] })

/** What the compiled schema holds of a field of a document type. */
const fieldOf = (type: string, name: string) => {
  const found = (schema.get(type) as { fields?: { name: string; type: Record<string, any> }[] }).fields?.find((field) => field.name === name)
  if (!found) throw new Error(`${type} has no field "${name}"`)
  return found
}

describe("the schema, compiled with the plugin", () => {
  it("has no problem the Studio would warn about in its console", () => {
    expect(schema._validation).toBeDefined()
    const problems = (schema._validation ?? []).flatMap((group) => group.problems.map((problem) => `${group.path.map((segment) => segment.name ?? segment.kind).join(" › ")}: ${problem.severity}: ${problem.message}`))
    expect(problems).toEqual([])
  })

  it("makes a type of array and a type of row for each kind of translated value, named as `translatedType` says", () => {
    for (const kind of TRANSLATED_KINDS) {
      expect(schema.get(translatedType(kind)), kind).toBeDefined()
      expect(schema.get(translatedRowType(kind)), kind).toBeDefined()
    }
    expect(TRANSLATED_FIELD_TYPES.map((entry) => (typeof entry === "string" ? entry : entry.name))).toEqual([...TRANSLATED_KINDS])
  })

  it("gives each row a value of its kind and the language it holds", () => {
    const valueTypes = Object.fromEntries(TRANSLATED_KINDS.map((kind) => [kind, (schema.get(translatedRowType(kind)) as { fields: { name: string; type: { name: string } }[] }).fields.map((field) => `${field.name}: ${field.type.name}`)]))
    expect(valueTypes).toEqual({
      string: ["value: string", "language: string"],
      url: ["value: url", "language: string"],
      image: ["value: image", "language: string"],
      description: ["value: text", "language: string"],
      localizedName: ["value: string", "language: string"],
    })
  })

  it("makes every translated field of the catalog an array of the rows of its kind", () => {
    for (const [type, fields] of Object.entries(TRANSLATED_FIELDS)) {
      for (const [name, kind] of Object.entries(fields)) {
        const field = fieldOf(type, name)
        expect(field.type.name, `${type}.${name}`).toBe(translatedType(kind))
        expect(field.type.jsonType, `${type}.${name}`).toBe("array")
        expect(field.type.of.map((member: { name: string }) => member.name), `${type}.${name}`).toEqual([translatedRowType(kind)])
      }
    }
  })

  it("holds the options of a picture on the field, where the plugin takes them from to give them to the picture of each row: the hotspot of a cover", () => {
    // the plugin copies every option of the array but its own (`apiVersion`, `languages`, `select`) onto the value of each row when it draws it
    for (const type of ["game", "expansion"]) expect(fieldOf(type, "cover").type.options.hotspot, `${type}.cover`).toBe(true)
    for (const [type, name] of [["game", "logo"], ["game", "boxFront"], ["expansion", "boxFront"]]) expect(fieldOf(type!, name!).type.options.hotspot, `${type}.${name}`).toBeUndefined()
  })

  it("starts a new document with the empty row of English in each of its translated fields: the plugin only puts a missing one back in the fields of the open tab, so nothing is left to it", () => {
    for (const [type, fields] of Object.entries(TRANSLATED_FIELDS)) {
      for (const [name, kind] of Object.entries(fields)) {
        expect(fieldOf(type, name).type.initialValue, `${type}.${name}`).toEqual([englishRow(kind)])
      }
    }
    expect(englishRow("image")).toEqual({ _key: "en", _type: "internationalizedArrayImageValue", language: "en" })
    expect(englishRow("localizedName")).toEqual({ _key: "en", _type: "internationalizedArrayLocalizedNameValue", language: "en" })
  })

  it("lists the languages of the platform on every array, English first", () => {
    const languages = fieldOf("game", "description").type.options.languages as { id: string }[]
    expect(languages.map((language) => language.id)).toEqual(PLATFORM_LANGUAGES.map((language) => language.id))
    expect(languages[0]?.id).toBe(DEFAULT_PLATFORM_LANGUAGE)
  })
})
