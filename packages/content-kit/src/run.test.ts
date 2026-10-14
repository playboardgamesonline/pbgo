import { join } from "node:path"
import { afterEach, describe, expect, it } from "vitest"
import type { ArtSlot } from "./art.ts"
import { MemoryStore } from "./memory-store.ts"
import { run } from "./run.ts"
import type { RunOptions } from "./run.ts"
import { TempFolders, imageOf } from "./test-fixtures.ts"
import type { DraftOp, SeedDoc } from "./types.ts"

const dry: RunOptions = { apply: false, overwrite: false, only: [] }
const apply: RunOptions = { apply: true, overwrite: false, only: [] }

const thing = (id: string, extra: Record<string, unknown> = {}): SeedDoc => ({
  _id: id,
  _type: "thing",
  title: `Title ${id}`,
  items: [{ _key: "one", _type: "item", label: "One" }],
  ...extra,
})

/** Two documents of a type and one of another */
const docs = (): SeedDoc[] => [thing("a"), thing("b"), { _id: "c", _type: "other", name: { fr: "C", en: "C" } }]

const go = (store: MemoryStore, options: RunOptions, seed: SeedDoc[] = docs(), slots: ArtSlot[] = []) => run({ store, docs: seed, slots, options })

const idsOf = (store: MemoryStore) => [...store.docs.keys()].sort()
const isDraft = (id: string) => id.startsWith("drafts.")

const temp = new TempFolders()
afterEach(() => temp.cleanUp())

describe("a dry run", () => {
  it("plans and reports, and writes nothing", async () => {
    const store = new MemoryStore()
    const result = await go(store, dry)
    expect(result.mode).toBe("dry-run")
    expect(result.seedCount).toBe(3)
    expect(result.plan.map((item) => item.action)).toEqual(["create", "create", "create"])
    expect(result.written).toBe(0)
    expect(result.art).toBeUndefined()
    expect(store.writes).toEqual([])
    expect(store.uploads).toEqual([])
    expect(store.docs.size).toBe(0)
  })

  it("shows what an apply would do to existing drafts without touching them", async () => {
    const store = new MemoryStore()
    store.put({ _id: "drafts.a", _type: "thing", title: "Title a" })
    const before = structuredClone(store.docs.get("drafts.a"))
    const result = await go(store, dry)
    expect(result.plan.map((item) => [item.id, item.action])).toEqual([
      ["a", "update"],
      ["b", "create"],
      ["c", "create"],
    ])
    expect(store.docs.get("drafts.a")).toEqual(before)
    expect(store.writes).toEqual([])
  })
})

describe("apply", () => {
  it("writes every document as a draft, in one transaction", async () => {
    const store = new MemoryStore()
    const result = await go(store, apply)
    expect(result.mode).toBe("apply")
    expect(result.written).toBe(3)
    expect(store.writes).toHaveLength(1)
    expect(store.writes[0]).toHaveLength(3)
    expect(idsOf(store)).toEqual(["drafts.a", "drafts.b", "drafts.c"])
  })

  it("writes the seed's content, not a copy of the plan's bookkeeping", async () => {
    const store = new MemoryStore()
    await go(store, apply)
    expect(store.docs.get("drafts.a")).toMatchObject({ _id: "drafts.a", _type: "thing", title: "Title a", items: [{ _key: "one", label: "One" }] })
    expect(store.docs.get("drafts.c")).toMatchObject({ _type: "other", name: { fr: "C", en: "C" } })
  })

  it("does nothing the second time", async () => {
    const store = new MemoryStore()
    await go(store, apply)
    const again = await go(store, apply)
    expect(again.written).toBe(0)
    expect(again.plan.every((item) => item.action === "unchanged")).toBe(true)
    expect(store.writes).toHaveLength(1)
  })

  it("adds a document the seed gained since the last run, and only that one", async () => {
    const store = new MemoryStore()
    await go(store, apply)
    const result = await go(store, apply, [...docs(), thing("d")])
    expect(result.written).toBe(1)
    expect(result.plan.filter((item) => item.action !== "unchanged").map((item) => item.id)).toEqual(["d"])
    expect(idsOf(store)).toEqual(["drafts.a", "drafts.b", "drafts.c", "drafts.d"])
  })

  it("never writes a published id", async () => {
    const store = new MemoryStore()
    await go(store, apply)
    store.publish("a")
    store.edit("a", (doc) => {
      delete doc.items
    })
    await go(store, apply)
    expect(store.writes.flat().every((op) => isDraft(op.type === "createIfNotExists" ? op.doc._id : op.id))).toBe(true)
  })

  it("does not modify the seed it is given", async () => {
    const seed = docs()
    const copy = structuredClone(seed)
    await go(new MemoryStore(), apply, seed)
    expect(seed).toEqual(copy)
  })
})

