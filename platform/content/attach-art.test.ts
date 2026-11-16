import { spawnSync } from "node:child_process"
import { run } from "@pbgo/content-kit/seed"
import { MemoryStore, TempFolders, imageOf } from "@pbgo/content-kit/testing"
import { afterEach, describe, expect, it } from "vitest"
import { PLATFORM_PICTURES, pictureSlots } from "./data/art.ts"
import { gameId } from "./data/ids.ts"
import { CONTENT_DIR } from "./config.ts"

// The pictures of one game of the catalog (PLT-99): its slots, where each puts its picture, and the run of the seed on one document, against the in-memory dataset that has the contract of the real one.
const SLUG = "test-game"
const row = (type: string, language: string, value?: unknown) => ({ _key: language, _type: `internationalizedArray${type}Value`, language, ...(value === undefined ? {} : { value }) })
const IMAGE = { _type: "image" as const, asset: { _type: "reference" as const, _ref: "image-abc-10x10-webp" } }

/** The entry as `platform-catalog-entry` leaves it, published: the facts, and the empty row of English of the three translated pictures. */
const published = () => ({
  _id: gameId(SLUG),
  _type: "game",
  name: "Test Game",
  slug: { _type: "slug", current: SLUG },
  cover: [row("Image", "en")],
  logo: [row("Image", "en")],
  boxFront: [row("Image", "en")],
})

describe("the pictures of a game", () => {
  it("are five, named after the game and the picture, in the order of the Studio", () => {
    expect(PLATFORM_PICTURES).toEqual(["cover", "logo", "icon", "background", "boxFront"])
    expect(pictureSlots(SLUG, "Test Game").map((slot) => slot.name)).toEqual(["game-test-game-cover", "game-test-game-logo", "game-test-game-icon", "game-test-game-background", "game-test-game-boxFront"])
    expect(pictureSlots(SLUG, "Test Game").every((slot) => slot.docId === "game-test-game")).toBe(true)
  })

  it("go in the row of English when the field is translated (the cover, the logo, the box front), in the field when it is not (the icon, the background)", () => {
    for (const slot of pictureSlots(SLUG, "Test Game")) {
      const doc = { _id: "game-test-game", _type: "game" } as { _id: string; _type: string; [field: string]: unknown }
      slot.place(doc, IMAGE)
      const field = slot.name.slice("game-test-game-".length)
      if (field === "icon" || field === "background") expect(doc[field], field).toEqual(IMAGE)
      else expect(doc[field], field).toEqual([row("Image", "en", IMAGE)])
    }
  })

  it("have the proportions of a card for the cover, and a size that keeps a picture sharp where it is drawn large", () => {
    const slots = Object.fromEntries(pictureSlots(SLUG, "Test Game").map((slot) => [slot.name.slice("game-test-game-".length), slot]))
    expect(slots.cover?.ratio).toEqual([4, 3])
    for (const name of ["logo", "icon", "background", "boxFront"]) expect(slots[name]?.ratio, name).toBeUndefined()
    for (const slot of Object.values(slots)) expect(slot?.maxSize).toBeGreaterThanOrEqual(1024)
    expect(slots.background?.maxSize).toBeGreaterThan(slots.icon?.maxSize ?? 0)
  })
})

