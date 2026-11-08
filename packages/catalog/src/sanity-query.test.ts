import { describe, expect, it } from "vitest"
import { HUB_LANGUAGE, PLATFORM_PROJECT_ID, readSanityGames } from "./sanity"
import { fakeWeb, groqSanity, imageAsset, imageOf, row } from "./testing"

// The query of the hub run by a real GROQ engine over small datasets: a game as the dataset holds it today (a plain text, one field per
// language for the rules, a picture) and a game as the Studio writes it since the texts and pictures are translated field by field (an
// array of rows with a language). `fakeSanity` answers with a result already, so it cannot tell whether the query makes it.

const LOGO = imageAsset("aaa", 1600, 476, "webp")
const LOGO_EN = imageAsset("bbb", 800, 300, "png")
const LOGO_FR = imageAsset("ccc", 800, 300, "png")
const ICON = imageAsset("ddd", 512, 512, "png")
const BACKGROUND = imageAsset("eee", 2400, 1350, "jpg")
const COVER = imageAsset("fff", 640, 480, "webp")
const COVER_EN = imageAsset("ggg", 640, 480, "webp")
const COVER_FR = imageAsset("hhh", 640, 480, "webp")
const ASSETS = [LOGO, LOGO_EN, LOGO_FR, ICON, BACKGROUND, COVER, COVER_EN, COVER_FR]

const link = (name: string, language: string) => `https://example.com/${name}-${language}.pdf`
const shared = (slug: string) => ({ _type: "game", name: slug, slug: { _type: "slug", current: slug }, kind: "game", playersMin: 2, playersMax: 4, icon: imageOf(ICON), background: imageOf(BACKGROUND) })

/** A game as the dataset holds it today. */
const before = (slug: string, overrides: Record<string, unknown> = {}) => ({
  _id: `game-${slug}`,
  ...shared(slug),
  description: "The text of the game.",
  rulesFr: link(slug, "fr"),
  rulesEn: link(slug, "en"),
  logo: imageOf(LOGO),
  ...overrides,
})

/** The same game once converted: the same values, in rows. */
const after = (slug: string, overrides: Record<string, unknown> = {}) => ({
  _id: `game-${slug}`,
  ...shared(slug),
  description: [row("Text", "en", "The text of the game.")],
  rules: [row("Url", "en", link(slug, "en")), row("Url", "fr", link(slug, "fr"))],
  logo: [row("Image", "en", imageOf(LOGO))],
  ...overrides,
})

/** The games of the Studio that this dataset holds, read as the hub reads them, in a language. */
async function read(games: Record<string, unknown>[], language?: string) {
  const web = fakeWeb({ [`${PLATFORM_PROJECT_ID}.apicdn.sanity.io`]: groqSanity([...ASSETS, ...games]) })
  return readSanityGames({ fetch: web.fetch, ...(language ? { language } : {}) })
}

const only = async (game: Record<string, unknown>, language?: string) => {
  const { games, skipped } = await read([game], language)
  expect(skipped).toEqual([])
  const found = games[0]
  if (!found) throw new Error("The game was not read")
  return found
}

describe("a game as the dataset holds it today", () => {
  it("is read: its text, its links to the rules, its logo, icon and background", async () => {
    const game = await only(before("hanabi"))
    expect(game.descriptions).toEqual({ en: "The text of the game." })
    expect(game.rules).toEqual({ fr: link("hanabi", "fr"), en: link("hanabi", "en") })
    expect(game.pictures).toEqual({ logo: LOGO.url, icon: ICON.url, background: BACKGROUND.url, cover: null })
  })

  it("is read the same in any language: it has only what it has", async () => {
    expect(await only(before("hanabi"), "ja")).toEqual(await only(before("hanabi")))
  })
})

describe("a game with its texts and pictures in rows", () => {
  const translated = () =>
    after("hanabi", {
      description: [row("Text", "en", "The text of the game."), row("Text", "fr", "Le texte du jeu.")],
      rules: [row("Url", "en", link("hanabi", "en")), row("Url", "fr", link("hanabi", "fr")), row("Url", "zh", link("hanabi", "zh"))],
      logo: [row("Image", "en", imageOf(LOGO_EN)), row("Image", "fr", imageOf(LOGO_FR))],
    })

  it("is read in English by default: the row of English, whatever other languages the game has", async () => {
    const game = await only(translated())
    expect(HUB_LANGUAGE).toBe("en")
    expect(game.descriptions).toEqual({ en: "The text of the game." })
    expect(game.pictures.logo).toBe(LOGO_EN.url)
  })

  it("is read in the language asked for, when the game has a row in it", async () => {
    const game = await only(translated(), "fr")
    expect(game.descriptions).toEqual({ en: "Le texte du jeu." })
    expect(game.pictures.logo).toBe(LOGO_FR.url)
  })

  it("falls back on English when the game has nothing in the language asked for", async () => {
    const game = await only(translated(), "ja")
    expect(game.descriptions).toEqual({ en: "The text of the game." })
    expect(game.pictures.logo).toBe(LOGO_EN.url)
  })

  it("reads its links to the rules whatever the language of the read: one per language that has one (the hub knows four)", async () => {
    expect((await only(translated())).rules).toEqual({ en: link("hanabi", "en"), fr: link("hanabi", "fr") })
    expect((await only(translated(), "fr")).rules).toEqual({ en: link("hanabi", "en"), fr: link("hanabi", "fr") })
  })

  it("resolves a picture to its file even when it carries a hotspot and a crop", async () => {
    const hotspot = { _type: "sanity.imageHotspot", x: 0.4, y: 0.6, width: 0.5, height: 0.5 }
    const crop = { _type: "sanity.imageCrop", top: 0.1, bottom: 0.1, left: 0, right: 0 }
    const game = await only(after("hanabi", { logo: [row("Image", "en", imageOf(LOGO_EN, { hotspot, crop }))] }))
    expect(game.pictures.logo).toBe(LOGO_EN.url)
  })
})

