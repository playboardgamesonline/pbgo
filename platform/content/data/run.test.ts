import { run } from "@pbgo/content-kit/seed"
import type { RunOptions } from "@pbgo/content-kit/seed"
import { MemoryStore, TempFolders, imageOf } from "@pbgo/content-kit/testing"
import { afterEach, describe, expect, it } from "vitest"
import { buildSeedContent } from "./index.ts"
import { source } from "./test-fixtures.ts"

// The runner itself is tested in @pbgo/content-kit; these tests run the platform's own seed and art slots through it.

const apply: RunOptions = { apply: true, overwrite: false, only: [] }
const dry: RunOptions = { apply: false, overwrite: false, only: [] }

const isDraft = (id: string) => id.startsWith("drafts.")

const temp = new TempFolders()
afterEach(() => temp.cleanUp())

describe("the platform seed", () => {
  const seed = buildSeedContent(source()).docs
  const everything = (store: MemoryStore, options: RunOptions) => {
    const { docs, slots } = buildSeedContent(source())
    return run({ store, docs, slots, options })
  }

  it("writes every document as a draft in one transaction, and nothing else", async () => {
    const store = new MemoryStore()
    const result = await everything(store, apply)
    expect(result.seedCount).toBe(seed.length)
    expect(result.written).toBe(seed.length)
    expect(store.writes).toHaveLength(1)
    expect(store.writes[0]).toHaveLength(seed.length)
    expect(store.docs.size).toBe(seed.length)
    expect([...store.docs.keys()].every(isDraft)).toBe(true)
    expect(store.uploads).toEqual([])
    expect(result.orphans).toEqual([])
  })

  it("writes nothing for a dry run", async () => {
    const store = new MemoryStore()
    const result = await everything(store, dry)
    expect(result.mode).toBe("dry-run")
    expect(store.writes).toEqual([])
    expect(store.docs.size).toBe(0)
  })

  it("does nothing the second time", async () => {
    const store = new MemoryStore()
    await everything(store, apply)
    const again = await everything(store, apply)
    expect(again.written).toBe(0)
    expect(again.plan.every((item) => item.action === "unchanged" && item.changes.length === 0)).toBe(true)
    expect(store.writes).toHaveLength(1)
  })

  it("does nothing once the drafts were published in the Studio, and creates no draft", async () => {
    const store = new MemoryStore()
    await everything(store, apply)
    for (const doc of seed) store.publish(doc._id)
    const again = await everything(store, apply)
    expect(again.written).toBe(0)
    expect([...store.docs.keys()].some(isDraft)).toBe(false)
  })

  it("keeps what was edited in the Studio, and says so", async () => {
    const store = new MemoryStore()
    await everything(store, apply)
    store.edit("drafts.game-hanabi", (doc) => {
      doc.duration = 30
      doc.creators = []
    })
    const again = await everything(store, apply)
    expect(store.docs.get("drafts.game-hanabi")).toMatchObject({ duration: 30 })
    const diverged = again.plan.flatMap((item) => item.changes.filter((change) => change.kind === "diverged").map((change) => `${item.id} › ${change.path}`))
    expect(diverged).toEqual(["game-hanabi › duration"])
  })

  it("fills a gap left in a draft, and only that", async () => {
    const store = new MemoryStore()
    await everything(store, apply)
    store.edit("drafts.game-hanabi", (doc) => {
      delete doc.bggId
    })
    const again = await everything(store, apply)
    expect(again.plan.filter((item) => item.action !== "unchanged").map((item) => item.id)).toEqual(["game-hanabi"])
    expect(store.docs.get("drafts.game-hanabi")).toMatchObject({ bggId: 98778 })
  })

  it("reports a game made by hand in the Studio as in the dataset but not in the seed, and leaves it alone", async () => {
    const store = new MemoryStore()
    store.put({ _id: "drafts.game-made-by-hand", _type: "game", name: "Made by hand" })
    const result = await everything(store, apply)
    expect(result.orphans).toEqual(["game-made-by-hand"])
    expect(store.docs.get("drafts.game-made-by-hand")).toMatchObject({ name: "Made by hand" })
  })

  it("leaves the editorial documents alone: their types are not the seed's", async () => {
    const store = new MemoryStore()
    store.put({ _id: "drafts.an-article", _type: "article", title: "Hello" })
    const result = await everything(store, apply)
    expect(result.orphans).toEqual([])
  })

  describe("with its pictures", () => {
    it("uploads the files of an art folder and places them, a game's logo and a publisher's", async () => {
      const dir = await temp.create({
        "game-hanabi-logo.png": await imageOf("#cc0000"),
        "game-hanabi-background.png": await imageOf("#00aa00", { width: 80, height: 60 }),
        "publisher-cocktail-games-logo.png": await imageOf("#0000cc"),
      })
      const store = new MemoryStore()
      const result = await everything(store, { ...apply, artDir: dir })
      expect(result.art?.uploaded).toBe(3)
      expect(store.uploads).toHaveLength(3)
      const hanabi = store.docs.get("drafts.game-hanabi")
      expect(hanabi?.logo).toMatchObject({ _type: "image" })
      expect(hanabi?.background).toMatchObject({ _type: "image" })
      expect(store.docs.get("drafts.publisher-cocktail-games")?.logo).toMatchObject({ _type: "image" })
      expect(store.docs.get("drafts.game-the-mind")?.logo).toBeUndefined()
    })

    it("does nothing more the second time", async () => {
      const dir = await temp.create({ "game-hanabi-logo.png": await imageOf("#cc0000") })
      const store = new MemoryStore()
      await everything(store, { ...apply, artDir: dir })
      const again = await everything(store, { ...apply, artDir: dir })
      expect(again.written).toBe(0)
      expect(again.art?.uploaded).toBe(0)
    })

    it("says which pictures are still to come, and which files match no slot", async () => {
      const dir = await temp.create({ "game-hanabi-logo.png": await imageOf("#cc0000"), "game-hanabi-cover.png": await imageOf("#cc0000") })
      const result = await everything(new MemoryStore(), { ...dry, artDir: dir })
      expect(result.art?.slotCount).toBe(5)
      expect(result.art?.loaded.scan.missing).toHaveLength(4)
      expect(result.art?.loaded.scan.unmatched).toEqual(["game-hanabi-cover.png"])
    })
  })
})
