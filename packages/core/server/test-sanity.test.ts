import type { SanityClient } from "next-sanity"
import { describe, expect, it } from "vitest"

import { at, type FakeDoc, type FakeSanity, fakeSanity, T0 } from "./test-sanity"

/**
 * The fake client stands in for Sanity in the tests of the gamemaster, so it must keep doing what the real API does. Every
 * behaviour pinned here was observed on a throwaway document of a real dataset (GAM-19); change one only after seeing the real
 * API do something else.
 */

type Tx = ReturnType<SanityClient["transaction"]>
type Build = (tx: Tx) => void

const base = (extra: Record<string, unknown> = {}): FakeDoc => ({ _id: "d", _type: "t", ...extra })

/** Runs the builds in one transaction on a dataset holding `docs`, and returns the fake. */
async function commit(docs: FakeDoc[], ...builds: Build[]) {
  const f = fakeSanity(docs)
  const tx = f.client.transaction()
  for (const build of builds) build(tx)
  await tx.commit()
  return f
}

/** What the document looks like afterwards, without the bookkeeping fields. */
const body = (f: FakeSanity, id = "d") => Object.fromEntries(Object.entries(f.doc(id)!).filter(([field]) => !["_id", "_type", "_updatedAt"].includes(field)))

describe("set and setIfMissing", () => {
  it("create the plain objects a path goes through", async () => {
    const f = await commit(
      [base()],
      (tx) => tx.patch("d", (p) => p.setIfMissing({ "x.y": 1 })),
      (tx) => tx.patch("d", (p) => p.set({ "deep.a.b": 2, "ghost.child": 3 })),
    )
    expect(body(f)).toEqual({ x: { y: 1 }, deep: { a: { b: 2 } }, ghost: { child: 3 } })
  })

  it("setIfMissing keeps a value that is there, set replaces it", async () => {
    const f = await commit(
      [base({ title: "kept", n: 1 })],
      (tx) => tx.patch("d", (p) => p.setIfMissing({ title: "ignored", other: "added" }).set({ n: 2 })),
    )
    expect(body(f)).toEqual({ title: "kept", other: "added", n: 2 })
  })

  it("never create a list entry: with no such entry they do nothing", async () => {
    const initial = base({ list: [{ _key: "a", v: 1 }] })
    const f = await commit(
      [initial],
      (tx) => tx.patch("d", (p) => p.set({ 'list[_key=="zz"].v': 9 })),
      (tx) => tx.patch("d", (p) => p.setIfMissing({ 'list[_key=="zz"].v': 9, 'nolist[_key=="zz"].v': 9 })),
    )
    expect(body(f)).toEqual({ list: [{ _key: "a", v: 1 }] })
  })

  it("write into an entry that is there", async () => {
    const f = await commit(
      [base({ list: [{ _key: "a", v: 1 }, { _key: "b" }] })],
      (tx) => tx.patch("d", (p) => p.set({ 'list[_key=="a"].v': 2 }).setIfMissing({ 'list[_key=="b"].v': 5, 'list[_key=="a"].v': 7 })),
    )
    expect(body(f)).toEqual({ list: [{ _key: "a", v: 2 }, { _key: "b", v: 5 }] })
  })
})

describe("unset", () => {
  it("removes a field, a list entry, or a field of an entry", async () => {
    const f = await commit(
      [base({ keep: 1, drop: 2, list: [{ _key: "a", v: 1 }, { _key: "b", v: 2 }, { _key: "c", v: 3, w: 4 }] })],
      (tx) => tx.patch("d", (p) => p.unset(["drop", 'list[_key=="a"]', 'list[_key=="c"].v'])),
    )
    expect(body(f)).toEqual({ keep: 1, list: [{ _key: "b", v: 2 }, { _key: "c", w: 4 }] })
  })

  it("does nothing on a parent or an entry that is missing", async () => {
    const initial = { keep: 1, list: [{ _key: "a", v: 1 }] }
    const f = await commit(
      [base(initial)],
      (tx) => tx.patch("d", (p) => p.unset(["nope.child", 'list[_key=="zz"]', 'list[_key=="zz"].v', 'nolist[_key=="a"]', "absent"])),
    )
    expect(body(f)).toEqual(initial)
  })
})