describe("a game that was converted", () => {
  it("is read as it was before: the values are the same, in rows", async () => {
    const [old, converted] = await Promise.all([only(before("hanabi")), only(after("hanabi"))])
    expect(converted).toEqual(old)
  })

  it("is read as nothing when its rows are the empty ones of English that every field has: no text, no link, no picture, and never a list for a text", async () => {
    const game = await only(after("bare", { description: [row("Text", "en")], rules: [row("Url", "en")], logo: [row("Image", "en")] }))
    expect(game.descriptions).toEqual({})
    expect(game.rules).toEqual({})
    expect(game.pictures.logo).toBeNull()
  })

  it("is read as nothing when its fields have no row at all", async () => {
    const game = await only({ _id: "game-bare", ...shared("bare") })
    expect(game.descriptions).toEqual({})
    expect(game.rules).toEqual({})
    expect(game.pictures).toEqual({ logo: null, icon: ICON.url, background: BACKGROUND.url, cover: null })
  })

  it("has no text in a language that has a row when English has none: the hub reads English, and English is missing", async () => {
    const game = await only(after("odd", { description: [row("Text", "en"), row("Text", "fr", "Le texte.")] }))
    expect(game.descriptions).toEqual({})
    expect((await only(after("odd", { description: [row("Text", "en"), row("Text", "fr", "Le texte.")] }), "fr")).descriptions).toEqual({ en: "Le texte." })
  })
})

describe("a dataset in which some games are converted and some are not", () => {
  it("is read game by game, each in its own shape, which is the state the project is in until the migration has run", async () => {
    const { games } = await read([before("old"), after("new", { description: [row("Text", "en", "Another text.")], logo: [row("Image", "en", imageOf(LOGO_EN))] })])
    expect(games.map((game) => [game.slug, game.descriptions.en, game.pictures.logo])).toEqual([
      ["old", "The text of the game.", LOGO.url],
      ["new", "Another text.", LOGO_EN.url],
    ])
  })

  it("takes the row over the old field when a game has both, for the links to the rules, language by language", async () => {
    const both = before("mixed", { rules: [row("Url", "fr", "https://example.com/new-fr.pdf")], rulesFr: "https://example.com/old-fr.pdf", rulesEn: "https://example.com/old-en.pdf" })
    expect((await only(both)).rules).toEqual({ fr: "https://example.com/new-fr.pdf", en: "https://example.com/old-en.pdf" })
  })
})

describe("the cover of a game (PLT-114)", () => {
  it("is read from a game as the dataset holds it today, a plain image", async () => {
    expect((await only(before("catan", { cover: imageOf(COVER) }))).pictures.cover).toBe(COVER.url)
  })

  it("is read from the row of English, whatever other languages the game has one in, by default", async () => {
    const game = after("catan", { cover: [row("Image", "en", imageOf(COVER_EN)), row("Image", "fr", imageOf(COVER_FR))] })
    expect((await only(game)).pictures.cover).toBe(COVER_EN.url)
  })

  it("is read from the row of the language asked for, else from English", async () => {
    const game = after("catan", { cover: [row("Image", "en", imageOf(COVER_EN)), row("Image", "fr", imageOf(COVER_FR))] })
    expect((await only(game, "fr")).pictures.cover).toBe(COVER_FR.url)
    expect((await only(game, "ja")).pictures.cover).toBe(COVER_EN.url)
  })

  it("resolves to its file even when the Studio keeps a hotspot and a crop beside it: the CDN is asked for the whole picture", async () => {
    const hotspot = { _type: "sanity.imageHotspot", x: 0.4, y: 0.6, width: 0.5, height: 0.5 }
    const crop = { _type: "sanity.imageCrop", top: 0.1, bottom: 0.1, left: 0, right: 0 }
    const game = after("catan", { cover: [row("Image", "en", imageOf(COVER_EN, { hotspot, crop }))] })
    expect((await only(game)).pictures.cover).toBe(COVER_EN.url)
  })

  it("is none for the empty row of English that every game of the Studio has, and for a game that has no such field", async () => {
    expect((await only(after("bare", { cover: [row("Image", "en")] }))).pictures.cover).toBeNull()
    expect((await only({ _id: "game-bare", ...shared("bare") })).pictures.cover).toBeNull()
  })

  it("is the cover of its own game and not another's: a game without one reads none, beside a game with one", async () => {
    const { games } = await read([after("catan", { cover: [row("Image", "en", imageOf(COVER_EN))] }), after("bare", { cover: [row("Image", "en")] })])
    expect(games.map((game) => [game.slug, game.pictures.cover])).toEqual([
      ["catan", COVER_EN.url],
      ["bare", null],
    ])
  })
})

describe("the day a game was added", () => {
  it("is the day its document was created in the Studio, in either shape of the dataset", async () => {
    expect((await only({ ...before("hanabi"), _createdAt: "2026-10-30T14:02:41Z" })).addedAt).toBe("2026-10-30T14:02:41Z")
    expect((await only({ ...after("hanabi"), _createdAt: "2026-11-02T09:30:00Z" })).addedAt).toBe("2026-11-02T09:30:00Z")
  })

  it("is its own game's and not another's, and none for a document that has no creation date", async () => {
    const { games } = await read([{ ...after("catan"), _createdAt: "2026-11-02T09:30:00Z" }, { ...after("bare") }])
    expect(games.map((game) => [game.slug, game.addedAt])).toEqual([
      ["catan", "2026-11-02T09:30:00Z"],
      ["bare", null],
    ])
  })
})
