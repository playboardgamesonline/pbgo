import { afterEach, describe, expect, it } from "vitest"
import type { ArtSlot } from "./art.ts"
import { MemoryStore } from "./memory-store.ts"
import { formatReport } from "./report.ts"
import { run } from "./run.ts"
import type { RunOptions } from "./run.ts"
import { TempFolders, imageOf } from "./test-fixtures.ts"
import type { SeedDoc } from "./types.ts"

const context = { projectId: "proj123", dataset: "production" }
const dry: RunOptions = { apply: false, overwrite: false, only: [] }
const apply: RunOptions = { apply: true, overwrite: false, only: [] }

const thing = (id: string, extra: Record<string, unknown> = {}): SeedDoc => ({ _id: id, _type: "thing", title: `Title ${id}`, ...extra })
const other = (id: string): SeedDoc => ({ _id: id, _type: "other", name: id })
const pic = (name: string, extra: Partial<ArtSlot> = {}): ArtSlot => ({
  name,
  label: name,
  maxSize: 64,
  docId: "a",
  place: (doc, image) => {
    doc.picture = image
  },
  ...extra,
})

const report = async (store: MemoryStore, options: RunOptions, seed: SeedDoc[], slots: ArtSlot[] = [], verbose = false) =>
  formatReport(await run({ store, docs: seed, slots, options }), { ...context, verbose })

const lines = (text: string) => text.split("\n")

const temp = new TempFolders()
afterEach(() => temp.cleanUp())

describe("a dry run", () => {
  it("says so first, and that nothing was written", async () => {
    const out = await report(new MemoryStore(), dry, [thing("a"), thing("b"), other("c")])
    expect(lines(out)[0]).toBe("Content seed · project proj123 · dataset production")
    expect(out).toContain("DRY RUN: nothing was written or uploaded. Run again with --apply to write the drafts.")
    expect(out).not.toContain("APPLIED")
    expect(out).not.toContain("Verified")
  })

  it("counts the documents and the kind of work", async () => {
    const out = await report(new MemoryStore(), dry, [thing("a"), thing("b"), other("c")])
    expect(out).toContain("3 document(s) selected out of 3 in the seed")
    expect(out).toMatch(/^\s+3 {2}new draft$/m)
  })

  it("counts them per type", async () => {
    const out = await report(new MemoryStore(), dry, [thing("a"), thing("b"), other("c")])
    expect(out).toMatch(/^ {2}thing\s+2 {3}2 new$/m)
    expect(out).toMatch(/^ {2}other\s+1 {3}1 new$/m)
  })

  it("says how many documents were selected out of the seed", async () => {
    const out = await report(new MemoryStore(), { ...dry, only: ["thing"] }, [thing("a"), thing("b"), other("c")])
    expect(out).toContain("2 document(s) selected out of 3 in the seed")
    expect(out).not.toMatch(/^ {2}other\s/m)
  })

  it("ends with what to do next", async () => {
    const out = await report(new MemoryStore(), dry, [thing("a")])
    expect(lines(out).at(-1)).toBe("Next: check this summary, then run with --apply. The seed only writes drafts; publishing is done in the Studio.")
  })

  it("says there is nothing to add, instead of pointing to --apply, once everything is in the dataset", async () => {
    const store = new MemoryStore()
    await report(store, apply, [thing("a"), other("c")])
    const out = await report(store, dry, [thing("a"), other("c")])
    expect(out).toMatch(/^\s+2 {2}nothing to add$/m)
    expect(lines(out).at(-1)).toBe("Next: nothing to add, everything the seed selects is already in the dataset.")
  })
})

describe("an apply", () => {
  it("says how many drafts were written and that nothing is published", async () => {
    const out = await report(new MemoryStore(), apply, [thing("a"), other("c")])
    expect(out).toContain("APPLIED: 2 draft(s) written. Nothing is published: review and publish them in the Studio.")
    expect(out).not.toContain("DRY RUN")
    expect(lines(out).at(-1)).toBe("Verified: planning again after the write finds nothing to do, so running the seed again changes nothing.")
  })

  it("writes nothing the second time, and says there is nothing to add", async () => {
    const store = new MemoryStore()
    await report(store, apply, [thing("a"), other("c")])
    const out = await report(store, apply, [thing("a"), other("c")])
    expect(out).toContain("APPLIED: 0 draft(s) written.")
    expect(out).toMatch(/^\s+2 {2}nothing to add$/m)
    expect(out).toMatch(/^ {2}thing\s+1 {3}1 unchanged$/m)
    expect(out).not.toContain("Gaps filled")
  })
})