describe("append (insert after the last item)", () => {
  it("adds to a list that is there", async () => {
    const f = await commit([base({ list: [1] })], (tx) => tx.patch("d", (p) => p.append("list", [2, 3])))
    expect(body(f)).toEqual({ list: [1, 2, 3] })
  })

  it("does nothing on a list that is not there, and does not fail", async () => {
    const f = await commit([base({ keep: 1 })], (tx) => tx.patch("d", (p) => p.append("list", [2])))
    expect(body(f)).toEqual({ keep: 1 })
  })
})

describe("the order of the operations", () => {
  it("applies setIfMissing, then set, then unset, then insert inside one patch", async () => {
    const f = await commit(
      [base()],
      (tx) =>
        tx.patch("d", (p) =>
          // written in the opposite order on purpose: the order of the calls does not matter
          p
            .append("list", [2])
            .unset(["gone", "alsoGone"])
            .set({ list: [1], gone: "set", n: 1 })
            .setIfMissing({ alsoGone: "setIfMissing", n: 0 }),
        ),
    )
    // `list` is created by the set before the insert reaches it; the unset comes after both writes
    expect(body(f)).toEqual({ list: [1, 2], n: 1 })
  })

  it("applies setIfMissing before set, so a set that replaces an object wins over what setIfMissing put in it", async () => {
    const f = await commit([base()], (tx) => tx.patch("d", (p) => p.set({ a: { c: 2 } }).setIfMissing({ "a.b": 1 })))
    expect(body(f)).toEqual({ a: { c: 2 } })
  })

  it("applies unset before insert, so an item inserted under a key an unset names stays", async () => {
    const f = await commit(
      [base({ list: [{ _key: "a" }, { _key: "b" }] })],
      (tx) => tx.patch("d", (p) => p.append("list", [{ _key: "z", v: 9 }]).unset(['list[_key=="z"]'])),
    )
    expect(body(f)).toEqual({ list: [{ _key: "a" }, { _key: "b" }, { _key: "z", v: 9 }] })
  })

  it("applies the patches of a transaction one after the other, each seeing the ones before", async () => {
    const f = await commit(
      [base({ list: [{ _key: "a" }, { _key: "b" }] })],
      (tx) => tx.patch("d", (p) => p.set({ made: [1] })),
      (tx) => tx.patch("d", (p) => p.append("made", [2])),
      (tx) => tx.patch("d", (p) => p.unset(['list[_key=="b"]'])),
      (tx) => tx.patch("d", (p) => p.append("list", [{ _key: "c" }])),
    )
    expect(body(f)).toEqual({ made: [1, 2], list: [{ _key: "a" }, { _key: "c" }] })
  })
})

