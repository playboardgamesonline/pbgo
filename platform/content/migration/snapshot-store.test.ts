import { mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterAll, describe, expect, it } from "vitest"
import { createSnapshotStore, parseSnapshot } from "./snapshot-store.ts"

// A file of documents read as the dataset, for a dry run on a backup or on documents fetched some other way.

const a = { _id: "game-a", _type: "game", name: "A" }
const b = { _id: "drafts.game-b", _type: "game", name: "B" }

describe("parseSnapshot", () => {
  it("reads a JSON array of documents", () => {
    expect(parseSnapshot(JSON.stringify([a, b]))).toEqual([a, b])
  })

  it("reads the answer of the query API", () => {
    expect(parseSnapshot(JSON.stringify({ ms: 4, query: "*", result: [a, b] }))).toEqual([a, b])
  })

  it("reads one document per line, as the data.ndjson of an export holds them, blank lines apart", () => {
    expect(parseSnapshot(`${JSON.stringify(a)}\n\n${JSON.stringify(b)}\n`)).toEqual([a, b])
  })

  it("reads a single document, and nothing from an empty file", () => {
    expect(parseSnapshot(JSON.stringify(a))).toEqual([a])
    expect(parseSnapshot("  \n")).toEqual([])
  })

  it("says where it stops: a line that is not JSON, an entry that is not a document", () => {
    expect(() => parseSnapshot(`${JSON.stringify(a)}\nnot json`)).toThrow("Line 2 is not JSON")
    expect(() => parseSnapshot(JSON.stringify([a, { name: "no id" }]))).toThrow("Entry 2 is not a document (it needs an _id and a _type)")
    expect(() => parseSnapshot(JSON.stringify([a, "x"]))).toThrow("Entry 2 is not a document")
  })
})

describe("the snapshot store", () => {
  const dir = mkdtempSync(join(tmpdir(), "pbgo-snapshot-"))
  afterAll(() => rmSync(dir, { recursive: true, force: true }))

  it("gives the documents of its file, read when they are asked for", async () => {
    const path = join(dir, "documents.json")
    writeFileSync(path, JSON.stringify([a]))
    const store = createSnapshotStore(path)
    expect(await store.documents()).toEqual([a])
    writeFileSync(path, JSON.stringify([a, b]))
    expect(await store.documents()).toEqual([a, b])
  })

  it("writes nothing: a snapshot makes a dry run", async () => {
    const path = join(dir, "documents.json")
    writeFileSync(path, "[]")
    await expect(createSnapshotStore(path).commit([{ patch: { id: "game-a", set: { name: "X" } } }])).rejects.toThrow("A snapshot is read only")
  })
})