describe("what is already in the dataset", () => {
  it("lists the gaps that are filled in an existing draft", async () => {
    const store = new MemoryStore()
    store.put({ _id: "drafts.a", _type: "thing", title: "Title a" })
    const out = await report(store, dry, [thing("a", { tags: ["x"], note: "n" })])
    expect(out).toMatch(/^\s+1 {2}existing draft, gaps filled$/m)
    expect(out).toContain("Gaps filled in existing documents:")
    expect(out).toContain("  a: tags, note")
    expect(out).toMatch(/^ {2}thing\s+1 {3}1 to fill$/m)
  })

  it("says that a draft is made from a published document", async () => {
    const store = new MemoryStore()
    store.put({ _id: "a", _type: "thing", title: "Title a" })
    const out = await report(store, dry, [thing("a", { note: "n" })])
    expect(out).toMatch(/^\s+1 {2}new draft made from the published document, gaps filled$/m)
    expect(out).toMatch(/^ {2}thing\s+1 {3}1 from published$/m)
    expect(out).toContain("  a: note")
  })

  it("cuts a long list of gaps", async () => {
    const store = new MemoryStore()
    store.put({ _id: "drafts.a", _type: "thing" })
    const many = Object.fromEntries(Array.from({ length: 12 }, (_, i) => [`f${i}`, i]))
    const out = await report(store, dry, [thing("a", many)])
    expect(out).toContain("(+")
    expect(out).toMatch(/title, f0, f1, f2, f3, f4, f5, f6 \(\+5 more\)/)
  })

  it("leaves the unchanged documents out of the gaps", async () => {
    const store = new MemoryStore()
    await report(store, apply, [thing("a"), thing("b")])
    store.edit("drafts.b", (doc) => delete doc.title)
    const out = await report(store, dry, [thing("a"), thing("b")])
    expect(out).toContain("  b: title")
    expect(out).not.toContain("  a: title")
  })
})

describe("the list of every document", () => {
  it("is there only when asked for", async () => {
    const seed = [thing("a"), other("c")]
    expect(await report(new MemoryStore(), dry, seed)).not.toContain("Every document:")
    const verbose = await report(new MemoryStore(), dry, seed, [], true)
    expect(verbose).toContain("Every document:")
    expect(verbose).toMatch(/^ {2}create\s+a \(thing\)$/m)
    expect(verbose).toMatch(/^ {2}create\s+c \(other\)$/m)
  })

  it("names the action of each document", async () => {
    const store = new MemoryStore()
    store.put({ _id: "drafts.a", _type: "thing", title: "Title a" })
    const out = await report(store, dry, [thing("a", { note: "n" }), thing("b")], [], true)
    expect(out).toMatch(/^ {2}update\s+a \(thing\)$/m)
    expect(out).toMatch(/^ {2}create\s+b \(thing\)$/m)
  })
})

describe("what was edited in the Studio", () => {
  const edited = () => {
    const store = new MemoryStore()
    store.put({ _id: "drafts.a", _type: "thing", title: "Edited" })
    return store
  }

  it("is reported as kept, with both values", async () => {
    const out = await report(edited(), dry, [thing("a", { title: "Seed title" })])
    expect(out).toContain("Kept as edited in Sanity (1): the seed says something else. Use --overwrite --only <id> to replace.")
    expect(out).toContain("  a › title")
    expect(out).toContain('      Sanity: "Edited"')
    expect(out).toContain('      seed:   "Seed title"')
    expect(out).not.toContain("Replaced with")
  })

  it("is not reported when the values agree", async () => {
    const out = await report(edited(), dry, [thing("a", { title: "Edited" })])
    expect(out).not.toContain("Kept as edited")
  })

  it("cuts a long value", async () => {
    const store = new MemoryStore()
    store.put({ _id: "drafts.a", _type: "thing", title: "x".repeat(200) })
    const out = await report(store, dry, [thing("a", { title: "Seed title" })])
    const shown = lines(out).find((line) => line.startsWith("      Sanity: "))?.slice("      Sanity: ".length) ?? ""
    expect(shown).toHaveLength(72)
    expect(shown.endsWith("…")).toBe(true)
  })

  it("is reported as replaced with --overwrite", async () => {
    const out = await report(edited(), { apply: false, overwrite: true, only: ["a"] }, [thing("a", { title: "Seed title" })])
    expect(out).toContain("Replaced with the seed's value (1, --overwrite):")
    expect(out).toContain("  a › title")
    expect(out).toContain('      was: "Edited"')
    expect(out).toContain('      now: "Seed title"')
    expect(out).not.toContain("Kept as edited")
  })
})

describe("what is in the dataset but not in the seed", () => {
  it("is listed as left alone", async () => {
    const store = new MemoryStore()
    store.put({ _id: "drafts.y", _type: "thing" })
    store.put({ _id: "z", _type: "thing" })
    const out = await report(store, dry, [thing("a")])
    expect(out).toContain("In the dataset but not in the seed (left alone, never deleted): y, z")
  })

  it("is not mentioned when there is none", async () => {
    expect(await report(new MemoryStore(), dry, [thing("a")])).not.toContain("never deleted")
  })

  it("is cut after eight", async () => {
    const store = new MemoryStore()
    for (let i = 0; i < 11; i += 1) store.put({ _id: `orphan-${String(i).padStart(2, "0")}`, _type: "thing" })
    const out = await report(store, dry, [thing("a")])
    expect(out).toContain("orphan-00, orphan-01, orphan-02, orphan-03, orphan-04, orphan-05, orphan-06, orphan-07 (+3 more)")
    expect(out).not.toContain("orphan-08,")
  })
})

