import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

// The Sanity clients, the Next cache and the image conversions are replaced; the dataset is the in-memory one of ./test-sanity
const mocks = vi.hoisted(() => ({
  client: null as unknown,
  writable: true,
  revalidateTag: vi.fn(),
  revalidatePath: vi.fn(),
}))

vi.mock("server-only", () => ({}))
vi.mock("next/cache", () => ({ revalidateTag: mocks.revalidateTag, revalidatePath: mocks.revalidatePath }))
vi.mock("../lib/locale-server", () => ({ getLocale: async () => "fr" }))
vi.mock("../sanity/client", () => ({
  sanityClient: () => (mocks.client ? { withConfig: () => mocks.client } : null),
  sanityConfigured: (game: { sanityProjectId: string }) => !!game.sanityProjectId,
}))
vi.mock("../sanity/write-client", () => ({
  writeTokenName: (slug: string) => `SANITY_API_WRITE_TOKEN_${slug.toUpperCase()}`,
  sanityWritable: () => !!(mocks.writable && mocks.client),
  writeClient: () => (mocks.writable ? mocks.client : null),
}))
// The conversions need sharp: the file goes through as it is
vi.mock("./convert", () => {
  const through = (contentType: string) => async (file: File) => ({ buffer: Buffer.from(await file.arrayBuffer()), filename: file.name, contentType })
  return {
    asIs: async (file: File, contentType: string) => through(contentType)(file),
    imageToWebp: through("image/webp"),
    imageToIcon: through("image/png"),
    imageToShare: through("image/jpeg"),
    fontToWoff2: through("font/woff2"),
  }
})

import { UI_TEXTS } from "@pbgo/studio-kit/constants"
import { AUDIO_QUERY, audioQuery } from "../lib/audio-server"
import type { GameModule } from "../lib/binding"
import { mediaUrl } from "../lib/settings"
import { SETTINGS_QUERY, settingsQuery } from "../lib/settings-server"
import { SKIN_QUERY, skinQuery } from "../lib/skin-server"
import { DEFAULT_VOLUMES } from "../lib/sound-config"
import { type AdminData, readAdminData, removeAsset, saveSection, uploadAsset } from "./settings"
import { at, fakeSanity, type FakeDoc, type FakeSanity, T0 } from "./test-sanity"

type Fields = Record<string, unknown>

/** A game of the registry as the gamemaster receives it. Each call builds a new binding: the defaults are cached per binding. */
function sampleGame(over: Partial<GameModule> = {}): GameModule {
  return {
    slug: "sample",
    name: "Sample",
    tagline: "A sample game",
    sanityProjectId: "abc123xy",
    live: false,
    indexable: false,
    binding: {
      SLUG: "sample",
      NAME: "Sample",
      ERROR_CODES: ["NOT_ENOUGH_MISSIONS"],
      GAME: {
        minPlayers: 2,
        maxPlayers: 5,
        options: {
          rounds: { type: "number", label: "Rounds", defaultValue: 3, min: 1, max: 9 },
          fast: { type: "boolean", label: "Fast", defaultValue: false },
        },
      },
      SOUNDS: {
        effects: { click: { volume: 0.5 }, ding: { volume: 0.7 } },
      },
    },
    ...over,
  } as unknown as GameModule
}

/** A dataset the gamemaster reads and writes. */
function setup(initial: FakeDoc[] = []) {
  const sanity = fakeSanity(initial)
  mocks.client = sanity.client
  return sanity
}

type Fetch = (query: string, params?: Record<string, unknown>, options?: Record<string, unknown>) => Promise<unknown>

/** The same dataset, seen through a client whose `fetch` is wrapped. */
function through(sanity: FakeSanity, wrap: (fetch: Fetch) => Fetch) {
  mocks.client = { ...sanity.client, fetch: wrap(sanity.client.fetch as unknown as Fetch) }
}

const fakeDoc = (id: string, fields: Fields = {}, updatedAt = T0): FakeDoc => ({ _id: id, _type: id.replace(/^drafts\./, ""), _updatedAt: updatedAt, ...fields })

/** What the Studio can hold for one document: nothing, the published document alone, with a draft written after it (fresh) or before it (stale), or a draft alone. */
type Situation = "published" | "fresh draft" | "stale draft" | "lone draft" | "empty"

function dataset(id: string, situation: Situation, published: Fields = {}, draft: Fields = {}): FakeDoc[] {
  switch (situation) {
    case "published":
      return [fakeDoc(id, published)]
    case "fresh draft":
      return [fakeDoc(id, published), fakeDoc(`drafts.${id}`, draft, at(30))]
    case "stale draft":
      return [fakeDoc(id, published, at(120)), fakeDoc(`drafts.${id}`, draft, at(30))]
    case "lone draft":
      return [fakeDoc(`drafts.${id}`, draft, at(30))]
    case "empty":
      return []
  }
}

/** Every stored document, as it is now. */
const snapshot = (sanity: FakeSanity): Record<string, FakeDoc | undefined> => Object.fromEntries(sanity.ids().map((id) => [id, structuredClone(sanity.doc(id))]))

