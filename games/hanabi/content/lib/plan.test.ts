import { describe, expect, it } from "vitest"
import { assertDraftId, assertSeedId, draftIdOf, idsToRead, planDocs, toOps } from "./plan.ts"
import type { SeedDoc, StoredDoc } from "./types.ts"

const fill = { overwrite: false }
const overwrite = { overwrite: true }

const seed = (extra: Record<string, unknown> = {}): SeedDoc => ({ _id: "thing", _type: "thing", title: "Seed title", tags: [{ _key: "a", _type: "tag", label: "A" }], ...extra })

const stored = (doc: Partial<StoredDoc> & { _id: string }, rev = "rev-1"): StoredDoc => ({ _type: "thing", _rev: rev, _createdAt: "2026-01-01T00:00:00Z", _updatedAt: "2026-01-02T00:00:00Z", ...doc })

const existing = (...docs: StoredDoc[]) => new Map(docs.map((doc) => [doc._id, doc]))

describe("ids", () => {
  it("builds the draft id", () => {
    expect(draftIdOf("card-red-3")).toBe("drafts.card-red-3")
  })

  it.each(["rules", "card-red-3", "bonus_tile-1", "Settings", "x"])("accepts the seed id %s", (id) => {
    expect(() => assertSeedId(id)).not.toThrow()
  })

  it.each(["", "drafts.rules", "a.b", "a b", "a/b", "versions.rel.x", "é"])("rejects the seed id %j", (id) => {
    expect(() => assertSeedId(id)).toThrow(`Invalid seed document id "${id}"`)
  })

  it("accepts a draft id", () => {
    expect(() => assertDraftId("drafts.rules")).not.toThrow()
  })

  it.each(["rules", "versions.rel.rules", "_.rules"])("refuses to write %s: not a draft", (id) => {
    expect(() => assertDraftId(id)).toThrow(`Refusing to write "${id}": only drafts may be written`)
  })

  it.each(["drafts.", "drafts.a.b", "drafts.drafts.x"])("refuses a draft id with a bad remainder: %s", (id) => {
    expect(() => assertDraftId(id)).toThrow("Invalid seed document id")
  })
})

