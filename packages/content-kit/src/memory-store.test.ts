import { createHash } from "node:crypto"
import { describe, expect, it } from "vitest"
import { MemoryStore } from "./memory-store.ts"
import { imageOf } from "./test-fixtures.ts"
import type { DraftOp, SeedDoc } from "./types.ts"

// The in-memory dataset stands in for Sanity in the other tests. It has to refuse what the real adapter refuses:
// a double that let a bad write through would make every test that relies on it too kind.

const doc = (id: string, extra: Record<string, unknown> = {}): SeedDoc => ({ _id: id, _type: "thing", title: id, ...extra })
const create = (id: string, extra: Record<string, unknown> = {}): DraftOp => ({ type: "createIfNotExists", doc: doc(id, extra) })
const patch = (id: string, ifRevisionID: string, set: Record<string, unknown>): DraftOp => ({ type: "patch", id, ifRevisionID, set })
const sha1Of = (data: Buffer) => createHash("sha1").update(data).digest("hex")

const revOf = (store: MemoryStore, id: string) => {
  const rev = store.docs.get(id)?._rev
  if (!rev) throw new Error(`No revision for ${id}`)
  return rev
}

describe("writeDrafts", () => {
  it("creates a draft that does not exist yet", async () => {
    const store = new MemoryStore()
    await store.writeDrafts([create("drafts.a", { n: 1 })])
    expect(store.docs.get("drafts.a")).toMatchObject({ _id: "drafts.a", _type: "thing", title: "drafts.a", n: 1 })
    expect(revOf(store, "drafts.a")).toEqual(expect.any(String))
  })

  it("never replaces a draft that exists", async () => {
    const store = new MemoryStore()
    store.put(doc("drafts.a", { title: "edited in the Studio" }))
    const rev = revOf(store, "drafts.a")
    await store.writeDrafts([create("drafts.a", { title: "from the seed" })])
    expect(store.docs.get("drafts.a")).toMatchObject({ title: "edited in the Studio" })
    expect(revOf(store, "drafts.a")).toBe(rev)
  })

  it.each([
    ["a published id", "a", "only drafts may be written"],
    ["a release version id", "versions.release.a", "only drafts may be written"],
    ["a draft with a dotted id", "drafts.a.b", "Invalid seed document id"],
    ["a draft without an id", "drafts.", "Invalid seed document id"],
  ])("refuses to create %s, and writes nothing", async (_name, id, message) => {
    const store = new MemoryStore()
    await expect(store.writeDrafts([create(id)])).rejects.toThrow(message)
    expect(store.docs.size).toBe(0)
  })

  it("refuses to patch a published document, even with the right revision", async () => {
    const store = new MemoryStore()
    store.put(doc("a", { title: "published" }))
    const before = structuredClone(store.docs.get("a"))
    await expect(store.writeDrafts([patch("a", revOf(store, "a"), { title: "changed" })])).rejects.toThrow("only drafts may be written")
    expect(store.docs.get("a")).toEqual(before)
  })

  it("is all or nothing: one document that is not a draft keeps the others from being written", async () => {
    const store = new MemoryStore()
    await expect(store.writeDrafts([create("drafts.a"), create("b")])).rejects.toThrow("only drafts may be written")
    expect(store.docs.size).toBe(0)
  })

  it("is all or nothing: a patch on a stale revision keeps the others from being written", async () => {
    const store = new MemoryStore()
    store.put(doc("drafts.a", { title: "before" }))
    const before = structuredClone(store.docs.get("drafts.a"))
    await expect(store.writeDrafts([create("drafts.b"), patch("drafts.a", "stale", { title: "after" })])).rejects.toThrow("Revision mismatch on drafts.a")
    expect([...store.docs.keys()]).toEqual(["drafts.a"])
    expect(store.docs.get("drafts.a")).toEqual(before)
  })

  it("is all or nothing: a patch on a draft that does not exist keeps the others from being written", async () => {
    const store = new MemoryStore()
    await expect(store.writeDrafts([create("drafts.a"), patch("drafts.b", "rev-1", { title: "x" })])).rejects.toThrow("Cannot patch drafts.b: it does not exist")
    expect(store.docs.size).toBe(0)
  })

  it("refuses a patch on a revision that is not the current one, and leaves the draft as it is", async () => {
    const store = new MemoryStore()
    store.put(doc("drafts.a", { title: "before" }))
    const stale = revOf(store, "drafts.a")
    store.edit("drafts.a", (draft) => {
      draft.title = "edited in the Studio"
    })
    await expect(store.writeDrafts([patch("drafts.a", stale, { title: "from the seed" })])).rejects.toThrow("Revision mismatch on drafts.a")
    expect(store.docs.get("drafts.a")).toMatchObject({ title: "edited in the Studio" })
  })

  it("patches a draft on its current revision: sets the given fields, keeps the others and gives a new revision", async () => {
    const store = new MemoryStore()
    store.put(doc("drafts.a", { title: "A", kept: 1 }))
    const rev = revOf(store, "drafts.a")
    await store.writeDrafts([patch("drafts.a", rev, { title: "New", added: true })])
    expect(store.docs.get("drafts.a")).toMatchObject({ _id: "drafts.a", title: "New", added: true, kept: 1 })
    expect(revOf(store, "drafts.a")).not.toBe(rev)
    // The old revision is stale from then on
    await expect(store.writeDrafts([patch("drafts.a", rev, { title: "Again" })])).rejects.toThrow("Revision mismatch")
  })

  it("applies the creations and the patches of one transaction together", async () => {
    const store = new MemoryStore()
    store.put(doc("drafts.a", { title: "A" }))
    await store.writeDrafts([create("drafts.b"), patch("drafts.a", revOf(store, "drafts.a"), { title: "A2" })])
    expect(store.docs.get("drafts.a")).toMatchObject({ title: "A2" })
    expect(store.docs.has("drafts.b")).toBe(true)
  })

  describe("references", () => {
    const strong = (id: string) => ({ _type: "reference", _ref: id })

    it("refuses a draft that holds a strong reference to a document that is not published, as the dataset does, and writes nothing", async () => {
      const store = new MemoryStore()
      await expect(store.writeDrafts([create("drafts.a", { about: strong("b") }), create("drafts.c")])).rejects.toThrow('Mutation failed: Document "drafts.a" references non-existent document "b"')
      expect(store.docs.size).toBe(0)
    })

    it("does not take a draft of the target for the target: only a published document is one", async () => {
      const store = new MemoryStore()
      await expect(store.writeDrafts([create("drafts.b"), create("drafts.a", { about: strong("b") })])).rejects.toThrow("references non-existent document")
      store.put(doc("drafts.b"))
      await expect(store.writeDrafts([create("drafts.a", { about: strong("b") })])).rejects.toThrow("references non-existent document")
    })

    it("takes a reference to a published document, in a list and in an object too", async () => {
      const store = new MemoryStore()
      store.put(doc("b"))
      await store.writeDrafts([create("drafts.a", { about: strong("b"), list: [{ _key: "k", ...strong("b") }], nested: { by: strong("b") } })])
      expect(store.docs.has("drafts.a")).toBe(true)
    })

    it("takes a weak reference to a document that is not there: that is what the Studio writes while the target is a draft", async () => {
      const store = new MemoryStore()
      await store.writeDrafts([create("drafts.a", { about: { ...strong("b"), _weak: true, _strengthenOnPublish: { type: "thing" } } })])
      expect(store.docs.has("drafts.a")).toBe(true)
    })

    it("does not look at the asset of an image or of a file: an upload makes it exist", async () => {
      const store = new MemoryStore()
      await store.writeDrafts([create("drafts.a", { picture: { _type: "image", asset: strong("image-abc-10x10-webp") }, rules: { _type: "file", asset: strong("file-abc-pdf") } })])
      expect(store.docs.has("drafts.a")).toBe(true)
    })

    it("checks what a patch sets, and leaves the draft as it is when it refuses", async () => {
      const store = new MemoryStore()
      store.put(doc("drafts.a"))
      const before = structuredClone(store.docs.get("drafts.a"))
      await expect(store.writeDrafts([patch("drafts.a", revOf(store, "drafts.a"), { about: strong("b") })])).rejects.toThrow('Document "drafts.a" references non-existent document "b"')
      expect(store.docs.get("drafts.a")).toEqual(before)
    })

    it("does not check a draft that already exists: it is left as it is", async () => {
      const store = new MemoryStore()
      store.put(doc("drafts.a"))
      await store.writeDrafts([create("drafts.a", { about: strong("nothing") })])
      expect(store.docs.get("drafts.a")).not.toHaveProperty("about")
    })
  })

  it("keeps its own copy of what it is given", async () => {
    const store = new MemoryStore()
    const op = create("drafts.a", { nested: { n: 1 } })
    await store.writeDrafts([op])
    if (op.type === "createIfNotExists") (op.doc.nested as { n: number }).n = 2
    expect(store.docs.get("drafts.a")).toMatchObject({ nested: { n: 1 } })
  })

  it("records every call as it was sent, the refused ones too", async () => {
    const store = new MemoryStore()
    const sent = { type: "createIfNotExists" as const, doc: doc("drafts.a", { n: 1 }) }
    await store.writeDrafts([sent])
    await expect(store.writeDrafts([create("b")])).rejects.toThrow()
    sent.doc.n = 2
    expect(store.writes).toEqual([[create("drafts.a", { n: 1 })], [create("b")]])
  })
})