const pdf = (name = "rules.pdf") => new File(["%PDF-1.4 test"], name, { type: "application/pdf" })
const mp3 = (name: string) => new File([new Uint8Array([1, 2, 3])], name, { type: "audio/mpeg" })
const fileRef = (n: number) => ({ _type: "file", asset: { _type: "reference", _ref: `file-${n}` } })

beforeEach(() => {
  mocks.client = null
  mocks.writable = true
  mocks.revalidateTag.mockReset()
  mocks.revalidatePath.mockReset()
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

/* ------------------------------------------------------------------ what the admin shows */

describe("readAdminData", () => {
  const cases: Array<[Situation, string, AdminData["drafts"]]> = [
    ["published", "Published title", {}],
    ["fresh draft", "Draft title", {}],
    ["stale draft", "Published title", { settings: "stale" }],
    ["lone draft", "Draft title", { settings: "unpublished" }],
    ["empty", "Sample", {}],
  ]
  for (const [situation, title, drafts] of cases) {
    it(`${situation}: shows "${title}" and reports ${JSON.stringify(drafts)}`, async () => {
      setup(dataset("settings", situation, { title: "Published title" }, { title: "Draft title" }))

      const data = await readAdminData(sampleGame())

      expect(data.settings.title).toBe(title)
      expect(data.drafts).toEqual(drafts)
    })
  }

  it("reads every document in the raw perspective, the draft by its own id", async () => {
    const sanity = setup(dataset("settings", "fresh draft", { title: "Published title" }, { title: "Draft title" }))

    await readAdminData(sampleGame())

    expect(sanity.fetches.length).toBeGreaterThan(0)
    expect(sanity.fetches.every((f) => f.options?.perspective === "raw")).toBe(true)
    expect(sanity.fetches.some((f) => f.query.includes('_id == "drafts.settings"'))).toBe(true)
  })

  it("follows the draft of each document on its own", async () => {
    setup([
      ...dataset("settings", "published", { title: "Published title" }),
      ...dataset("interface", "fresh draft", { playerColors: ["#aaaaaa"], desktopOnly: true }, { playerColors: ["#112233"], desktopOnly: false }),
      ...dataset("texts", "published", { tagline: { _type: "localeString", fr: "Une accroche" } }),
    ])

    const data = await readAdminData(sampleGame())

    expect(data.settings.title).toBe("Published title")
    expect(data.skin.playerColors).toEqual(["#112233"])
    expect(data.skin.desktopOnly).toBe(false)
    expect(data.visual.customColors).toBe(true)
    expect(data.copy.entries.find((e) => e.key === "tagline")?.values.fr).toBe("Une accroche")
  })

  // A text only the game can write has no copy in the code: it is required, and Launch lists it until Sanity holds it
  it("marks the texts only the game can write as required and gives the platform's own labels a fallback", async () => {
    setup()

    const { entries } = (await readAdminData(sampleGame())).copy
    const entry = (key: string) => entries.find((e) => e.key === key)!

    expect(entry("tagline")).toMatchObject({ required: true, fallbacks: { fr: "", en: "", es: "", de: "" } })
    expect(entry("homeTitle")).toMatchObject({ required: false, fallbacks: { fr: "" } })
    expect(entry("homeIntro")).toMatchObject({ required: false, fallbacks: { fr: "" } })
    expect(entry("ui.replay").required).toBe(false)
    expect(entry("ui.replay").fallbacks.en).not.toBe("")
    expect(entry("error.GAME_NOT_FOUND").required).toBe(false)
    expect(entry("error.GAME_NOT_FOUND").fallbacks.fr).not.toBe("")
    expect(entry("error.NOT_ENOUGH_MISSIONS")).toMatchObject({ required: true, fallbacks: { fr: "", en: "" } })
  })

  it("lists the error codes of the platform and the ones the game declares, and no other", async () => {
    setup()

    const { entries } = (await readAdminData(sampleGame())).copy
    const codes = entries.filter((e) => e.group === "errors").map((e) => e.key)

    expect(codes).toContain("error.GAME_NOT_FOUND")
    expect(codes).toContain("error.NOT_ENOUGH_MISSIONS")
    expect(codes).not.toContain("error.NOT_AN_ERROR")
    expect((await readAdminData(sampleGame({ binding: { ...sampleGame().binding, ERROR_CODES: undefined } }))).copy.entries.some((e) => e.key === "error.NOT_ENOUGH_MISSIONS")).toBe(false)
  })

  it("has no victory phrase until Sanity holds one", async () => {
    setup()

    const { victoryPhrases } = (await readAdminData(sampleGame())).copy

    expect(victoryPhrases.values).toEqual({ fr: null, en: null, es: null, de: null })
  })

  it("reads the audio document the Studio shows", async () => {
    setup(
      dataset(
        "audio",
        "fresh draft",
        { volumes: { master: 0.4 }, effects: [{ _key: "a", key: "click", volume: 0.6 }] },
        { volumes: { master: 0.2 }, effects: [{ _key: "b", key: "click", volume: 0.9 }] },
      ),
    )

    const data = await readAdminData(sampleGame())

    expect(data.audio.volumes.master).toBe(0.2)
    expect(data.audio.effects.find((e) => e.key === "click")?.volume).toBe(0.9)
  })

  it("lists the declared effects with no file when Sanity has no audio document", async () => {
    setup()

    const { audio } = await readAdminData(sampleGame())

    expect(audio.effects).toEqual([
      { key: "click", url: null, volume: 0.5, codeVolume: 0.5 },
      { key: "ding", url: null, volume: 0.7, codeVolume: 0.7 },
    ])
    expect(audio.music).toEqual([])
    expect(audio.ambience).toBeNull()
    expect(audio.defaultMusic).toBeNull()
  })

  it("reads the files, the music and the ambience from Sanity only", async () => {
    const cdn = (name: string) => `https://cdn.sanity.io/files/abc123xy/production/${name}.mp3`
    setup(
      dataset("audio", "published", {
        defaultMusic: "theme",
        music: [{ _key: "t", key: "theme", title: "Theme", loopEnd: 90, file: { url: cdn("theme") } }],
        ambience: { loopEnd: 40, file: { url: cdn("ambience") } },
        effects: [{ _key: "c", key: "click", volume: 0.9, file: { url: cdn("click") } }],
      }),
    )

    const { audio } = await readAdminData(sampleGame())

    expect(audio.effects).toEqual([
      { key: "click", url: mediaUrl(cdn("click")), volume: 0.9, codeVolume: 0.5 },
      { key: "ding", url: null, volume: 0.7, codeVolume: 0.7 },
    ])
    expect(audio.music).toEqual([{ key: "theme", title: "Theme", url: mediaUrl(cdn("theme")), loopEnd: 90 }])
    expect(audio.ambience).toEqual({ url: mediaUrl(cdn("ambience")), loopEnd: 40 })
    expect(audio.defaultMusic).toBe("theme")
  })

  it("is read-only without a write token", async () => {
    setup()
    mocks.writable = false

    expect((await readAdminData(sampleGame())).writable).toBe(false)
  })

  it("follows the published documents when it cannot tell which versions exist", async () => {
    const sanity = setup(dataset("settings", "fresh draft", { title: "Published title" }, { title: "Draft title" }))
    through(sanity, (fetch) => (query, params, options) => (query.includes("_id in $ids") ? Promise.reject(new Error("unreachable")) : fetch(query, params, options)))
    const log = vi.spyOn(console, "error").mockImplementation(() => {})

    const data = await readAdminData(sampleGame())

    expect(data.settings.title).toBe("Published title")
    expect(data.drafts).toEqual({})
    expect(log).toHaveBeenCalledWith("Sanity (admin)", expect.any(Error))
  })

  it("follows the published documents with a client that cannot read drafts", async () => {
    const sanity = setup(dataset("settings", "fresh draft", { title: "Published title" }, { title: "Draft title" }))
    through(sanity, (fetch) => (query, params, options) => fetch(query, params, { ...options, perspective: "published" }))

    const data = await readAdminData(sampleGame())

    expect(data.settings.title).toBe("Published title")
    expect(data.drafts).toEqual({})
  })
})

describe("the queries of the admin", () => {
  it("are the ones of the live site, with the id of the version read", () => {
    expect(settingsQuery("drafts.settings").replace('"drafts.settings"', '"settings"')).toBe(SETTINGS_QUERY)
    expect(audioQuery("drafts.audio").replace('"drafts.audio"', '"audio"')).toBe(AUDIO_QUERY)
    expect(skinQuery({ interface: "drafts.interface", texts: "drafts.texts" }).replace('"drafts.interface"', '"interface"').replace('"drafts.texts"', '"texts"')).toBe(SKIN_QUERY)
  })
})

/* ------------------------------------------------------------------ saving */

describe("saveSection", () => {
  it("refreshes the cache of the game and returns what the admin shows now", async () => {
    setup(dataset("settings", "published", { title: "Old title" }))

    const data = await saveSection(sampleGame(), "identity", { title: "New title" })

    expect(mocks.revalidateTag.mock.calls).toEqual([
      ["sample:settings", { expire: 0 }],
      ["sample:skin", { expire: 0 }],
      ["sample:audio", { expire: 0 }],
    ])
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/sample", "layout")
    expect(data.settings.title).toBe("New title")
  })

  it("keeps reporting a stale draft after a save that left it alone", async () => {
    setup(dataset("settings", "stale draft", { title: "Old title" }, { title: "Stale title" }))

    const data = await saveSection(sampleGame(), "identity", { title: "New title" })

    expect(data.settings.title).toBe("New title")
    expect(data.drafts).toEqual({ settings: "stale" })
  })

  it("asks for a write token", async () => {
    const sanity = setup()
    mocks.writable = false

    await expect(saveSection(sampleGame(), "identity", { title: "New title" })).rejects.toMatchObject({ code: "SANITY_TOKEN_MISSING", status: 503 })
    expect(sanity.commits).toEqual([])
    expect(mocks.revalidateTag).not.toHaveBeenCalled()
  })

  it("tells a game without a Sanity project", async () => {
    setup()
    mocks.writable = false

    await expect(saveSection(sampleGame({ sanityProjectId: "" }), "identity", { title: "New title" })).rejects.toMatchObject({ code: "SANITY_NOT_CONFIGURED", status: 503 })
  })
})

describe("saveSection › identity", () => {
  const input = {
    title: "  New title  ",
    descriptions: { fr: "Une description", en: "A description", es: "", de: "" },
    creditsAuthors: { fr: "Jeanne", en: "Jane" },
    credits: { publisher: "PBGO", publisherUrl: "https://example.com" },
  }
  const fields = (title: string) => ({ title, bodyFont: "Inter", descriptionI18n: { _type: "localeText", es: "Old" } })

  // Where a save goes, for each state of the dataset: [state, documents patched by the one commit, ids that must hold the new values]
  const cases: Array<[Situation, string[][], string[]]> = [
    ["published", [["settings", "settings"]], ["settings"]],
    ["fresh draft", [["settings", "settings", "drafts.settings", "drafts.settings"]], ["settings", "drafts.settings"]],
    ["stale draft", [["settings", "settings"]], ["settings"]],
    ["lone draft", [["drafts.settings", "drafts.settings"]], ["drafts.settings"]],
    ["empty", [["+settings", "settings", "settings"]], ["settings"]],
  ]
  for (const [situation, commits, written] of cases) {
    it(`${situation}: one commit, writes ${written.join(" + ")}`, async () => {
      const sanity = setup(dataset("settings", situation, fields("Published title"), fields("Draft title")))
      const before = snapshot(sanity)

      await saveSection(sampleGame(), "identity", input)

      expect(sanity.touched()).toEqual(commits)
      expect(sanity.ids()).toEqual([...new Set([...Object.keys(before), ...written])].sort())
      for (const id of sanity.ids()) {
        if (!written.includes(id)) {
          expect(sanity.doc(id), id).toEqual(before[id])
          continue
        }
        expect(sanity.doc(id), id).toMatchObject({
          _type: "settings",
          title: "New title",
          description: "Une description",
          creditsAuthors: "Jeanne",
          descriptionI18n: { _type: "localeText", fr: "Une description", en: "A description" },
          creditsAuthorsI18n: { _type: "localeString", fr: "Jeanne", en: "Jane" },
          publisher: "PBGO",
          publisherUrl: "https://example.com",
        })
        expect(sanity.doc(id), id).not.toHaveProperty("descriptionI18n.es")
        if (before[id]) expect(sanity.doc(id), id).toMatchObject({ bodyFont: "Inter" })
      }
    })
  }

  it("writes both versions in one commit, at the same time", async () => {
    const sanity = setup(dataset("settings", "fresh draft", fields("Published title"), fields("Draft title")))

    await saveSection(sampleGame(), "identity", input)

    expect(sanity.commits).toHaveLength(1)
    expect(sanity.doc("settings")?._updatedAt).toBe(sanity.doc("drafts.settings")?._updatedAt)
  })

  const refused: Array<[string, Fields, string]> = [
    ["an empty title", { ...input, title: "   " }, "EMPTY_TITLE"],
    ["a publisher link that is not http(s)", { ...input, credits: { publisherUrl: "javascript:alert(1)" } }, "INVALID_URL"],
  ]
  for (const [label, bad, code] of refused) {
    it(`refuses ${label} before reading or writing anything`, async () => {
      const sanity = setup(dataset("settings", "fresh draft", fields("Published title"), fields("Draft title")))

      await expect(saveSection(sampleGame(), "identity", bad)).rejects.toMatchObject({ code, status: 400 })

      expect(sanity.fetches).toEqual([])
      expect(sanity.commits).toEqual([])
      expect(mocks.revalidateTag).not.toHaveBeenCalled()
    })
  }
})

describe("saveSection › mechanics", () => {
  const input = {
    options: { defaults: { rounds: 4, fast: true }, hidden: ["fast", "bogus"] },
    rulesPdfLinks: { fr: "https://example.com/rules-fr.pdf", en: "" },
    minPlayers: 3,
    maxPlayers: 9,
    turnTimeout: 5,
    desktopOnly: false,
  }
  const stored = { rulesPdfEn: "https://example.com/old-en.pdf", minPlayers: 2 }

  it("writes the settings of both versions, then the interface, and keeps the values in range", async () => {
    const sanity = setup([...dataset("settings", "fresh draft", stored, stored), ...dataset("interface", "published", { desktopOnly: true })])

    await saveSection(sampleGame(), "mechanics", input)

    expect(sanity.touched()).toEqual([["settings", "drafts.settings"], ["interface"]])
    for (const id of ["settings", "drafts.settings"]) {
      const doc = sanity.doc(id)
      expect(doc, id).toMatchObject({ minPlayers: 3, maxPlayers: 5, turnTimeout: 20, rulesPdfFr: "https://example.com/rules-fr.pdf" })
      expect(doc, id).not.toHaveProperty("rulesPdfEn")
      const options = doc?.gameOptions as { defaults: string; hidden: string[] }
      expect(JSON.parse(options.defaults), id).toEqual({ rounds: 4, fast: true })
      expect(options.hidden, id).toEqual(["fast"])
    }
    expect(sanity.doc("interface")).toMatchObject({ desktopOnly: false })
  })

  it("creates the interface document when the dataset has none", async () => {
    const sanity = setup(dataset("settings", "published"))

    await saveSection(sampleGame(), "mechanics", { ...input, desktopOnly: true })

    expect(sanity.touched()).toEqual([["settings"], ["+interface", "interface"]])
    expect(sanity.doc("interface")).toMatchObject({ _type: "interface", desktopOnly: true })
  })

  it("leaves the interface alone when the form does not send desktopOnly", async () => {
    const sanity = setup(dataset("settings", "published"))

    await saveSection(sampleGame(), "mechanics", { ...input, desktopOnly: undefined })

    expect(sanity.touched()).toEqual([["settings"]])
  })

  it("refuses a rulebook link that is not http(s) and writes nothing", async () => {
    const sanity = setup(dataset("settings", "fresh draft", stored, stored))

    await expect(saveSection(sampleGame(), "mechanics", { ...input, rulesPdfLinks: { fr: "ftp://example.com/rules.pdf" } })).rejects.toMatchObject({ code: "INVALID_URL", status: 400 })

    expect(sanity.commits).toEqual([])
  })
})

describe("saveSection › visual", () => {
  const theme = { background: "#112233", foreground: "#FFFFFF", accent: "#E8B43A", surface: "#1B2C4A", surfaceDark: "#0D1729" }
  const lowered = { background: "#112233", foreground: "#ffffff", accent: "#e8b43a", surface: "#1b2c4a", surfaceDark: "#0d1729" }
  const input = { theme, bodyFont: "Inter", displayFont: "Not a font", playerColors: ["#AABBCC", "#112233"] }

  it("writes the theme and fonts to both versions of settings and the colours to interface", async () => {
    const sanity = setup([
      ...dataset("settings", "fresh draft", { displayFont: "Old" }, { displayFont: "Old" }),
      ...dataset("interface", "published", { playerColors: ["#000000"] }),
    ])

    await saveSection(sampleGame(), "visual", input)

    expect(sanity.touched()).toEqual([["settings", "drafts.settings"], ["interface"]])
    for (const id of ["settings", "drafts.settings"]) {
      expect(sanity.doc(id), id).toMatchObject({ theme: lowered, bodyFont: "Inter" })
      expect(sanity.doc(id), id).not.toHaveProperty("displayFont")
    }
    expect(sanity.doc("interface")).toMatchObject({ playerColors: ["#aabbcc", "#112233"] })
  })

  const refused: Array<[string, Fields]> = [
    ["a theme colour that is not hex", { ...input, theme: { ...theme, accent: "red" } }],
    ["a missing theme colour", { ...input, theme: { ...theme, surface: undefined } }],
    ["a player colour that is not hex", { ...input, playerColors: ["#112233", "nope"] }],
  ]
  for (const [label, bad] of refused) {
    it(`refuses ${label} and writes nothing, not even the theme`, async () => {
      const sanity = setup([...dataset("settings", "fresh draft", { bodyFont: "Old" }, { bodyFont: "Old" }), ...dataset("interface", "published", { playerColors: ["#000000"] })])
      const before = snapshot(sanity)

      await expect(saveSection(sampleGame(), "visual", bad)).rejects.toMatchObject({ code: "INVALID_COLOR", status: 400 })

      expect(sanity.commits).toEqual([])
      expect(snapshot(sanity)).toEqual(before)
    })
  }

  it("removes the player colours with an empty list, and creates no interface document for that", async () => {
    const withColors = setup([...dataset("settings", "published"), ...dataset("interface", "published", { playerColors: ["#000000"] })])

    await saveSection(sampleGame(), "visual", { theme, playerColors: [] })

    expect(withColors.touched()).toEqual([["settings"], ["interface"]])
    expect(withColors.doc("interface")).not.toHaveProperty("playerColors")

    const without = setup(dataset("settings", "published"))

    await saveSection(sampleGame(), "visual", { theme, playerColors: [] })

    expect(without.touched()).toEqual([["settings"]])
    expect(without.ids()).toEqual(["settings"])
  })

  it("leaves the interface alone when the form does not send colours", async () => {
    const sanity = setup([...dataset("settings", "published"), ...dataset("interface", "published", { playerColors: ["#000000"] })])

    await saveSection(sampleGame(), "visual", { theme })

    expect(sanity.touched()).toEqual([["settings"]])
    expect(sanity.doc("interface")).toMatchObject({ playerColors: ["#000000"] })
  })
})

describe("saveSection › audio", () => {
  const input = {
    volumes: { master: 0.5, music: 2, effects: -1 },
    defaultMusic: "theme",
    ambienceLoopEnd: 120,
    music: [{ key: "theme", title: "  Renamed  ", loopEnd: 90 }],
    effects: { click: 0.3, ding: 0.9, bogus: 0.4 },
  }
  // The `_key` of an entry is not the same in the published document and in its draft
  const entries = (prefix: string) => ({
    music: [
      { _key: `${prefix}-theme`, key: "theme", title: "Theme" },
      { _key: `${prefix}-old`, key: "old", title: "Old" },
    ],
    effects: [{ _key: `${prefix}-click`, key: "click", volume: 0.5 }],
  })
  const expectSaved = (sanity: FakeSanity, id: string, prefix: string) =>
    expect(sanity.doc(id), id).toMatchObject({
      volumes: { master: 0.5, music: 1, effects: 0, ambience: DEFAULT_VOLUMES.ambience, alerts: DEFAULT_VOLUMES.alerts, reactions: DEFAULT_VOLUMES.reactions },
      defaultMusic: "theme",
      ambience: { _type: "audioLoop", loopEnd: 120 },
      music: [{ _key: `${prefix}-theme`, key: "theme", title: "Renamed", loopEnd: 90 }],
      effects: [
        { _key: `${prefix}-click`, key: "click", volume: 0.3 },
        { _key: "ding", _type: "audioEffect", key: "ding", volume: 0.9 },
      ],
    })

  it("patches each version through its own keys, in one commit", async () => {
    const sanity = setup(dataset("audio", "fresh draft", entries("pub"), entries("draft")))

    await saveSection(sampleGame(), "audio", input)

    expect(sanity.touched()).toEqual([["audio", "audio", "audio", "drafts.audio", "drafts.audio", "drafts.audio"]])
    expectSaved(sanity, "audio", "pub")
    expectSaved(sanity, "drafts.audio", "draft")
    expect(sanity.doc("audio")?._updatedAt).toBe(sanity.doc("drafts.audio")?._updatedAt)
  })

  it("never touches a stale draft", async () => {
    const sanity = setup(dataset("audio", "stale draft", entries("pub"), entries("draft")))
    const draft = structuredClone(sanity.doc("drafts.audio"))

    await saveSection(sampleGame(), "audio", input)

    expect(sanity.touched()).toEqual([["audio", "audio", "audio"]])
    expectSaved(sanity, "audio", "pub")
    expect(sanity.doc("drafts.audio")).toEqual(draft)
  })

  it("writes a draft that was never published, and only that one", async () => {
    const sanity = setup(dataset("audio", "lone draft", {}, entries("draft")))

    await saveSection(sampleGame(), "audio", input)

    expect(sanity.ids()).toEqual(["drafts.audio"])
    expectSaved(sanity, "drafts.audio", "draft")
  })

  it("creates the document, with the entries it needs, when the dataset has none", async () => {
    const sanity = setup()

    await saveSection(sampleGame(), "audio", { volumes: { master: 0.5 }, ambienceLoopEnd: 60, effects: { click: 0.3 } })

    expect(sanity.touched()).toEqual([["+audio", "audio", "audio", "audio"]])
    expect(sanity.doc("audio")).toMatchObject({
      _type: "audio",
      volumes: { ...DEFAULT_VOLUMES, master: 0.5 },
      ambience: { _type: "audioLoop", loopEnd: 60 },
      effects: [{ _key: "click", _type: "audioEffect", key: "click", volume: 0.3 }],
    })
  })
})

describe("saveSection › copy", () => {
  const replay = UI_TEXTS.find((t) => t.key === "replay")!
  const input = {
    values: {
      tagline: { fr: "Une accroche", en: "A tagline" },
      "ui.replay": { fr: "Rejouer !", en: "" },
      "error.GAME_NOT_FOUND": { en: "Table not found" },
      "error.NOT_ENOUGH_MISSIONS": { fr: "Pas assez de missions" },
      "error.NOT_AN_ERROR": { fr: "x" },
      "ui.notAText": { fr: "x" },
      other: { fr: "x" },
    },
    victoryPhrases: { fr: ["Bravo  ", "", "Champion"], en: [] },
  }

  it("creates the texts document with the values of each language, and nothing the game does not know", async () => {
    const sanity = setup()

    await saveSection(sampleGame(), "copy", input)

    expect(sanity.touched()).toEqual([["+texts", "texts", "texts"]])
    const doc = sanity.doc("texts")
    expect(doc).toMatchObject({
      _type: "texts",
      tagline: { _type: "localeString", fr: "Une accroche", en: "A tagline" },
      [`ui_${replay.group}`]: { replay: { _type: "localeString", fr: "Rejouer !" } },
      victoryPhrases: { _type: "localeStringList", fr: ["Bravo", "Champion"] },
      errorMessages: [
        { _key: "GAME_NOT_FOUND", _type: "errorMessage", code: "GAME_NOT_FOUND", message: { _type: "localeString", en: "Table not found" } },
        { _key: "NOT_ENOUGH_MISSIONS", _type: "errorMessage", code: "NOT_ENOUGH_MISSIONS", message: { _type: "localeString", fr: "Pas assez de missions" } },
      ],
    })
    expect(doc).not.toHaveProperty("other")
    expect(doc).not.toHaveProperty(`ui_${replay.group}.replay.en`)
    expect(doc).not.toHaveProperty("victoryPhrases.en")
  })

  it("adds the error messages to the list each version already holds", async () => {
    const message = (code: string, fr: string) => ({ _key: code, _type: "errorMessage", code, message: { _type: "localeString", fr } })
    const sanity = setup(
      dataset("texts", "fresh draft", { errorMessages: [message("RATE_LIMITED", "Trop vite")] }, { errorMessages: [message("GAME_FULL", "Plein")] }),
    )

    await saveSection(sampleGame(), "copy", { values: { "error.GAME_NOT_FOUND": { en: "Table not found" } } })

    const codes = (id: string) => (sanity.doc(id)?.errorMessages as { code: string }[]).map((e) => e.code)
    expect(sanity.touched()).toEqual([["texts", "drafts.texts"]])
    expect(codes("texts")).toEqual(["RATE_LIMITED", "GAME_NOT_FOUND"])
    expect(codes("drafts.texts")).toEqual(["GAME_FULL", "GAME_NOT_FOUND"])
  })

  it("never touches a stale draft", async () => {
    const sanity = setup(dataset("texts", "stale draft", { tagline: { _type: "localeString", fr: "Ancienne" } }, { tagline: { _type: "localeString", fr: "Périmée" } }))
    const draft = structuredClone(sanity.doc("drafts.texts"))

    await saveSection(sampleGame(), "copy", input)

    expect(sanity.touched()).toEqual([["texts", "texts"]])
    expect(sanity.doc("texts")).toMatchObject({ tagline: { fr: "Une accroche" } })
    expect(sanity.doc("drafts.texts")).toEqual(draft)
  })
})

/* ------------------------------------------------------------------ files */

describe("uploadAsset › rulebook", () => {
  // [state, the one commit, ids that hold the file]
  const cases: Array<[Situation, string[][], string[]]> = [
    ["published", [["settings"]], ["settings"]],
    ["fresh draft", [["settings", "drafts.settings"]], ["settings", "drafts.settings"]],
    ["stale draft", [["settings"]], ["settings"]],
    ["lone draft", [["drafts.settings"]], ["drafts.settings"]],
    ["empty", [["+settings", "settings"]], ["settings"]],
  ]
  for (const [situation, commits, written] of cases) {
    it(`${situation}: uploads once and links the file in ${written.join(" + ")}`, async () => {
      const sanity = setup(dataset("settings", situation, { title: "Published title" }, { title: "Draft title" }))
      const before = snapshot(sanity)

      await uploadAsset(sampleGame(), "rulesFr", pdf())

      expect(sanity.uploads).toHaveLength(1)
      expect(sanity.uploads[0]).toMatchObject({ kind: "file", filename: "rules.pdf", contentType: "application/pdf" })
      expect(sanity.touched()).toEqual(commits)
      for (const id of sanity.ids()) {
        if (written.includes(id)) expect(sanity.doc(id), id).toMatchObject({ rulesPdfFrFile: fileRef(1) })
        else expect(sanity.doc(id), id).toEqual(before[id])
      }
    })
  }

  const refused: Array<[string, string, File, string, number]> = [
    ["a file that is not a PDF", "rulesFr", new File(["x"], "notes.txt", { type: "text/plain" }), "INVALID_FILE", 400],
    ["a slot that does not exist", "nope", pdf(), "INVALID_REQUEST", 404],
    ["a file over the size Vercel accepts", "rulesFr", new File([new Uint8Array(4.5 * 1024 * 1024)], "big.pdf", { type: "application/pdf" }), "FILE_TOO_LARGE", 400],
  ]
  for (const [label, slot, file, code, status] of refused) {
    it(`refuses ${label} before uploading anything`, async () => {
      const sanity = setup(dataset("settings", "fresh draft"))

      await expect(uploadAsset(sampleGame(), slot, file)).rejects.toMatchObject({ code, status })

      expect(sanity.uploads).toEqual([])
      expect(sanity.commits).toEqual([])
    })
  }
})

describe("removeAsset › rulebook", () => {
  const cases: Array<[Situation, string[]]> = [
    ["published", ["settings"]],
    ["fresh draft", ["settings", "drafts.settings"]],
    ["stale draft", ["settings"]],
    ["lone draft", ["drafts.settings"]],
    ["empty", []],
  ]
  for (const [situation, written] of cases) {
    it(`${situation}: unlinks the file from ${written.join(" + ") || "nothing"} and creates no document`, async () => {
      const sanity = setup(dataset("settings", situation, { rulesPdfFrFile: fileRef(1) }, { rulesPdfFrFile: fileRef(2) }))
      const before = snapshot(sanity)

      await removeAsset(sampleGame(), "rulesFr")

      expect(sanity.ids()).toEqual(Object.keys(before).sort())
      for (const id of sanity.ids()) {
        if (written.includes(id)) expect(sanity.doc(id), id).not.toHaveProperty("rulesPdfFrFile")
        else expect(sanity.doc(id), id).toEqual(before[id])
      }
    })
  }
})

describe("uploadAsset › sounds", () => {
  it("creates the audio document with the effect when the dataset has none", async () => {
    const sanity = setup()

    await uploadAsset(sampleGame(), "audio.effect.click", mp3("click.mp3"))

    expect(sanity.uploads[0]).toMatchObject({ kind: "file", filename: "click.mp3", contentType: "audio/mpeg", bytes: 3 })
    expect(sanity.touched()).toEqual([["+audio", "audio", "audio"]])
    expect(sanity.doc("audio")).toMatchObject({ _type: "audio", effects: [{ _key: "click", _type: "audioEffect", key: "click", file: fileRef(1) }] })
  })

  it("replaces the file of an effect through the key each version gives it", async () => {
    const effects = (prefix: string) => ({ effects: [{ _key: `${prefix}-click`, key: "click", volume: 0.5 }] })
    const sanity = setup(dataset("audio", "fresh draft", effects("pub"), effects("draft")))

    await uploadAsset(sampleGame(), "audio.effect.click", mp3("click.mp3"))

    expect(sanity.touched()).toEqual([["audio", "drafts.audio"]])
    expect(sanity.doc("audio")).toMatchObject({ effects: [{ _key: "pub-click", volume: 0.5, file: fileRef(1) }] })
    expect(sanity.doc("drafts.audio")).toMatchObject({ effects: [{ _key: "draft-click", volume: 0.5, file: fileRef(1) }] })
  })

  it("refuses an effect the game does not declare and writes no document", async () => {
    const sanity = setup()

    await expect(uploadAsset(sampleGame(), "audio.effect.bogus", mp3("bogus.mp3"))).rejects.toMatchObject({ code: "INVALID_REQUEST", status: 404 })

    expect(sanity.commits).toEqual([])
    expect(sanity.ids()).toEqual([])
  })

  it("adds a track under a key made from its file name", async () => {
    const sanity = setup()

    await uploadAsset(sampleGame(), "audio.music.new", mp3("Théâtre du soir.mp3"))

    expect(sanity.doc("audio")).toMatchObject({
      music: [{ _key: "theatre-du-soir", _type: "audioTrack", key: "theatre-du-soir", title: "Théâtre du soir", file: fileRef(1) }],
    })
  })

  it("sets the ambience of both versions", async () => {
    const sanity = setup(dataset("audio", "fresh draft", { volumes: { master: 1 } }, { volumes: { master: 1 } }))

    await uploadAsset(sampleGame(), "audio.ambience", mp3("ambience.mp3"))

    expect(sanity.touched()).toEqual([["audio", "audio", "drafts.audio", "drafts.audio"]])
    for (const id of ["audio", "drafts.audio"]) expect(sanity.doc(id), id).toMatchObject({ ambience: { _type: "audioLoop", file: fileRef(1) } })
  })
})

describe("removeAsset › sounds", () => {
  const music = (prefix: string) => [
    { _key: `${prefix}-theme`, key: "theme", file: fileRef(1) },
    { _key: `${prefix}-other`, key: "other", file: fileRef(2) },
  ]

  it("removes a track from each version through its own key", async () => {
    const sanity = setup(dataset("audio", "fresh draft", { music: music("pub") }, { music: music("draft") }))

    await removeAsset(sampleGame(), "audio.music.theme")

    expect(sanity.doc("audio")).toMatchObject({ music: [{ _key: "pub-other" }] })
    expect(sanity.doc("drafts.audio")).toMatchObject({ music: [{ _key: "draft-other" }] })
  })

  it("unlinks the file of an effect and of the ambience, and keeps the entries", async () => {
    const sanity = setup(dataset("audio", "published", { effects: [{ _key: "a", key: "click", volume: 0.5, file: fileRef(1) }], ambience: { _type: "audioLoop", loopEnd: 40, file: fileRef(2) } }))

    await removeAsset(sampleGame(), "audio.effect.click")
    await removeAsset(sampleGame(), "audio.ambience")

    expect(sanity.doc("audio")).toMatchObject({ effects: [{ _key: "a", key: "click", volume: 0.5 }], ambience: { _type: "audioLoop", loopEnd: 40 } })
    expect(sanity.doc("audio")).not.toHaveProperty("effects.0.file")
    expect(sanity.doc("audio")).not.toHaveProperty("ambience.file")
  })

  it("creates no audio document to remove from", async () => {
    const sanity = setup()

    for (const slot of ["audio.effect.click", "audio.music.theme", "audio.ambience"]) await removeAsset(sampleGame(), slot)

    expect(sanity.ids()).toEqual([])
    expect(sanity.commits).toEqual([])
  })
})
