import { studioTypes } from "@pbgo/content-kit/form-rules"
import { describe, expect, it } from "vitest"
import studio from "../sanity.config"
import { ANNOUNCEMENT_TONES, CHANGELOG_KINDS, CREATOR_ROLES, GAME_KINDS, roleTitle } from "./constants"

// The model of the platform's Sanity project as it was agreed (PLT-19): these tests pin its shape, so that a type or a field cannot
// change without somebody noticing that the hub (PLT-90) and the seed read it.

const types = studioTypes(studio)

// The types of a type and of its fields, as the checker of the seed reads them (this file cannot name them: the studio's tsconfig does not follow the sources of the content kit's tests)
type TypeDef = NonNullable<ReturnType<typeof types.get>>
type FieldDef = NonNullable<TypeDef["fields"]>[number]

const typeOf = (name: string): TypeDef => {
  const found = types.get(name)
  if (!found) throw new Error(`The Studio has no type "${name}"`)
  return found
}

const fieldNames = (name: string) => (typeOf(name).fields ?? []).map((field) => field.name)

const fieldOf = (typeName: string, field: string): FieldDef => {
  const found = typeOf(typeName).fields?.find((candidate) => candidate.name === field)
  if (!found) throw new Error(`The Studio type "${typeName}" has no field "${field}"`)
  return found
}

describe("the types", () => {
  it("are the catalog and the editorial ones, and nothing of a game's Studio", () => {
    expect([...types.keys()]).toEqual(["game", "gameCreator", "creator", "publisher", "category", "article", "changelogEntry", "announcement"])
    for (const shared of ["settings", "interface", "audio", "texts", "localeString", "localeText", "localeStringList"]) expect(types.has(shared)).toBe(false)
  })

  it("have no document for the shop yet", () => {
    expect([...types.keys()].filter((name) => /shop|skin/i.test(name))).toEqual([])
  })
})

describe("a game", () => {
  const tabs = () => {
    const game = typeOf("game")
    return Object.fromEntries((game.groups ?? []).map((group) => [group.name, (game.fields ?? []).filter((field) => field.group === group.name).map((field) => field.name)]))
  }

  it("is in seven tabs, from what it is to what is shown of it", () => {
    expect(tabs()).toEqual({
      identity: ["name", "slug", "bggId", "kind", "baseGame", "order"],
      facts: ["playersMin", "playersMax", "duration", "minAge", "complexity", "releaseDate", "categories"],
      credits: ["creators", "publishers"],
      texts: ["tagline", "description"],
      rules: ["rulesFr", "rulesEn", "rulesEs", "rulesDe"],
      visuals: ["cover", "logo", "icon", "background", "boxFront"],
      related: ["related"],
    })
  })

  it("opens on its identity", () => {
    expect(typeOf("game").groups?.find((group) => group.default)?.name).toBe("identity")
  })

  it("has a link to the rules in each of the languages of the platform, and no other text in several languages", () => {
    expect(fieldNames("game").filter((name) => name.startsWith("rules"))).toEqual(["rulesFr", "rulesEn", "rulesEs", "rulesDe"])
    expect(fieldNames("game").filter((name) => /^(description|tagline)/.test(name))).toEqual(["tagline", "description"])
  })

  it("credits people with their roles on a line, and publishers apart: the list is not called credits", () => {
    expect(fieldNames("game")).not.toContain("credits")
    expect(fieldOf("game", "creators").of?.map((member) => member.type)).toEqual(["gameCreator"])
    expect(fieldNames("gameCreator")).toEqual(["creator", "roles"])
    expect(fieldOf("game", "publishers").of?.map((member) => member.type)).toEqual(["reference"])
  })

  it("keeps a cover and the front of its box apart", () => {
    expect(fieldOf("game", "cover").type).toBe("image")
    expect(fieldOf("game", "boxFront").type).toBe("image")
  })

  it("is related to other games by weak references, which the others are not: two games that name each other cannot be published otherwise", () => {
    const member = fieldOf("game", "related").of?.[0] as { weak?: boolean } | undefined
    expect(member?.weak).toBe(true)
    for (const field of ["categories", "publishers"]) expect((fieldOf("game", field).of?.[0] as { weak?: boolean } | undefined)?.weak).not.toBe(true)
    expect((fieldOf("game", "baseGame") as { weak?: boolean }).weak).not.toBe(true)
  })

  it("points at games, categories and publishers by reference, and is not listed twice in anything it points to", () => {
    const targets = (name: string, field: string) => (fieldOf(name, field).of?.[0] as { to?: { type: string }[] } | undefined)?.to?.map((target) => target.type)
    expect(targets("game", "categories")).toEqual(["category"])
    expect(targets("game", "publishers")).toEqual(["publisher"])
    expect(targets("game", "related")).toEqual(["game"])
    expect((fieldOf("game", "baseGame") as { to?: { type: string }[] }).to?.map((target) => target.type)).toEqual(["game"])
  })
})

describe("the other catalog documents", () => {
  it.each([
    ["creator", ["name", "photo", "website", "bggId"]],
    ["publisher", ["name", "website", "logo", "bggId"]],
    ["category", ["name", "icon", "color", "description"]],
  ])("a %s has %j", (name, fields) => {
    expect(fieldNames(name)).toEqual(fields)
  })
})

describe("the editorial documents", () => {
  it.each([
    ["article", ["title", "slug", "excerpt", "body", "cover", "publishedAt", "author", "games"]],
    ["changelogEntry", ["title", "date", "kind", "body", "image", "games"]],
    ["announcement", ["title", "message", "tone", "startsAt", "endsAt", "link", "dismissible", "game"]],
  ])("an %s has %j", (name, fields) => {
    expect(fieldNames(name)).toEqual(fields)
  })

  it("write their body as rich text, a list that more kinds of block can join", () => {
    expect(fieldOf("article", "body").of?.map((member) => member.type)).toEqual(["block"])
    expect(fieldOf("changelogEntry", "body").of?.map((member) => member.type)).toEqual(["block"])
  })
})

describe("the lists", () => {
  it("name the kinds of game", () => {
    expect(GAME_KINDS.map((kind) => kind.value)).toEqual(["game", "expansion", "reimplementation"])
  })

  it("are the credits of BoardGameGeek, in its words", () => {
    expect(CREATOR_ROLES.map((role) => role.title)).toEqual(["Designer", "Solo designer", "Developer", "Artist", "Graphic designer", "Editor", "Sculptor", "Writer", "Insert designer"])
    expect(new Set(CREATOR_ROLES.map((role) => role.value)).size).toBe(CREATOR_ROLES.length)
  })

  it("show a role by its title, and one the list no longer has as it is", () => {
    expect(roleTitle("graphicDesigner")).toBe("Graphic designer")
    expect(roleTitle("composer")).toBe("composer")
  })

  it("feed the fields that list them", () => {
    expect(fieldOf("game", "kind").options?.list).toEqual([...GAME_KINDS])
    expect(fieldOf("gameCreator", "roles").options?.list).toEqual([...CREATOR_ROLES])
    expect(fieldOf("changelogEntry", "kind").options?.list).toEqual([...CHANGELOG_KINDS])
    expect(fieldOf("announcement", "tone").options?.list).toEqual([...ANNOUNCEMENT_TONES])
  })
})