describe("what an editor does in the Studio", () => {
  it("put gives a revision to every document, a new one each time", () => {
    const store = new MemoryStore()
    const first = store.put(doc("drafts.a"))
    const second = store.put(doc("drafts.b"))
    expect(first._rev).toEqual(expect.any(String))
    expect(second._rev).not.toBe(first._rev)
    expect(store.docs.get("drafts.a")).toEqual(first)
  })

  it("edit changes a document and gives it a new revision", () => {
    const store = new MemoryStore()
    store.put(doc("drafts.a", { title: "before" }))
    const rev = revOf(store, "drafts.a")
    store.edit("drafts.a", (draft) => {
      draft.title = "after"
    })
    expect(store.docs.get("drafts.a")).toMatchObject({ title: "after" })
    expect(revOf(store, "drafts.a")).not.toBe(rev)
  })

  it("edit names the document it cannot find", () => {
    expect(() => new MemoryStore().edit("drafts.a", () => {})).toThrow("No document drafts.a")
  })

  it("publish turns the draft into the published document, which gets a new revision", () => {
    const store = new MemoryStore()
    store.put(doc("drafts.a", { title: "A" }))
    const rev = revOf(store, "drafts.a")
    store.publish("a")
    expect([...store.docs.keys()]).toEqual(["a"])
    expect(store.docs.get("a")).toMatchObject({ _id: "a", _type: "thing", title: "A" })
    expect(revOf(store, "a")).not.toBe(rev)
  })

  it("publish names the draft it cannot find", () => {
    expect(() => new MemoryStore().publish("a")).toThrow("No draft drafts.a")
  })
})

