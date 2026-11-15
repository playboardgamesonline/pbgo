import { readFileSync } from "node:fs"
import { studioTypes } from "@pbgo/content-kit/form-rules"
import { translatedRowType } from "@pbgo/studio-kit/constants"
import { describe, expect, it } from "vitest"
import studio from "./sanity.config"
import { TRANSLATED_FIELDS } from "./schemaTypes/constants"

// The skill `platform-catalog-entry` (PLT-98) writes the documents of a game's entry from skeletons, and says in a table, for each field of
// each type, what it does with it. These tests keep both true to the Studio's types: a field added to the model needs its row in the skill
// and, when the skill writes it or gives it the empty row of English, its place in the skeleton.

const SKILL = new URL("../../../.claude/skills/platform-catalog-entry/", import.meta.url)
const types = studioTypes(studio)

/** The types the skill makes documents of. */
const TYPES = ["game", "expansion", "creator", "publisher", "category"] as const

/** What the first words of a row of a table say the skill does with a field. */
type Disposition = "written" | "empty row" | "left empty"

const read = (file: string) => readFileSync(new URL(file, SKILL), "utf8")

const fieldsOf = (type: string): string[] => (types.get(type)?.fields ?? []).map((field) => field.name)

/** The translated fields of a type and the kind of value of each (`constants.ts`); none for a type that has none. */
const translatedFieldsOf = (type: string): Record<string, string> => (TRANSLATED_FIELDS as Record<string, Record<string, string>>)[type] ?? {}

/** The table under the heading "### `<type>`" of the skill: each field, with what the skill does with it. */
function dispositions(type: string): Map<string, Disposition> {
  const lines = read("SKILL.md").split("\n")
  const start = lines.findIndex((line) => line.trim() === `### \`${type}\``)
  if (start < 0) throw new Error(`The skill has no heading "### \`${type}\`"`)
  const rows = new Map<string, Disposition>()
  for (const line of lines.slice(start + 1)) {
    if (line.startsWith("#")) break
    const row = /^\|\s*`([^`]+)`\s*\|\s*(written|empty row|left empty)\b/.exec(line)
    if (row?.[1] && row[2]) rows.set(row[1], row[2] as Disposition)
  }
  return rows
}

const skeleton = (type: string): Record<string, unknown> => JSON.parse(read(`skeletons/${type}.json`)) as Record<string, unknown>

describe.each(TYPES)("the skill's table for %s", (type) => {
  it("has a row for each field of the type, and for nothing else", () => {
    expect([...dispositions(type).keys()].sort()).toEqual(fieldsOf(type).sort())
  })

  it("never leaves a translated field empty: it has at least the row of English", () => {
    const rows = dispositions(type)
    for (const field of Object.keys(translatedFieldsOf(type))) expect([field, rows.get(field)]).not.toEqual([field, "left empty"])
  })
})

describe.each(TYPES)("the skeleton of %s", (type) => {
  const doc = skeleton(type)
  const rows = dispositions(type)

  it("is a draft of the type", () => {
    expect(doc._type).toBe(type)
    expect(String(doc._id)).toMatch(new RegExp(`^drafts\\.${type}-`))
  })

  it("has the fields the skill writes or gives an empty row, and none of the others", () => {
    const fields = Object.keys(doc).filter((name) => !name.startsWith("_"))
    const expected = [...rows].filter(([, disposition]) => disposition !== "left empty").map(([name]) => name)
    expect(fields.sort()).toEqual(expected.sort())
  })

  it("gives each translated field the row of English, which has a value only where the skill writes one", () => {
    for (const [field, kind] of Object.entries(translatedFieldsOf(type))) {
      const translated = doc[field] as { _key?: string; _type?: string; language?: string; value?: unknown }[] | undefined
      expect(Array.isArray(translated), field).toBe(true)
      const english = translated?.[0]
      expect(english, field).toMatchObject({ _key: "en", _type: translatedRowType(kind), language: "en" })
      expect(english && "value" in english, field).toBe(rows.get(field) === "written")
    }
  })

  it("has no empty row where the skill writes a value, and a value nowhere that the skill leaves a row empty", () => {
    for (const [field, disposition] of rows) {
      const value = doc[field]
      if (disposition === "written") expect(value, field).toBeDefined()
      if (disposition === "empty row") expect(Array.isArray(value) && value.length === 1, field).toBe(true)
    }
  })
})

describe("the skeletons of a game and of an expansion", () => {
  it("point at their base game by a reference, which an expansion has strong", () => {
    for (const type of ["game", "expansion"]) {
      expect(skeleton(type).baseGame).toEqual({ _type: "reference", _ref: "game-<base game slug>" })
    }
  })

  it("credit people on one line each, with their roles, keyed by the person", () => {
    for (const type of ["game", "expansion"]) {
      const lines = skeleton(type).creators as { _key: string; _type: string; creator: { _ref: string }; roles: string[] }[]
      expect(lines).toHaveLength(1)
      expect(lines[0]).toMatchObject({ _type: "gameCreator", roles: ["designer"] })
      expect(lines[0]?._key).toBe(lines[0]?.creator._ref)
    }
  })
})
