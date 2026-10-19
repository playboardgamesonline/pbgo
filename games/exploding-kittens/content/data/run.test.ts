import { run } from "@pbgo/content-kit/seed"
import type { RunOptions } from "@pbgo/content-kit/seed"
import { MemoryStore, TempFolders, imageOf } from "@pbgo/content-kit/testing"
import { afterEach, describe, expect, it } from "vitest"
import { ART_SLOTS } from "./art-manifest.ts"
import { cardTypeId, illustrationKey } from "./card-types.ts"
import { EDITION_ORIGINAL_ID } from "./edition.ts"
import { GAME_ID } from "./game.ts"
import { buildSeedDocs } from "./index.ts"
import { SETTINGS_ID } from "./settings.ts"

// The runner itself is tested in @pbgo/content-kit; these tests run the Exploding Kittens seed and art slots through it.

const apply: RunOptions = { apply: true, overwrite: false, only: [] }
const dry: RunOptions = { apply: false, overwrite: false, only: [] }

const isDraft = (id: string) => id.startsWith("drafts.")

const temp = new TempFolders()
afterEach(() => temp.cleanUp())

describe("the Exploding Kittens seed", () => {
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
    store.edit(EDITION_ORIGINAL_ID, (doc) => {
      delete doc.name
    })
    const published = structuredClone(store.docs.get(EDITION_ORIGINAL_ID))

    const result = await everything(store, apply)

    expect(result.plan.filter((item) => item.action !== "unchanged").map((item) => [item.id, item.action])).toEqual([[EDITION_ORIGINAL_ID, "create-from-published"]])
    expect(store.docs.get(EDITION_ORIGINAL_ID)).toEqual(published)
    expect(store.docs.get(`drafts.${EDITION_ORIGINAL_ID}`)?.name).toEqual(seed.find((doc) => doc._id === EDITION_ORIGINAL_ID)?.name)
  })

  describe("with art", () => {
    it("places each file by its slot name, aliases, spec names and unknown files included", async () => {
      const dir = await temp.create({
        // the names of the rules spec fill the same slots: case and `_` do not matter
        "DEFUSE_3.png": await imageOf("#d8412f", { width: 50, height: 70 }),
        "tacocat.png": await imageOf("#f2c230", { width: 50, height: 70 }),
        "rainbow-ralphing-cat-1.png": await imageOf("#8e5bd9", { width: 50, height: 70 }),
        "card-back.jpg": await imageOf("#222222", { width: 50, height: 70 }, "jpeg"),
        "logo.png": await imageOf("#eeeeee", { width: 64, height: 64 }),
        "typo-card.png": await imageOf("#778899"),
        "notes.txt": "not an image",
      })
      const store = new MemoryStore()

      const result = await everything(store, { ...apply, artDir: dir })

      const draft = (id: string) => store.docs.get(`drafts.${id}`)
      const isImage = (value: unknown) => expect(value).toMatchObject({ _type: "image", asset: { _type: "reference" } })
      const illustration = (key: Parameters<typeof cardTypeId>[0], number: number) =>
        (draft(cardTypeId(key))?.illustrations as { _key: string; image?: unknown }[]).find((item) => item._key === illustrationKey(number))
      isImage(illustration("defuse", 3)?.image)
      isImage(illustration("tacocat", 1)?.image)
      isImage(illustration("rainbow-ralphing-cat", 1)?.image)
      isImage(draft(GAME_ID)?.cardBack)
      isImage(draft(SETTINGS_ID)?.logo)

      expect(result.art?.uploaded).toBe(5)
      expect(store.uploads).toHaveLength(5)
      expect(result.art?.loaded.scan.unmatched).toEqual(["typo-card.png"])
      expect(result.art?.loaded.scan.missing).toHaveLength(ART_SLOTS.length - 5)
      // Unfilled slots leave the documents without an image: nothing is invented
      expect(illustration("defuse", 4)).toEqual({ _key: illustrationKey(4), _type: "illustration", number: 4 })
      expect(draft(GAME_ID)?.boxFront).toBeUndefined()
    })

    it("warns about a card that is not in the proportions of the others, and still places it", async () => {
      const dir = await temp.create({ "defuse-1.png": await imageOf("#d8412f", { width: 100, height: 100 }) })
      const result = await everything(new MemoryStore(), { ...dry, artDir: dir })
      expect(result.art?.loaded.images[0]?.warnings).toEqual(["defuse-1.png is 100×100, expected 5:7"])
    })
  })
})