describe("reading", () => {
  it("getDocuments returns the documents it finds, as copies", async () => {
    const store = new MemoryStore()
    store.put(doc("drafts.a", { nested: { n: 1 } }))
    const found = await store.getDocuments(["drafts.a", "a", "drafts.b"])
    expect([...found.keys()]).toEqual(["drafts.a"])
    ;(found.get("drafts.a")?.nested as { n: number }).n = 2
    expect(store.docs.get("drafts.a")).toMatchObject({ nested: { n: 1 } })
  })

  it("listDocumentIds gives the published id of every document of the types, whatever its state, once", async () => {
    const store = new MemoryStore()
    store.put(doc("drafts.a"))
    store.put(doc("a"))
    store.put(doc("drafts.b"))
    store.put(doc("c"))
    store.put({ _id: "drafts.d", _type: "other" })
    expect((await store.listDocumentIds(["thing"])).sort()).toEqual(["a", "b", "c"])
    expect(await store.listDocumentIds(["other"])).toEqual(["d"])
    expect(await store.listDocumentIds(["nothing"])).toEqual([])
  })
})

describe("image assets", () => {
  it("names an uploaded image like Sanity does, after its content, size and format", async () => {
    const store = new MemoryStore()
    const data = await imageOf("#ff0000", { width: 40, height: 56 }, "webp")
    const { _id } = await store.uploadImage({ data, filename: "a.webp", contentType: "image/webp" })
    expect(_id).toBe(`image-${sha1Of(data)}-40x56-webp`)
  })

  it("names an uploaded SVG without a size", async () => {
    const store = new MemoryStore()
    const data = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"/>')
    const { _id } = await store.uploadImage({ data, filename: "a.svg", contentType: "image/svg+xml" })
    expect(_id).toBe(`image-${sha1Of(data)}-svg`)
  })

  it("keeps one asset for one content: the same bytes give the same id, a different image another", async () => {
    const store = new MemoryStore()
    const red = await imageOf("#ff0000", { width: 40, height: 56 }, "webp")
    const blue = await imageOf("#0000ff", { width: 40, height: 56 }, "webp")
    const first = await store.uploadImage({ data: red, filename: "red.webp", contentType: "image/webp" })
    const again = await store.uploadImage({ data: Buffer.from(red), filename: "other-name.webp", contentType: "image/webp" })
    const other = await store.uploadImage({ data: blue, filename: "blue.webp", contentType: "image/webp" })
    expect(again).toEqual(first)
    expect(other._id).not.toBe(first._id)
    expect(store.assets.size).toBe(2)
    // Every call is recorded, the repeated one too
    expect(store.uploads.map((file) => file.filename)).toEqual(["red.webp", "other-name.webp", "blue.webp"])
  })

  it("findImageAssets knows the contents that were uploaded, and only those", async () => {
    const store = new MemoryStore()
    const red = await imageOf("#ff0000", { width: 40, height: 56 }, "webp")
    const blue = await imageOf("#0000ff", { width: 40, height: 56 }, "webp")
    const { _id } = await store.uploadImage({ data: red, filename: "red.webp", contentType: "image/webp" })
    expect(await store.findImageAssets([sha1Of(red), sha1Of(blue)])).toEqual(new Map([[sha1Of(red), _id]]))
    expect(await store.findImageAssets([])).toEqual(new Map())
  })
})

