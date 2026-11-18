import { run } from "@pbgo/content-kit/seed"
import type { RunOptions } from "@pbgo/content-kit/seed"
import { MemoryStore, TempFolders, imageOf } from "@pbgo/content-kit/testing"
import { afterEach, describe, expect, it } from "vitest"
import { ART_SLOTS } from "./art-manifest.ts"
import { characterId } from "./characters.ts"
import { GAME_ID } from "./game.ts"
import { buildSeedDocs } from "./index.ts"
import { SETTINGS_ID } from "./settings.ts"

// The runner itself is tested in @pbgo/content-kit; these tests run the Love Letter seed and art slots through it.

const apply: RunOptions = { apply: true, overwrite: false, only: [] }
const dry: RunOptions = { apply: false, overwrite: false, only: [] }

const isDraft = (id: string) => id.startsWith("drafts.")

/** A face of the owner's art is 760 by 1060. */
const FACE = { width: 760, height: 1060 }

const temp = new TempFolders()
afterEach(() => temp.cleanUp())

describe("the Love Letter seed", () => {
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
    store.edit(SETTINGS_ID, (doc) => {
      delete doc.publisher
    })
    const published = structuredClone(store.docs.get(SETTINGS_ID))

    const result = await everything(store, apply)

    expect(result.plan.filter((item) => item.action !== "unchanged").map((item) => [item.id, item.action])).toEqual([[SETTINGS_ID, "create-from-published"]])
    expect(store.docs.get(SETTINGS_ID)).toEqual(published)
    expect(store.docs.get(`drafts.${SETTINGS_ID}`)?.publisher).toEqual(seed.find((doc) => doc._id === SETTINGS_ID)?.publisher)
  })

  it("never replaces what an editor typed in the Studio", async () => {
    const store = new MemoryStore()
    await everything(store, apply)
    store.edit(`drafts.${characterId("princess")}`, (doc) => {
      doc.quantity = 3
    })
    const again = await everything(store, apply)
    expect(again.written).toBe(0)
    expect(store.docs.get(`drafts.${characterId("princess")}`)?.quantity).toBe(3)
  })

  it("keeps a language an editor adds later: the Spanish name, which the seed leaves empty, survives a new run", async () => {
    const store = new MemoryStore()
    await everything(store, apply)
    store.edit(`drafts.${characterId("spy")}`, (doc) => {
      ;(doc.name as Record<string, unknown>).es = "(typed in the Studio)"
    })
    const again = await everything(store, apply)
    expect(again.written).toBe(0)
    expect(store.docs.get(`drafts.${characterId("spy")}`)?.name).toEqual({ _type: "localeString", fr: "Espionne", en: "Spy", es: "(typed in the Studio)" })
  })

  describe("with art", () => {
    it("places each file by its slot, aliases and the names of the owner's files, unknown files and the 3D model apart", async () => {
      const dir = await temp.create({
        // the names of the owner's files (`CARD_SPY.png`, `CARD_BACK.png`, `LOGO_LOVE_LETTER.png`) fill the slots of their pictures as they are; case and `_` do not matter
        "CARD_SPY.png": await imageOf("#e8c030", FACE),
        "Card_Guard.PNG": await imageOf("#1d2e7a", FACE),
        "princess.webp": await imageOf("#d8412f", FACE, "webp"),
        "CARD_BACK.png": await imageOf("#8c2a3a", FACE),
        "LOGO_LOVE_LETTER.png": await imageOf("#eeeeee", { width: 64, height: 64 }),
        "typo-card.png": await imageOf("#778899"),
        // a 3D model is a file, not an image: the seed does not place it, and does not even list it
        "FAVOR_TOKEN.glb": "not an image",
        "notes.txt": "not an image",
      })
      const store = new MemoryStore()

      const result = await everything(store, { ...apply, artDir: dir })

      const draft = (id: string) => store.docs.get(`drafts.${id}`)
      const isImage = (value: unknown) => expect(value).toMatchObject({ _type: "image", asset: { _type: "reference" } })
      isImage(draft(characterId("spy"))?.image)
      isImage(draft(characterId("guard"))?.image)
      isImage(draft(characterId("princess"))?.image)
      isImage(draft(GAME_ID)?.cardBack)
      isImage(draft(SETTINGS_ID)?.logo)

      expect(result.art?.uploaded).toBe(5)
      expect(store.uploads).toHaveLength(5)
      expect(result.art?.loaded.scan.unmatched).toEqual(["typo-card.png"])
      expect(result.art?.loaded.scan.missing).toHaveLength(ART_SLOTS.length - 5)
      // Unfilled slots leave the documents without an image: nothing is invented
      expect(draft(characterId("king"))?.image).toBeUndefined()
      expect(draft(GAME_ID)?.mat).toBeUndefined()
      expect(draft(GAME_ID)?.favorTokenModel).toBeUndefined()
    })

    it("warns about a face that is not in the proportions of the owner's pictures, and still places it", async () => {
      const dir = await temp.create({ "card-spy.png": await imageOf("#d8412f", { width: 100, height: 100 }) })
      const result = await everything(new MemoryStore(), { ...dry, artDir: dir })
      expect(result.art?.loaded.images[0]?.warnings).toEqual(["card-spy.png is 100×100, expected 760:1060"])
    })

    it("accepts the owner's proportions without a warning, 760 by 1060", async () => {
      const dir = await temp.create({ "CARD_SPY.png": await imageOf("#d8412f", FACE) })
      const result = await everything(new MemoryStore(), { ...dry, artDir: dir })
      expect(result.art?.loaded.images[0]?.warnings).toEqual([])
    })

    it("refuses two files for one slot: `spy.png` next to `card-spy.png`", async () => {
      const dir = await temp.create({
        "spy.png": await imageOf("#d8412f", FACE),
        "card-spy.png": await imageOf("#f2c230", FACE),
      })
      await expect(everything(new MemoryStore(), { ...dry, artDir: dir })).rejects.toThrow()
    })
  })
})
