import { run } from "@pbgo/content-kit/seed"
import type { RunOptions } from "@pbgo/content-kit/seed"
import { MemoryStore, TempFolders, imageOf } from "@pbgo/content-kit/testing"
import { afterEach, describe, expect, it } from "vitest"
import { ART_SLOTS } from "./art-manifest.ts"
import { cardId } from "./cards.ts"
import { GAME_ID } from "./game.ts"
import { buildSeedDocs } from "./index.ts"
import { suitId } from "./suits.ts"

// The runner itself is tested in @pbgo/content-kit; these tests run Hanabi's own seed and art slots through it.

const apply: RunOptions = { apply: true, overwrite: false, only: [] }
const dry: RunOptions = { apply: false, overwrite: false, only: [] }

const isDraft = (id: string) => id.startsWith("drafts.")

const temp = new TempFolders()
afterEach(() => temp.cleanUp())

describe("the Hanabi seed", () => {
  const seed = buildSeedDocs()
  const everything = (store: MemoryStore, options: RunOptions) => run({ store, docs: buildSeedDocs(), slots: ART_SLOTS, options })

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
    expect(again.plan.every((item) => item.action === "unchanged")).toBe(true)
    expect([...store.docs.keys()].some(isDraft)).toBe(false)
  })

  it("makes a draft from a published document that lost a field, and leaves the published one as it is", async () => {
    const store = new MemoryStore()
    await everything(store, apply)
    for (const doc of seed) store.publish(doc._id)
    const id = suitId("red")
    store.edit(id, (doc) => {
      delete doc.name
    })
    const published = structuredClone(store.docs.get(id))

    const result = await everything(store, apply)

    expect(result.plan.filter((item) => item.action !== "unchanged").map((item) => [item.id, item.action])).toEqual([[id, "create-from-published"]])
    expect(store.docs.get(id)).toEqual(published)
    expect(store.docs.get(`drafts.${id}`)?.name).toEqual(seed.find((doc) => doc._id === id)?.name)
  })

  describe("with art", () => {
    it("places each file by its slot name, aliases and unknown files included", async () => {
      const dir = await temp.create({
        [`${cardId("red", 3)}.png`]: await imageOf("#d8412f", { width: 50, height: 70 }),
        "suit-rainbow.png": await imageOf("#8e5bd9", { width: 64, height: 64 }),
        "card-back.jpg": await imageOf("#222222", { width: 50, height: 70 }, "jpeg"),
        "value-4.png": await imageOf("#eeeeee", { width: 32, height: 32 }),
        "rating-legendary.png": await imageOf("#f2c230", { width: 48, height: 48 }),
        "card-rainbow-1.png": await imageOf("#445566", { width: 50, height: 70 }),
        "typo-card.png": await imageOf("#778899"),
        "notes.txt": "not an image",
      })
      const store = new MemoryStore()

      const result = await everything(store, { ...apply, artDir: dir })

      const draft = (id: string) => store.docs.get(`drafts.${id}`)
      const isImage = (value: unknown) => expect(value).toMatchObject({ _type: "image", asset: { _type: "reference" } })
      isImage(draft(cardId("red", 3))?.card)
      isImage(draft(cardId("multi", 1))?.card)
      isImage(draft(suitId("multi"))?.symbolImage)
      isImage(draft(GAME_ID)?.cardBack)
      isImage((draft(GAME_ID)?.valueGlyphs as { _key: string; glyph?: unknown }[]).find((item) => item._key === "v4")?.glyph)
      isImage((draft(GAME_ID)?.scoreScale as { _key: string; badge?: unknown }[]).find((item) => item._key === "legendary")?.badge)

      expect(result.art?.uploaded).toBe(6)
      expect(store.uploads).toHaveLength(6)
      expect(result.art?.loaded.scan.unmatched).toEqual(["typo-card.png"])
      expect(result.art?.loaded.scan.missing).toHaveLength(ART_SLOTS.length - 6)
      // Unfilled slots leave the documents without an image: nothing is invented
      expect(draft(cardId("red", 4))?.card).toBeUndefined()
    })

    it("warns about a card that is not in the proportions of the others, and still places it", async () => {
      const dir = await temp.create({ "card-red-3.png": await imageOf("#d8412f", { width: 100, height: 100 }) })
      const result = await everything(new MemoryStore(), { ...dry, artDir: dir })
      expect(result.art?.loaded.images[0]?.warnings).toEqual(["card-red-3.png is 100×100, expected 5:7"])
    })
  })
})