describe("file assets", () => {
  const pdf = (text: string) => Buffer.from(`%PDF-1.4 ${text}`)

  it("names an uploaded file like Sanity does, after its content and its extension", async () => {
    const store = new MemoryStore()
    const data = pdf("rules")
    const { _id } = await store.uploadFile({ data, filename: "Rules.PDF", contentType: "application/pdf" })
    expect(_id).toBe(`file-${sha1Of(data)}-pdf`)
  })

  it("falls back to bin for a name without an extension", async () => {
    const store = new MemoryStore()
    const data = pdf("no extension")
    for (const filename of ["rules", ".pdf", "rules."]) {
      const { _id } = await store.uploadFile({ data: Buffer.concat([data, Buffer.from(filename)]), filename, contentType: "application/pdf" })
      expect(_id.endsWith("-bin")).toBe(true)
    }
  })

  it("keeps one asset for one content, and records every call", async () => {
    const store = new MemoryStore()
    const rules = pdf("rules")
    const first = await store.uploadFile({ data: rules, filename: "a.pdf", contentType: "application/pdf" })
    const again = await store.uploadFile({ data: Buffer.from(rules), filename: "b.pdf", contentType: "application/pdf" })
    const other = await store.uploadFile({ data: pdf("another"), filename: "c.pdf", contentType: "application/pdf" })
    expect(again).toEqual(first)
    expect(other._id).not.toBe(first._id)
    expect(store.fileAssets.size).toBe(2)
    expect(store.fileUploads.map((file) => file.filename)).toEqual(["a.pdf", "b.pdf", "c.pdf"])
  })

  it("keeps the files and the images apart: a hash is only known to the kind it was uploaded as", async () => {
    const store = new MemoryStore()
    const data = pdf("rules")
    const { _id } = await store.uploadFile({ data, filename: "a.pdf", contentType: "application/pdf" })
    expect(await store.findFileAssets([sha1Of(data), "unknown"])).toEqual(new Map([[sha1Of(data), _id]]))
    expect(await store.findImageAssets([sha1Of(data)])).toEqual(new Map())
    expect(await store.findFileAssets([])).toEqual(new Map())
    expect(store.assets.size).toBe(0)
    expect(store.uploads).toEqual([])
  })
})