describe("planDocs", () => {
  describe("nothing in the dataset", () => {
    it("creates the draft", () => {
      const [item] = planDocs([seed()], existing(), fill)
      expect(item).toMatchObject({ id: "thing", draftId: "drafts.thing", type: "thing", action: "create", changes: [] })
      expect(item?.doc).toEqual({ ...seed(), _id: "drafts.thing" })
    })

    it("plans one item per seed, in order", () => {
      const plan = planDocs([seed({ _id: "b" }), seed({ _id: "a" })], existing(), fill)
      expect(plan.map((item) => item.id)).toEqual(["b", "a"])
    })
  })

  describe("a draft exists", () => {
    it("is unchanged when it already holds everything", () => {
      const draft = stored({ _id: "drafts.thing", title: "Seed title", tags: [{ _key: "a", _type: "tag", label: "A" }] })
      const [item] = planDocs([seed()], existing(draft), fill)
      expect(item).toMatchObject({ action: "unchanged", changes: [] })
      expect(item?.doc).toBeUndefined()
      expect(item?.set).toBeUndefined()
    })

    it("fills only the gaps, with the revision it was planned against", () => {
      const draft = stored({ _id: "drafts.thing", title: "Seed title", extra: "kept" }, "rev-7")
      const [item] = planDocs([seed()], existing(draft), fill)
      expect(item?.action).toBe("update")
      expect(item?.rev).toBe("rev-7")
      expect(Object.keys(item?.set ?? {})).toEqual(["tags"])
      expect(item?.changes).toEqual([{ kind: "fill", path: "tags" }])
    })

    it("keeps what was edited and says so", () => {
      const draft = stored({ _id: "drafts.thing", title: "Edited", tags: [{ _key: "a", _type: "tag", label: "A" }] })
      const [item] = planDocs([seed()], existing(draft), fill)
      expect(item?.action).toBe("unchanged")
      expect(item?.changes).toEqual([{ kind: "diverged", path: "title", seed: "Seed title", current: "Edited" }])
    })

    it("fills a gap and still reports the edit next to it", () => {
      const draft = stored({ _id: "drafts.thing", title: "Edited" })
      const [item] = planDocs([seed()], existing(draft), fill)
      expect(item?.action).toBe("update")
      expect(Object.keys(item?.set ?? {})).toEqual(["tags"])
      expect(item?.changes.map((change) => change.kind)).toEqual(["diverged", "fill"])
    })

    it("replaces the edit with overwrite", () => {
      const draft = stored({ _id: "drafts.thing", title: "Edited", tags: [{ _key: "a", _type: "tag", label: "A" }] })
      const [item] = planDocs([seed()], existing(draft), overwrite)
      expect(item?.action).toBe("update")
      expect(item?.set).toEqual({ title: "Seed title" })
      expect(item?.changes).toEqual([{ kind: "overwrite", path: "title", seed: "Seed title", current: "Edited" }])
    })

    it("sets a whole top-level field, nested Sanity-only values included", () => {
      const draft = stored({ _id: "drafts.thing", title: "Seed title", tags: [{ _key: "z", _type: "tag", label: "Mine" }] })
      const [item] = planDocs([seed()], existing(draft), fill)
      expect(item?.set).toEqual({
        tags: [
          { _key: "a", _type: "tag", label: "A" },
          { _key: "z", _type: "tag", label: "Mine" },
        ],
      })
    })
  })

  describe("only a published document exists", () => {
    it("leaves it alone when it holds everything", () => {
      const published = stored({ _id: "thing", title: "Seed title", tags: [{ _key: "a", _type: "tag", label: "A" }] })
      const [item] = planDocs([seed()], existing(published), fill)
      expect(item?.action).toBe("unchanged")
    })

    it("makes a draft from it when there are gaps", () => {
      const published = stored({ _id: "thing", title: "Seed title", extra: "only in Sanity" })
      const [item] = planDocs([seed()], existing(published), fill)
      expect(item?.action).toBe("create-from-published")
      expect(item?.doc).toEqual({
        _id: "drafts.thing",
        _type: "thing",
        title: "Seed title",
        extra: "only in Sanity",
        tags: [{ _key: "a", _type: "tag", label: "A" }],
      })
    })

    it("drops the system fields of the published document", () => {
      const published = stored({ _id: "thing" })
      const [item] = planDocs([seed()], existing(published), fill)
      expect(item?.doc).not.toHaveProperty("_rev")
      expect(item?.doc).not.toHaveProperty("_createdAt")
      expect(item?.doc).not.toHaveProperty("_updatedAt")
      expect(item?.doc?._id).toBe("drafts.thing")
    })

    it("does not carry the published values the seed would not touch over a diverging one", () => {
      const published = stored({ _id: "thing", title: "Published edit" })
      const [item] = planDocs([seed()], existing(published), fill)
      expect(item?.action).toBe("create-from-published")
      expect(item?.doc?.title).toBe("Published edit")
      expect(item?.changes).toContainEqual({ kind: "diverged", path: "title", seed: "Seed title", current: "Published edit" })
    })
  })

  describe("a draft and a published document exist", () => {
    it("works on the draft: it is what the Studio shows", () => {
      const published = stored({ _id: "thing", title: "Published" })
      const draft = stored({ _id: "drafts.thing", title: "Seed title", tags: [{ _key: "a", _type: "tag", label: "A" }] }, "rev-3")
      const [item] = planDocs([seed()], existing(published, draft), fill)
      expect(item?.action).toBe("unchanged")
      expect(item?.changes).toEqual([])
    })

    it("never plans a write to the published document", () => {
      const published = stored({ _id: "thing" })
      const draft = stored({ _id: "drafts.thing" })
      const plan = planDocs([seed()], existing(published, draft), fill)
      expect(toOps(plan).every((op) => (op.type === "createIfNotExists" ? op.doc._id : op.id).startsWith("drafts."))).toBe(true)
    })
  })

  describe("what must stop the run", () => {
    it("refuses a document of another type under the same id", () => {
      const other = stored({ _id: "thing", _type: "other" })
      expect(() => planDocs([seed()], existing(other), fill)).toThrow('"thing" is a "other" in the dataset but the seed expects a "thing"')
      const draft = stored({ _id: "drafts.thing", _type: "other" })
      expect(() => planDocs([seed()], existing(draft), fill)).toThrow('"drafts.thing" is a "other" in the dataset but the seed expects a "thing"')
    })

    it("refuses an invalid seed id", () => {
      expect(() => planDocs([seed({ _id: "drafts.thing" })], existing(), fill)).toThrow("Invalid seed document id")
      expect(() => planDocs([seed({ _id: "a.b" })], existing(), fill)).toThrow("Invalid seed document id")
    })
  })

  it("does not read system fields from the seed", () => {
    const draft = stored({ _id: "drafts.thing", title: "Seed title", tags: [{ _key: "a", _type: "tag", label: "A" }] })
    const [item] = planDocs([{ ...seed(), _rev: "rev-from-seed" } as SeedDoc], existing(draft), fill)
    expect(item?.action).toBe("unchanged")
  })
})

describe("idsToRead", () => {
  it("lists the published id and the draft id of every seed", () => {
    expect(idsToRead([seed({ _id: "a" }), seed({ _id: "b" })])).toEqual(["a", "drafts.a", "b", "drafts.b"])
  })
})

describe("toOps", () => {
  it("creates a draft without ever replacing one", () => {
    const plan = planDocs([seed()], existing(), fill)
    expect(toOps(plan)).toEqual([{ type: "createIfNotExists", doc: { ...seed(), _id: "drafts.thing" } }])
  })

  it("creates a draft from the published document the same way", () => {
    const plan = planDocs([seed()], existing(stored({ _id: "thing" })), fill)
    const ops = toOps(plan)
    expect(ops).toHaveLength(1)
    expect(ops[0]).toMatchObject({ type: "createIfNotExists" })
  })

  it("patches a draft only if it has not changed since the plan", () => {
    const plan = planDocs([seed()], existing(stored({ _id: "drafts.thing", title: "Seed title" }, "rev-9")), fill)
    expect(toOps(plan)).toEqual([{ type: "patch", id: "drafts.thing", ifRevisionID: "rev-9", set: { tags: seed().tags } }])
  })

  it("writes nothing for an unchanged document", () => {
    const draft = stored({ _id: "drafts.thing", title: "Seed title", tags: [{ _key: "a", _type: "tag", label: "A" }] })
    expect(toOps(planDocs([seed()], existing(draft), fill))).toEqual([])
  })

  it("refuses a plan item that lacks what it needs to be written", () => {
    expect(() => toOps([{ id: "x", draftId: "drafts.x", type: "thing", action: "create", changes: [] }])).toThrow('Plan for "x" has no document')
    expect(() => toOps([{ id: "x", draftId: "drafts.x", type: "thing", action: "update", changes: [] }])).toThrow('Plan for "x" has no fields or revision to patch')
    expect(() => toOps([{ id: "x", draftId: "drafts.x", type: "thing", action: "update", changes: [], set: {} }])).toThrow('Plan for "x" has no fields or revision to patch')
  })
})