describe("the art", () => {
  it("says it was not processed when no folder was given", async () => {
    const out = await report(new MemoryStore(), dry, [thing("a")], [pic("a-pic")])
    expect(out).toContain("Art: not processed (no --art-dir). Drop the files in a folder and pass it; see docs/content-pipeline.md.")
  })

  it("announces the uploads of a dry run", async () => {
    const dir = await temp.create({ "a-pic.png": await imageOf("#cc2200") })
    const out = formatReport(await run({ store: new MemoryStore(), docs: [thing("a")], slots: [pic("a-pic"), pic("a-back")], options: { ...dry, artDir: dir } }), context)
    expect(out).toContain(`Art (${dir}): 2 slots in total, 1 file(s) matched, 1 still missing`)
    expect(out).toContain("  would upload 1 new image(s); 0 already in the dataset")
    expect(out).toContain("  missing: a-back")
    expect(out).not.toContain("  uploaded")
  })

  it("counts the uploads of an apply, then the images already there", async () => {
    const dir = await temp.create({ "a-pic.png": await imageOf("#cc2200") })
    const store = new MemoryStore()
    const options = { ...apply, artDir: dir }
    const first = formatReport(await run({ store, docs: [thing("a")], slots: [pic("a-pic")], options }), context)
    expect(first).toContain("  uploaded 1 new image(s); 0 were already in the dataset")
    const second = formatReport(await run({ store, docs: [thing("a")], slots: [pic("a-pic")], options }), context)
    expect(second).toContain("  uploaded 0 new image(s); 1 were already in the dataset")
  })

  it("still points to --apply when an image would be uploaded, even if every document is unchanged", async () => {
    const dir = await temp.create({ "a-pic.png": await imageOf("#cc2200") })
    const store = new MemoryStore()
    store.put({ _id: "drafts.a", _type: "thing", title: "Title a", picture: { _type: "image", asset: { _type: "reference", _ref: "image-edited-in-the-studio" } } })
    const out = formatReport(await run({ store, docs: [thing("a")], slots: [pic("a-pic")], options: { ...dry, artDir: dir } }), context)
    expect(out).toMatch(/^\s+1 {2}nothing to add$/m)
    expect(out).toContain("  would upload 1 new image(s); 0 already in the dataset")
    expect(lines(out).at(-1)).toMatch(/^Next: check this summary, then run with --apply\./)
  })

  it("warns about the proportions, the files that match no slot, and the slots still empty", async () => {
    const dir = await temp.create({ "a-pic.png": await imageOf("#cc2200", { width: 100, height: 100 }), "typo.png": await imageOf("#0022cc") })
    const out = formatReport(await run({ store: new MemoryStore(), docs: [thing("a")], slots: [pic("a-pic", { ratio: [5, 7], maxSize: 200 }), pic("a-back")], options: { ...dry, artDir: dir } }), context)
    expect(out).toContain("  warning: a-pic.png is 100×100, expected 5:7")
    expect(out).toContain("  files that match no slot (typo in the name?): typo.png")
    expect(out).toContain("  missing: a-back")
  })

  it("cuts a long list of missing slots after six", async () => {
    const dir = await temp.create()
    const slots = Array.from({ length: 9 }, (_, i) => pic(`slot-${i}`))
    const out = formatReport(await run({ store: new MemoryStore(), docs: [thing("a")], slots, options: { ...dry, artDir: dir } }), context)
    expect(out).toContain("Art (")
    expect(out).toContain("9 slots in total, 0 file(s) matched, 9 still missing")
    expect(out).toContain("  missing: slot-0, slot-1, slot-2, slot-3, slot-4, slot-5 (+3 more)")
    expect(out).not.toContain("would upload")
  })
})

describe("the order of the summary", () => {
  it("goes from the mode to the work, the edits, the art, what is left alone and what to do next", async () => {
    const store = new MemoryStore()
    store.put({ _id: "drafts.a", _type: "thing", title: "Edited" })
    store.put({ _id: "drafts.y", _type: "thing" })
    const out = await report(store, dry, [thing("a", { title: "Seed title", note: "n" }), other("c")], [], true)
    const marks = ["Content seed", "DRY RUN", "selected out of", "Gaps filled", "Every document:", "Kept as edited", "Art: not processed", "never deleted", "Next:"]
    const positions = marks.map((mark) => out.indexOf(mark))
    expect(positions.every((position) => position >= 0)).toBe(true)
    expect(positions).toEqual([...positions].sort((x, y) => x - y))
  })

  it("never prints a token: it is not given one", async () => {
    const out = await report(new MemoryStore(), dry, [thing("a")])
    expect(out).not.toMatch(/token\s*[:=]/i)
    expect(formatReport.length).toBe(2)
  })
})