describe("what is already in the dataset", () => {
  it("never touches a published document: a draft is made from it when there is something to add", async () => {
    const store = new MemoryStore()
    store.put(thing("a", { title: "Published title" }))
    store.put({ _id: "b", _type: "thing", title: "Title b" })
    const before = [structuredClone(store.docs.get("a")), structuredClone(store.docs.get("b"))]

    const result = await go(store, apply)

    expect([store.docs.get("a"), store.docs.get("b")]).toEqual(before)
    expect(store.docs.has("drafts.a")).toBe(false)
    expect(store.docs.get("drafts.b")).toMatchObject({ title: "Title b", items: [{ _key: "one", label: "One" }] })
    expect(result.plan.map((item) => [item.id, item.action])).toEqual([
      ["a", "unchanged"],
      ["b", "create-from-published"],
      ["c", "create"],
    ])
  })

  it("keeps what was edited in the Studio and says so", async () => {
    const store = new MemoryStore()
    await go(store, apply)
    store.edit("drafts.a", (doc) => {
      doc.title = "Edited in the Studio"
    })
    const result = await go(store, apply)
    expect(result.written).toBe(0)
    expect(store.docs.get("drafts.a")?.title).toBe("Edited in the Studio")
    const item = result.plan.find((entry) => entry.id === "a")
    expect(item?.action).toBe("unchanged")
    expect(item?.changes).toEqual([{ kind: "diverged", path: "title", seed: "Title a", current: "Edited in the Studio" }])
  })

  it("fills a gap and leaves the rest of the draft alone", async () => {
    const store = new MemoryStore()
    await go(store, apply)
    store.edit("drafts.a", (doc) => {
      delete doc.items
      doc.title = "Mine"
      doc.extra = "only in Sanity"
    })
    const result = await go(store, apply)
    expect(result.written).toBe(1)
    expect(store.docs.get("drafts.a")).toMatchObject({ title: "Mine", extra: "only in Sanity", items: [{ _key: "one", label: "One" }] })
    expect(store.writes.at(-1)).toEqual([expect.objectContaining({ type: "patch", id: "drafts.a", set: { items: [{ _key: "one", _type: "item", label: "One" }] } })])
  })

  it("leaves alone the documents of the seed's types that it does not hold, and reports them", async () => {
    const store = new MemoryStore()
    store.put({ _id: "z", _type: "thing", title: "Published, not in the seed" })
    store.put({ _id: "drafts.y", _type: "thing", title: "Draft only, not in the seed" })
    store.put({ _id: "w", _type: "unmanaged", title: "Another type, not looked at" })
    const result = await go(store, apply)
    expect(result.orphans).toEqual(["y", "z"])
    expect(store.docs.has("z")).toBe(true)
    expect(store.docs.has("drafts.y")).toBe(true)
    expect(store.docs.has("w")).toBe(true)
  })

  it("does not call a seed document an orphan", async () => {
    const store = new MemoryStore()
    await go(store, apply)
    expect((await go(store, dry)).orphans).toEqual([])
  })
})

describe("--only", () => {
  it("limits the run to a document id", async () => {
    const store = new MemoryStore()
    const result = await go(store, { ...apply, only: ["b"] })
    expect(result.plan.map((item) => item.id)).toEqual(["b"])
    expect(result.seedCount).toBe(3)
    expect(idsOf(store)).toEqual(["drafts.b"])
  })

  it("limits the run to a type", async () => {
    const store = new MemoryStore()
    const result = await go(store, { ...apply, only: ["thing"] })
    expect(result.plan.map((item) => item.id)).toEqual(["a", "b"])
    expect(idsOf(store)).toEqual(["drafts.a", "drafts.b"])
  })

  it("takes ids and types together", async () => {
    const store = new MemoryStore()
    const result = await go(store, { ...apply, only: ["a", "other"] })
    expect(result.plan.map((item) => item.id)).toEqual(["a", "c"])
  })

  it("still looks for orphans in the whole seed", async () => {
    const store = new MemoryStore()
    store.put({ _id: "z", _type: "other", name: "Not in the seed" })
    const result = await go(store, { ...dry, only: ["a"] })
    expect(result.orphans).toEqual(["z"])
  })

  it("refuses a name that matches nothing, and lists what would match", async () => {
    const store = new MemoryStore()
    await expect(go(store, { ...apply, only: ["a", "nope", "zzz"] })).rejects.toThrow("--only matches nothing: nope, zzz (a document id or one of the types: thing, other)")
    expect(store.writes).toEqual([])
  })
})

