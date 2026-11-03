import { studioTypes } from "@pbgo/content-kit/form-rules"
import { describe, expect, it } from "vitest"
import studio from "../sanity.config"
import { ANNOUNCEMENT_TONES, CHANGELOG_KINDS, CREATOR_ROLES, GAME_KINDS, roleTitle, TRANSLATED_FIELDS } from "./constants"

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

/** The rules a field's validation states, by name: its function (or each of its array) is handed a Rule that records the calls made on it. */
const rulesOf = (field: FieldDef): string[] => {
  const names: string[] = []
  const rule: unknown = new Proxy(
    {},
    {
      get:
        (_target, name) =>
        (..._args: unknown[]) => {
          names.push(String(name))
          return rule
        },
    },
  )
  const validators = Array.isArray(field.validation) ? field.validation : field.validation ? [field.validation] : []
  for (const validator of validators) if (typeof validator === "function") validator(rule)
  return names
}

describe("the types", () => {
  it("are the catalog and the editorial ones, and nothing of a game's Studio", () => {
    expect([...types.keys()]).toEqual(["game", "expansion", "gameCreator", "galleryClip", "gameHelper", "creator", "publisher", "category", "article", "changelogEntry", "announcement"])
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
      identity: ["name", "names", "slug", "bggId", "kind", "baseGame", "order"],
      facts: ["playersMin", "playersMax", "duration", "minAge", "complexity", "releaseDate", "categories"],
      credits: ["creators", "publishers", "buyUrl"],
      texts: ["tagline", "description"],
      rules: ["rules", "helpers"],
      visuals: ["cover", "logo", "icon", "background", "boxFront", "gallery"],
      related: ["related"],
    })
  })

  it("opens on its identity", () => {
    expect(typeOf("game").groups?.find((group) => group.default)?.name).toBe("identity")
  })

  it("has one link to the rules, translated like its texts: the four fields of the old model are gone", () => {
    expect(fieldNames("game").filter((name) => name.startsWith("rules"))).toEqual(["rules"])
    expect(fieldOf("game", "rules").type).toBe("internationalizedArrayUrl")
  })

  it("credits people with their roles on a line, and publishers apart: the list is not called credits", () => {
    expect(fieldNames("game")).not.toContain("credits")
    expect(fieldOf("game", "creators").of?.map((member) => member.type)).toEqual(["gameCreator"])
    expect(fieldNames("gameCreator")).toEqual(["creator", "roles"])
    expect(fieldOf("game", "publishers").of?.map((member) => member.type)).toEqual(["reference"])
  })

  it("keeps a cover and the front of its box apart, as two pictures a language can change", () => {
    expect(fieldOf("game", "cover").type).toBe("internationalizedArrayImage")
    expect(fieldOf("game", "boxFront").type).toBe("internationalizedArrayImage")
  })

  it("has a gallery of pictures and clips that holds as many as the hub reads and is the same in every language: a clip is a video file, with a poster and a caption", () => {
    const gallery = fieldOf("game", "gallery")
    expect(gallery.type).toBe("array")
    expect(gallery.of?.map((member) => (member as { name?: string }).name ?? member.type)).toEqual(["galleryImage", "galleryClip"])
    expect(rulesOf(gallery)).toContain("max")
    expect(Object.keys(TRANSLATED_FIELDS.game)).not.toContain("gallery")
    expect(fieldNames("galleryClip")).toEqual(["video", "poster", "caption"])
    expect(fieldOf("galleryClip", "video").type).toBe("file")
    expect(rulesOf(fieldOf("galleryClip", "video"))).toContain("required")
  })

  it("has helpers, the aids a player may have while they play: a list that holds as many as the hub reads, the same in every language, each with a name and the key that the game calls it by", () => {
    const helpers = fieldOf("game", "helpers")
    expect(helpers.type).toBe("array")
    expect(helpers.of?.map((member) => member.type)).toEqual(["gameHelper"])
    expect(rulesOf(helpers)).toContain("max")
    expect(rulesOf(helpers)).toContain("custom")
    expect(Object.keys(TRANSLATED_FIELDS.game)).not.toContain("helpers")
    expect(fieldNames("gameHelper")).toEqual(["title", "key"])
    expect(rulesOf(fieldOf("gameHelper", "title"))).toContain("required")
    expect(rulesOf(fieldOf("gameHelper", "key"))).toEqual(expect.arrayContaining(["required", "custom"]))
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

describe("an expansion", () => {
  const tabs = () => {
    const expansion = typeOf("expansion")
    return Object.fromEntries((expansion.groups ?? []).map((group) => [group.name, (expansion.fields ?? []).filter((field) => field.group === group.name).map((field) => field.name)]))
  }

  it("is in six tabs, the ones of a game without Related", () => {
    expect(tabs()).toEqual({
      identity: ["name", "names", "slug", "baseGame", "bggId"],
      facts: ["playersMin", "playersMax", "duration", "minAge", "complexity", "releaseDate", "categories"],
      credits: ["creators", "publishers"],
      texts: ["description"],
      rules: ["rules"],
      visuals: ["cover", "boxFront"],
    })
  })

  it("opens on its identity", () => {
    expect(typeOf("expansion").groups?.find((group) => group.default)?.name).toBe("identity")
  })

  it("needs a base game, a strong reference to a game: the game cannot be deleted from under its expansions", () => {
    const baseGame = fieldOf("expansion", "baseGame")
    expect(baseGame.type).toBe("reference")
    expect(baseGame.to?.map((target) => target.type)).toEqual(["game"])
    expect((baseGame as { weak?: boolean }).weak).not.toBe(true)
    expect(rulesOf(baseGame)).toContain("required")
  })

  it("is not a kind of game, and has none of what places a game on the hub: no kind, order, related, tagline, logo, icon or background", () => {
    for (const field of ["kind", "order", "related", "tagline", "logo", "icon", "background"]) expect(fieldNames("expansion"), field).not.toContain(field)
  })

  it("has the complexity and the categories that it brings, which its card in the lobby shows: a weight from 1 to 5 and references to categories, none of them required", () => {
    expect(fieldOf("expansion", "complexity").type).toBe("number")
    expect(rulesOf(fieldOf("expansion", "complexity"))).toEqual(expect.arrayContaining(["min", "max"]))
    expect(rulesOf(fieldOf("expansion", "complexity"))).not.toContain("required")
    const categories = fieldOf("expansion", "categories")
    expect(categories.type).toBe("array")
    expect((categories.of?.[0] as { to?: { type: string }[] }).to?.map((target) => target.type)).toEqual(["category"])
    expect(rulesOf(categories)).not.toContain("required")
  })

  it("has two pictures, the cover of the expansion and the front of its box, which a language can change", () => {
    expect(fieldOf("expansion", "cover").type).toBe("internationalizedArrayImage")
    expect(fieldOf("expansion", "boxFront").type).toBe("internationalizedArrayImage")
  })

  it("credits people with their roles on a line and publishers apart, as a game does", () => {
    expect(fieldOf("expansion", "creators").of?.map((member) => member.type)).toEqual(["gameCreator"])
    expect(fieldOf("expansion", "publishers").of?.map((member) => member.type)).toEqual(["reference"])
    expect(((fieldOf("expansion", "publishers").of?.[0] as { to?: { type: string }[] }).to ?? []).map((target) => target.type)).toEqual(["publisher"])
  })

  it("fills its figures only where it changes them: their titles say that an empty one is the base game's, and nothing but the base game is required", () => {
    const title = (name: string) => (fieldOf("expansion", name) as { title?: string }).title ?? ""
    for (const name of ["playersMin", "playersMax", "duration", "minAge"]) expect([name, title(name)]).toEqual([name, expect.stringContaining("empty: the base game's")])
    expect(title("playersMax")).not.toContain("no limit")
    for (const name of ["playersMin", "playersMax", "duration", "minAge", "complexity", "releaseDate", "categories", "creators", "publishers", "description"]) expect(rulesOf(fieldOf("expansion", name)), name).not.toContain("required")
  })

  it("is given its facts, credits, texts, rules and pictures as a game is: the same kind of field under the same rules", () => {
    const options = (field: FieldDef) => (field as { options?: Record<string, unknown> }).options
    for (const { name } of typeOf("expansion").fields ?? []) {
      if (name === "baseGame") continue
      const own = fieldOf("expansion", name)
      const game = fieldOf("game", name)
      expect([name, own.type, options(own), rulesOf(own)]).toEqual([name, game.type, options(game), rulesOf(game)])
      expect([name, own.of?.map((member) => member.type)]).toEqual([name, game.of?.map((member) => member.type)])
    }
  })
})

describe("the other catalog documents", () => {
  it.each([
    ["creator", ["name", "photo", "website", "bggId"]],
    ["publisher", ["name", "website", "logo", "bggId"]],
    ["category", ["name", "names", "icon", "color", "description"]],
  ])("a %s has %j", (name, fields) => {
    expect(fieldNames(name)).toEqual(fields)
  })
})

describe("the translated fields (PLT-104)", () => {
  // the fields whose type is one of the plugin's arrays, by document type
  const translatedOf = (type: string) => (typeOf(type).fields ?? []).filter((field) => field.type.startsWith("internationalizedArray")).map((field) => field.name)

  it("are the ones TRANSLATED_FIELDS lists, which the seed writes and the migration converts: no field of the Studio is translated without it", () => {
    for (const type of Object.keys(TRANSLATED_FIELDS)) expect(translatedOf(type).sort(), type).toEqual(Object.keys(TRANSLATED_FIELDS[type as keyof typeof TRANSLATED_FIELDS]).sort())
    for (const name of types.keys()) if (!(name in TRANSLATED_FIELDS)) expect(translatedOf(name), name).toEqual([])
  })

  it("are of the kind TRANSLATED_FIELDS says", () => {
    const kinds = { string: "internationalizedArrayString", url: "internationalizedArrayUrl", image: "internationalizedArrayImage", description: "internationalizedArrayDescription", localizedName: "internationalizedArrayLocalizedName" }
    for (const [type, fields] of Object.entries(TRANSLATED_FIELDS)) {
      for (const [name, kind] of Object.entries(fields)) expect([type, name, fieldOf(type, name).type]).toEqual([type, name, kinds[kind as keyof typeof kinds]])
    }
  })

  it("leave the English name a plain text, the reference of the slug, the order and the search, and the names in the other languages beside it", () => {
    for (const type of ["game", "expansion", "category"]) {
      expect(fieldOf(type, "name").type, type).toBe("string")
      expect(rulesOf(fieldOf(type, "name")), type).toContain("required")
      expect(fieldOf(type, "names").type, type).toBe("internationalizedArrayLocalizedName")
    }
    expect((fieldOf("game", "slug") as { options?: { source?: string } }).options?.source).toBe("name")
    expect((fieldOf("expansion", "slug") as { options?: { source?: string } }).options?.source).toBe("name")
  })

  it("leave the icon and the background plain pictures: what the languages share", () => {
    expect(fieldOf("game", "icon").type).toBe("image")
    expect(fieldOf("game", "background").type).toBe("image")
    expect(fieldOf("category", "icon").type).toBe("image")
  })

  it("keep the options of the picture they were made from: the hotspot of a cover and of a background", () => {
    const options = (type: string, name: string) => (fieldOf(type, name) as { options?: { hotspot?: boolean } }).options
    expect(options("game", "cover")).toEqual({ hotspot: true })
    expect(options("expansion", "cover")).toEqual({ hotspot: true })
    expect(options("game", "background")).toEqual({ hotspot: true })
  })

  it("ask for nothing, and ask that a language be filled in only where English is: each one is under the rule of the translations, none is required", () => {
    for (const [type, fields] of Object.entries(TRANSLATED_FIELDS)) {
      for (const name of Object.keys(fields)) {
        expect(rulesOf(fieldOf(type, name)), `${type}.${name}`).toContain("custom")
        expect(rulesOf(fieldOf(type, name)), `${type}.${name}`).not.toContain("required")
      }
    }
  })

  it("have no field of the old model left: no rules link per language, nothing named after a language", () => {
    for (const type of ["game", "expansion"]) expect(fieldNames(type).filter((name) => /^rules.+/.test(name))).toEqual([])
    for (const type of ["game", "expansion", "category"]) expect(fieldNames(type).filter((name) => /(Fr|En|Es|De)$/.test(name))).toEqual([])
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
  it("name the kinds of game: an expansion is not one, it is a type of its own", () => {
    expect(GAME_KINDS.map((kind) => kind.value)).toEqual(["game", "reimplementation"])
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