describe("the seed run on one game", () => {
  const temp = new TempFolders()
  afterEach(() => temp.cleanUp())

  const go = (store: MemoryStore, dir: string, options: { apply?: boolean; overwrite?: boolean; only?: string[] } = {}) =>
    run({ store, docs: [{ _id: gameId(SLUG), _type: "game" }], slots: pictureSlots(SLUG, "Test Game"), options: { apply: false, overwrite: false, only: [], artDir: dir, ...options } })

  it("fills the pictures that are missing in a draft of the published game, and touches nothing in a dry run", async () => {
    const store = new MemoryStore()
    store.put(published())
    const dir = await temp.create({ "game-test-game-logo.png": await imageOf("#336699", { width: 400, height: 200 }), "game-test-game-icon.png": await imageOf("#993366", { width: 256, height: 256 }) })
    const dry = await go(store, dir)
    expect(dry.mode).toBe("dry-run")
    expect(dry.plan.map((item) => [item.id, item.action])).toEqual([["game-test-game", "create-from-published"]])
    expect(store.writes).toEqual([])
    expect(store.uploads).toEqual([])
    expect(store.docs.has("drafts.game-test-game")).toBe(false)

    const applied = await go(store, dir, { apply: true })
    expect(applied.mode).toBe("apply")
    expect(applied.art?.uploaded).toBe(2)
    const draft = store.docs.get("drafts.game-test-game") as Record<string, unknown>
    // the facts of the published entry are kept, the two pictures are in, the ones with no file are as they were
    expect(draft.name).toBe("Test Game")
    expect((draft.icon as { asset: { _ref: string } }).asset._ref).toMatch(/^image-[0-9a-f]{40}-256x256-webp$/)
    expect((draft.logo as { value?: unknown; language: string }[])[0]?.value).toBeDefined()
    expect(draft.cover).toEqual([row("Image", "en")])
    expect(store.docs.get("game-test-game")).toEqual(expect.objectContaining({ logo: [row("Image", "en")] }))
  })

  it("says the files that match no slot, and the slots that have none", async () => {
    const store = new MemoryStore()
    store.put(published())
    const dir = await temp.create({ "game-test-game-logo.png": await imageOf("#336699"), "game-test-game-logoo.png": await imageOf("#336699"), "notes.txt": "x" })
    const result = await go(store, dir)
    expect(result.art?.loaded.scan.unmatched).toEqual(["game-test-game-logoo.png"])
    expect(result.art?.loaded.scan.missing.map((slot) => slot.name)).toEqual(["game-test-game-cover", "game-test-game-icon", "game-test-game-background", "game-test-game-boxFront"])
  })

  it("warns about a cover that is not 4 : 3, and places it all the same", async () => {
    const store = new MemoryStore()
    store.put(published())
    const dir = await temp.create({ "game-test-game-cover.png": await imageOf("#336699", { width: 300, height: 300 }) })
    const result = await go(store, dir)
    expect(result.art?.loaded.images[0]?.warnings).toEqual([expect.stringContaining("expected 4:3")])
    expect(result.plan[0]?.action).toBe("create-from-published")
  })

  it("keeps a picture that was edited in the Studio, and the same files again change nothing", async () => {
    const store = new MemoryStore()
    store.put({ ...published(), logo: [row("Image", "en", IMAGE)] })
    const dir = await temp.create({ "game-test-game-logo.png": await imageOf("#336699"), "game-test-game-icon.png": await imageOf("#993366") })
    await go(store, dir, { apply: true })
    const draft = store.docs.get("drafts.game-test-game") as Record<string, unknown>
    expect((draft.logo as { value: unknown }[])[0]?.value).toEqual(IMAGE)
    expect(draft.icon).toBeDefined()
    const again = await go(store, dir, { apply: true })
    expect(again.plan.map((item) => item.action)).toEqual(["unchanged"])
    expect(again.written).toBe(0)
  })

  it("never writes a published document: the drafts alone", async () => {
    const store = new MemoryStore()
    store.put(published())
    const dir = await temp.create({ "game-test-game-icon.png": await imageOf("#993366") })
    await go(store, dir, { apply: true })
    for (const write of store.writes) for (const op of write) expect(op.type === "createIfNotExists" ? op.doc._id : op.id).toMatch(/^drafts\./)
  })
})

describe("the command", () => {
  const attach = (args: string[], env: Record<string, string> = {}) =>
    spawnSync(process.execPath, ["--disable-warning=ExperimentalWarning", `${CONTENT_DIR}/attach-art.ts`, ...args], { encoding: "utf8", env: { PATH: process.env.PATH ?? "", HOME: process.env.HOME ?? "", ...env }, timeout: 30_000 })

  it("says its usage", () => {
    const result = attach(["--help"])
    expect(result.status).toBe(0)
    expect(result.stdout).toContain("Usage: node content/attach-art.ts <slug> --art-dir <folder> [--apply]")
    expect(attach([]).stdout).toContain("Usage: node content/attach-art.ts")
  })

  // nothing here reaches the dataset: each of these ends before the token is read (a checkout that has the token in its .env.local would otherwise connect)
  it("refuses a command line that is wrong, before it reads a token or a dataset", () => {
    const folder = attach(["flip-7"])
    expect(folder.status).toBe(2)
    expect(folder.stderr).toContain("give the folder with --art-dir")
    const slug = attach(["Flip 7", "--art-dir", "/tmp/x"])
    expect(slug.status).toBe(2)
    expect(slug.stderr).toContain("is not a slug")
    expect(attach(["--art-dir", "/tmp/x"]).stderr).toContain("Give the slug of the game first")
    expect(attach(["api", "--art-dir", "/tmp/x"]).stderr).toContain("is a route of the site")
  })
})