describe("--overwrite --only", () => {
  const edited = async () => {
    const store = new MemoryStore()
    await go(store, apply)
    store.edit("drafts.a", (doc) => {
      doc.title = "Edited a"
    })
    store.edit("drafts.b", (doc) => {
      doc.title = "Edited b"
    })
    return store
  }

  it("replaces what differs in the documents it is limited to, and only there", async () => {
    const store = await edited()
    const result = await go(store, { apply: true, overwrite: true, only: ["a"] })
    expect(store.docs.get("drafts.a")?.title).toBe("Title a")
    expect(store.docs.get("drafts.b")?.title).toBe("Edited b")
    expect(result.written).toBe(1)
    expect(result.plan.map((item) => item.id)).toEqual(["a"])
    expect(result.plan[0]?.changes).toEqual([{ kind: "overwrite", path: "title", seed: "Title a", current: "Edited a" }])
  })

  it("accepts a type", async () => {
    const store = await edited()
    await go(store, { apply: true, overwrite: true, only: ["thing"] })
    expect(store.docs.get("drafts.a")?.title).toBe("Title a")
    expect(store.docs.get("drafts.b")?.title).toBe("Title b")
  })

  it("only announces the replacement in a dry run", async () => {
    const store = await edited()
    const writes = store.writes.length
    const result = await go(store, { apply: false, overwrite: true, only: ["a"] })
    expect(result.plan[0]?.action).toBe("update")
    expect(store.writes).toHaveLength(writes)
    expect(store.docs.get("drafts.a")?.title).toBe("Edited a")
  })

  it("is refused without --only", async () => {
    const store = new MemoryStore()
    await expect(go(store, { apply: true, overwrite: true, only: [] })).rejects.toThrow("--overwrite replaces what was edited in the Studio: say which documents with --only")
    expect(store.docs.size).toBe(0)
  })
})

describe("a seed that is wrong", () => {
  it("is refused before anything is read or written", async () => {
    const store = new MemoryStore()
    await expect(go(store, apply, [thing("drafts.a")])).rejects.toThrow('Invalid seed document id "drafts.a"')
    await expect(go(store, apply, [thing("a"), { ...thing("b"), _type: "" }])).rejects.toThrow('Seed document "b" has no _type')
    await expect(go(store, apply, [thing("a"), thing("a")])).rejects.toThrow('Seed document id "a" is used twice')
    expect(store.writes).toEqual([])
    expect(store.docs.size).toBe(0)
  })

  it("is refused when an art slot points at a document that is not in the seed", async () => {
    const slot: ArtSlot = { name: "lost", label: "Lost", maxSize: 64, docId: "missing", place: () => {} }
    await expect(go(new MemoryStore(), dry, docs(), [slot])).rejects.toThrow('Art slot "lost" points at "missing", which is not in the seed')
  })

  it("is refused when the dataset holds another type under the same id", async () => {
    const store = new MemoryStore()
    store.put({ _id: "drafts.a", _type: "other", name: "Not a thing" })
    await expect(go(store, apply)).rejects.toThrow('"drafts.a" is a "other" in the dataset but the seed expects a "thing"')
    expect(store.writes).toEqual([])
  })
})

describe("when the write does not go as planned", () => {
  it("fails if planning again after the write still finds work to do", async () => {
    // A dataset that accepts the writes and keeps nothing
    class LossyStore extends MemoryStore {
      override async writeDrafts(ops: DraftOp[]) {
        this.writes.push(structuredClone(ops))
      }
    }
    await expect(go(new LossyStore(), apply)).rejects.toThrow(
      "Idempotency check failed: planning again after the write still finds work to do (a: create, b: create, c: create)",
    )
  })

  it("writes nothing at all if the Studio saved a draft between the plan and the write", async () => {
    class RacyStore extends MemoryStore {
      override async writeDrafts(ops: DraftOp[]) {
        this.edit("drafts.a", (doc) => {
          doc.title = "Edited meanwhile"
        })
        await super.writeDrafts(ops)
      }
    }
    const store = new RacyStore()
    store.put({ _id: "drafts.a", _type: "thing", title: "Title a" })
    await expect(go(store, apply)).rejects.toThrow("Revision mismatch on drafts.a")
    expect(store.docs.has("drafts.b")).toBe(false)
    expect(store.docs.has("drafts.c")).toBe(false)
    expect(store.docs.get("drafts.a")?.title).toBe("Edited meanwhile")
  })
})