describe("a transaction", () => {
  it("writes nothing when one of its patches targets a document that does not exist", async () => {
    const f = fakeSanity([base({ n: 1 })])
    const tx = f.client.transaction()
    tx.patch("d", (p) => p.set({ n: 2 }))
    tx.patch("missing", (p) => p.set({ n: 3 }))
    await expect(tx.commit()).rejects.toThrow(/"missing" not found/)
    expect(f.ids()).toEqual(["d"])
    expect(body(f)).toEqual({ n: 1 })
    expect(f.commits).toEqual([])
  })

  it("can create a document and patch it in the same transaction", async () => {
    const f = await commit([], (tx) => tx.createIfNotExists({ _id: "fresh", _type: "t" }), (tx) => tx.patch("fresh", (p) => p.set({ "a.b": 1 })))
    expect(body(f, "fresh")).toEqual({ a: { b: 1 } })
  })

  it("does not replace a document that createIfNotExists finds", async () => {
    const f = await commit([base({ n: 1 })], (tx) => tx.createIfNotExists({ _id: "d", _type: "t", n: 99 }))
    expect(body(f)).toEqual({ n: 1 })
  })

  it("gives every document it touches the same _updatedAt, a minute after the previous commit", async () => {
    const f = fakeSanity([base(), base({ _id: "drafts.d" }), base({ _id: "other" })])
    const first = f.client.transaction()
    first.patch("d", (p) => p.set({ n: 1 }))
    first.patch("drafts.d", (p) => p.set({ n: 1 }))
    await first.commit()
    expect(f.doc("d")!._updatedAt).toBe(at(60))
    expect(f.doc("drafts.d")!._updatedAt).toBe(at(60))
    expect(f.doc("other")!._updatedAt).toBe(T0)

    const second = f.client.transaction()
    second.patch("other", (p) => p.set({ n: 1 }))
    await second.commit()
    expect(f.doc("other")!._updatedAt).toBe(at(120))
    expect(f.doc("d")!._updatedAt).toBe(at(60))
  })
})

describe("what the fake does not know", () => {
  const refuses = async (docs: FakeDoc[], build: Build, message: RegExp) => {
    const f = fakeSanity(docs)
    const tx = f.client.transaction()
    build(tx)
    await expect(tx.commit()).rejects.toThrow(message)
    expect(f.commits).toEqual([])
  }

  it("throws on a path it cannot read, instead of ignoring it", async () => {
    await refuses([base()], (tx) => tx.patch("d", (p) => p.set({ "list[0]": 1 })), /unsupported path/)
  })

  it("throws on a whole list entry set, which the gamemaster never does and nobody observed", async () => {
    await refuses([base({ list: [{ _key: "a" }] })], (tx) => tx.patch("d", (p) => p.set({ 'list[_key=="a"]': { _key: "a" } })), /whole list entry/)
  })

  it("throws when a path goes through a value that is not an object, or into a list that is not one", async () => {
    await refuses([base({ s: "text" })], (tx) => tx.patch("d", (p) => p.set({ "s.child": 1 })), /not an object/)
    await refuses([base({ s: "text" })], (tx) => tx.patch("d", (p) => p.append("s", [1])), /not a list/)
  })

  it("throws when a missing object would have to be created below a list entry", async () => {
    await refuses([base()], (tx) => tx.patch("d", (p) => p.set({ 'ghost.list[_key=="a"].v': 1 })), /list entry follows/)
  })

  it("rejects a query it does not know", async () => {
    const f = fakeSanity([base()])
    await expect(f.client.fetch(`*[_type == "t"]`)).rejects.toThrow(/unsupported query/)
  })
})

describe("reads", () => {
  it("hides the drafts from the published perspective and shows both in the raw one", async () => {
    const f = fakeSanity([base({ n: 1 }), base({ _id: "drafts.d", n: 2 })])
    const ids = { ids: ["d", "drafts.d"] }
    const query = `*[_id in $ids]{ _id, _updatedAt }`
    expect(await f.client.fetch(query, ids)).toEqual([{ _id: "d", _updatedAt: T0 }])
    expect(await f.client.fetch(query, ids, { perspective: "raw" })).toEqual([
      { _id: "d", _updatedAt: T0 },
      { _id: "drafts.d", _updatedAt: T0 },
    ])
  })

  it("returns the stored document whole, by id, as a copy", async () => {
    const f = fakeSanity([base({ n: 1 })])
    const read = (await f.client.fetch(`*[_id == $id][0]{ n }`, { id: "d" })) as FakeDoc
    expect(read.n).toBe(1)
    read.n = 2
    expect(f.doc("d")!.n).toBe(1)
    expect(await f.client.fetch(`*[_id == $id][0]{ n }`, { id: "nope" })).toBeNull()
  })
})
