import { run } from "@pbgo/content-kit/seed"
import type { RunOptions } from "@pbgo/content-kit/seed"
import { MemoryStore, TempFolders, imageOf } from "@pbgo/content-kit/testing"
import { afterEach, describe, expect, it } from "vitest"
import { ART_SLOTS } from "./art-manifest.ts"
import { cardId } from "./cards.ts"
import { GAME_ID } from "./game.ts"
import { buildSeedDocs } from "./index.ts"
import { SETTINGS_ID } from "./settings.ts"

// The runner itself is tested in @pbgo/content-kit; these tests run the Skyjo seed and art slots through it.

const apply: RunOptions = { apply: true, overwrite: false, only: [] }
const dry: RunOptions = { apply: false, overwrite: false, only: [] }

const isDraft = (id: string) => id.startsWith("drafts.")

const temp = new TempFolders()
afterEach(() => temp.cleanUp())

describe("the Skyjo seed", () => {
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
    store.edit(`drafts.${cardId("12")}`, (doc) => {
      doc.quantity = 4
    })
    const again = await everything(store, apply)
    expect(again.written).toBe(0)
    expect(store.docs.get(`drafts.${cardId("12")}`)?.quantity).toBe(4)
  })

  describe("with art", () => {
    it("places each file by its slot name, aliases and the names of the card images the owner handed over, unknown files included", async () => {
      const dir = await temp.create({
        // the names of the 16 images (`skyjo-minus-2.svg`, `skyjo-7.svg`, `skyjo-back.svg`) fill the slots of their cards; case, `_` and the sign do not matter
        "skyjo-7.png": await imageOf("#e8c030", { width: 296, height: 476 }),
        "Skyjo_Minus_2.PNG": await imageOf("#1d2e7a", { width: 296, height: 476 }),
        "card-12.webp": await imageOf("#d8412f", { width: 296, height: 476 }, "webp"),
        "skyjo-back.jpg": await imageOf("#8844cc", { width: 296, height: 476 }, "jpeg"),
        "logo.png": await imageOf("#eeeeee", { width: 64, height: 64 }),
        "typo-card.png": await imageOf("#778899"),
        "notes.txt": "not an image",
      })
      const store = new MemoryStore()

      const result = await everything(store, { ...apply, artDir: dir })

      const draft = (id: string) => store.docs.get(`drafts.${id}`)
      const isImage = (value: unknown) => expect(value).toMatchObject({ _type: "image", asset: { _type: "reference" } })
      isImage(draft(cardId("7"))?.image)
      isImage(draft(cardId("minus-2"))?.image)
      isImage(draft(cardId("12"))?.image)
      isImage(draft(GAME_ID)?.cardBack)
      isImage(draft(SETTINGS_ID)?.logo)

      expect(result.art?.uploaded).toBe(5)
      expect(store.uploads).toHaveLength(5)
      expect(result.art?.loaded.scan.unmatched).toEqual(["typo-card.png"])
      expect(result.art?.loaded.scan.missing).toHaveLength(ART_SLOTS.length - 5)
      // Unfilled slots leave the documents without an image: nothing is invented
      expect(draft(cardId("8"))?.image).toBeUndefined()
    })

    it("warns about a card that is not in the proportions of the others, and still places it", async () => {
      const dir = await temp.create({ "card-7.png": await imageOf("#d8412f", { width: 100, height: 100 }) })
      const result = await everything(new MemoryStore(), { ...dry, artDir: dir })
      expect(result.art?.loaded.images[0]?.warnings).toEqual(["card-7.png is 100×100, expected 296:476"])
    })

    it("refuses two files for one slot: `7.png` next to `card-7.png`", async () => {
      const dir = await temp.create({
        "7.png": await imageOf("#d8412f", { width: 296, height: 476 }),
        "card-7.png": await imageOf("#f2c230", { width: 296, height: 476 }),
      })
      await expect(everything(new MemoryStore(), { ...dry, artDir: dir })).rejects.toThrow()
    })
  })
})