describe("art", () => {
  const slot: ArtSlot = {
    name: "a-pic",
    label: "Picture of a",
    ratio: [5, 7],
    maxSize: 64,
    docId: "a",
    place: (doc, image) => {
      doc.picture = image
    },
  }

  const picture = (store: MemoryStore, id = "drafts.a") => store.docs.get(id)?.picture as { _type: string; asset: { _ref: string } } | undefined

  it("is left alone without an art folder, even when slots exist", async () => {
    const store = new MemoryStore()
    const result = await go(store, apply, docs(), [slot])
    expect(result.art).toBeUndefined()
    expect(store.uploads).toEqual([])
    expect(picture(store)).toBeUndefined()
  })

  it("is read and planned in a dry run, and uploaded nowhere", async () => {
    const dir = await temp.create({ "a-pic.png": await imageOf("#cc2200") })
    const store = new MemoryStore()
    const result = await go(store, { ...dry, artDir: dir }, docs(), [slot])
    expect(store.uploads).toEqual([])
    expect(store.docs.size).toBe(0)
    expect(result.art).toMatchObject({ dir, slotCount: 1, uploaded: 0 })
    expect(result.art?.loaded.images).toHaveLength(1)
    const planned = result.plan.find((item) => item.id === "a")?.doc?.picture
    expect(planned).toMatchObject({ _type: "image", asset: { _type: "reference", _ref: expect.stringMatching(/^image-[0-9a-f]{40}-40x56-webp$/) } })
  })

  it("is uploaded once on apply and placed in the draft", async () => {
    const dir = await temp.create({ "a-pic.png": await imageOf("#cc2200") })
    const store = new MemoryStore()
    const result = await go(store, { ...apply, artDir: dir }, docs(), [slot])
    expect(result.art?.uploaded).toBe(1)
    expect(store.uploads).toHaveLength(1)
    expect(store.uploads[0]).toMatchObject({ filename: "a-pic.webp", contentType: "image/webp" })
    const [assetId] = [...store.assets.values()]
    expect(picture(store)).toEqual({ _type: "image", asset: { _type: "reference", _ref: assetId } })
  })

  it("is not uploaded again, nor written again, on the next run", async () => {
    const dir = await temp.create({ "a-pic.png": await imageOf("#cc2200") })
    const store = new MemoryStore()
    await go(store, { ...apply, artDir: dir }, docs(), [slot])
    const again = await go(store, { ...apply, artDir: dir }, docs(), [slot])
    expect(again.art?.uploaded).toBe(0)
    expect(again.written).toBe(0)
    expect(store.uploads).toHaveLength(1)
  })

  it("uploads an image used by two slots once", async () => {
    const same = await imageOf("#cc2200")
    const dir = await temp.create({ "a-pic.png": same, "b-pic.png": same })
    const other: ArtSlot = { ...slot, name: "b-pic", docId: "b" }
    const store = new MemoryStore()
    const result = await go(store, { ...apply, artDir: dir }, docs(), [slot, other])
    expect(result.art?.uploaded).toBe(1)
    expect(store.uploads).toHaveLength(1)
    expect(picture(store)?.asset._ref).toBe(picture(store, "drafts.b")?.asset._ref)
  })

  it("does not replace an image already placed unless asked to, and then only in the selected document", async () => {
    const dir = await temp.create({ "a-pic.png": await imageOf("#cc2200") })
    const store = new MemoryStore()
    await go(store, { ...apply, artDir: dir }, docs(), [slot])
    const first = picture(store)?.asset._ref

    await temp.create()
    const next = await temp.create({ "a-pic.png": await imageOf("#0022cc") })
    const kept = await go(store, { ...apply, artDir: next }, docs(), [slot])
    expect(kept.written).toBe(0)
    expect(picture(store)?.asset._ref).toBe(first)
    expect(kept.plan.find((item) => item.id === "a")?.changes).toEqual([expect.objectContaining({ kind: "diverged", path: "picture.asset._ref", current: first })])

    await go(store, { apply: true, overwrite: true, only: ["a"], artDir: next }, docs(), [slot])
    expect(picture(store)?.asset._ref).not.toBe(first)
  })

  it("is limited to the selected documents by --only", async () => {
    const dir = await temp.create({ "a-pic.png": await imageOf("#cc2200") })
    const store = new MemoryStore()
    const result = await go(store, { ...apply, only: ["b"], artDir: dir }, docs(), [slot])
    expect(result.art?.loaded.images).toEqual([])
    expect(store.uploads).toEqual([])
  })

  it("stops the run when the art folder does not exist", async () => {
    const dir = join(await temp.create(), "nope")
    await expect(go(new MemoryStore(), { ...dry, artDir: dir }, docs(), [slot])).rejects.toThrow(`Art folder not found: ${dir}`)
  })

  it("stops the run on a file that is not an image, naming the file", async () => {
    const dir = await temp.create({ "a-pic.png": "this is not a PNG" })
    const store = new MemoryStore()
    await expect(go(store, { ...apply, artDir: dir }, docs(), [slot])).rejects.toThrow(/^a-pic\.png: /)
    expect(store.writes).toEqual([])
    expect(store.uploads).toEqual([])
  })

  it("does not modify the seed it is given", async () => {
    const dir = await temp.create({ "a-pic.png": await imageOf("#cc2200") })
    const seed = docs()
    const copy = structuredClone(seed)
    await go(new MemoryStore(), { ...apply, artDir: dir }, seed, [slot])
    expect(seed).toEqual(copy)
  })
})
