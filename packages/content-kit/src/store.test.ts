import type { SanityClient } from "@sanity/client"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { connect, createSanityStore } from "./store.ts"
import type { DraftOp, StoredDoc } from "./types.ts"

const created = vi.hoisted(() => ({ configs: [] as Record<string, unknown>[], client: undefined as unknown }))

vi.mock("@sanity/client", () => ({
  createClient: (config: Record<string, unknown>) => {
    created.configs.push(config)
    return created.client
  },
}))

type Step = ["createIfNotExists", unknown] | ["patch", string, unknown]

class FakeTransaction {
  steps: Step[] = []
  commits = 0
  failure?: Error

  createIfNotExists(doc: unknown) {
    this.steps.push(["createIfNotExists", doc])
    return this
  }

  patch(id: string, patch: unknown) {
    this.steps.push(["patch", id, patch])
    return this
  }

  async commit() {
    this.commits += 1
    if (this.failure) throw this.failure
    return {}
  }
}

/** The few methods of the Sanity client the store calls, recorded. */
class FakeClient {
  documents = new Map<string, StoredDoc>()
  getCalls: string[][] = []
  fetchCalls: { query: string; params: Record<string, unknown> }[] = []
  fetchResult: unknown = []
  uploads: { type: string; data: Buffer; options: unknown }[] = []
  transactions: FakeTransaction[] = []
  commitFailure?: Error

  async getDocuments(ids: string[]) {
    this.getCalls.push(ids)
    return ids.map((id) => this.documents.get(id) ?? null)
  }

  async fetch(query: string, params: Record<string, unknown>) {
    this.fetchCalls.push({ query, params })
    return this.fetchResult
  }

  assets = {
    upload: async (type: string, data: Buffer, options: unknown) => {
      this.uploads.push({ type, data, options })
      return { _id: "image-abc-40x56-webp", url: "https://cdn.sanity.io/…", sha1hash: "abc" }
    },
  }

  transaction() {
    const transaction = new FakeTransaction()
    transaction.failure = this.commitFailure
    this.transactions.push(transaction)
    return transaction
  }
}

const setup = () => {
  const client = new FakeClient()
  return { client, store: createSanityStore(client as unknown as SanityClient) }
}

const stored = (id: string, type = "thing"): StoredDoc => ({ _id: id, _type: type, _rev: "rev-1" })

describe("getDocuments", () => {
  it("returns the documents found, keyed by id", async () => {
    const { client, store } = setup()
    client.documents.set("a", stored("a"))
    client.documents.set("drafts.a", stored("drafts.a"))
    const found = await store.getDocuments(["a", "drafts.a", "missing"])
    expect([...found.keys()]).toEqual(["a", "drafts.a"])
    expect(found.get("a")).toMatchObject({ _id: "a", _type: "thing" })
  })

  it("skips the ids that do not exist", async () => {
    const { store } = setup()
    expect((await store.getDocuments(["nope", "neither"])).size).toBe(0)
  })

  it("asks for at most 40 ids at a time, so that the URL stays short", async () => {
    const { client, store } = setup()
    const ids = Array.from({ length: 95 }, (_, i) => `doc-${i}`)
    for (const id of ids) client.documents.set(id, stored(id))
    const found = await store.getDocuments(ids)
    expect(client.getCalls.map((call) => call.length)).toEqual([40, 40, 15])
    expect(client.getCalls.flat()).toEqual(ids)
    expect(found.size).toBe(95)
  })

  it("makes no request for no id", async () => {
    const { client, store } = setup()
    expect((await store.getDocuments([])).size).toBe(0)
    expect(client.getCalls).toEqual([])
  })

  it("does not split a list of exactly 40", async () => {
    const { client, store } = setup()
    await store.getDocuments(Array.from({ length: 40 }, (_, i) => `d${i}`))
    expect(client.getCalls).toHaveLength(1)
  })
})

describe("listDocumentIds", () => {
  it("asks for the types it manages", async () => {
    const { client, store } = setup()
    client.fetchResult = ["a"]
    await store.listDocumentIds(["thing", "other"])
    expect(client.fetchCalls).toHaveLength(1)
    expect(client.fetchCalls[0]?.query).toContain("_type in $types")
    expect(client.fetchCalls[0]?.params).toEqual({ types: ["thing", "other"] })
  })

  it("names a draft or a release version by the published id, once", async () => {
    const { client, store } = setup()
    client.fetchResult = ["a", "drafts.a", "versions.spring.a", "drafts.b", "c"]
    expect(await store.listDocumentIds(["thing"])).toEqual(["a", "b", "c"])
  })

  it("does not touch an id that only looks like a prefix", async () => {
    const { client, store } = setup()
    client.fetchResult = ["drafts-a", "my.drafts.b", "versions"]
    expect(await store.listDocumentIds(["thing"])).toEqual(["drafts-a", "my.drafts.b", "versions"])
  })
})

describe("findImageAssets", () => {
  it("returns the asset id of each known hash", async () => {
    const { client, store } = setup()
    client.fetchResult = [
      { _id: "image-aaa-1x1-webp", sha1hash: "aaa" },
      { _id: "image-bbb-2x2-webp", sha1hash: "bbb" },
    ]
    const found = await store.findImageAssets(["aaa", "bbb", "ccc"])
    expect(found).toEqual(
      new Map([
        ["aaa", "image-aaa-1x1-webp"],
        ["bbb", "image-bbb-2x2-webp"],
      ]),
    )
    expect(client.fetchCalls[0]?.query).toContain("sanity.imageAsset")
    expect(client.fetchCalls[0]?.params).toEqual({ sha1s: ["aaa", "bbb", "ccc"] })
  })

  it("makes no request for no hash", async () => {
    const { client, store } = setup()
    expect((await store.findImageAssets([])).size).toBe(0)
    expect(client.fetchCalls).toEqual([])
  })
})

describe("uploadImage", () => {
  it("uploads the bytes as an image with the name and the type of the file, and returns the id only", async () => {
    const { client, store } = setup()
    const data = Buffer.from("not really a picture")
    const result = await store.uploadImage({ data, filename: "card-3.webp", contentType: "image/webp" })
    expect(result).toEqual({ _id: "image-abc-40x56-webp" })
    expect(client.uploads).toEqual([{ type: "image", data, options: { filename: "card-3.webp", contentType: "image/webp" } }])
  })

  it("lets a failed upload through", async () => {
    const { client, store } = setup()
    client.assets.upload = async () => {
      throw new Error("upload refused")
    }
    await expect(store.uploadImage({ data: Buffer.from("x"), filename: "a.webp", contentType: "image/webp" })).rejects.toThrow("upload refused")
  })
})

describe("writeDrafts", () => {
  const create = (id: string): DraftOp => ({ type: "createIfNotExists", doc: { _id: id, _type: "thing", title: id } })
  const patch = (id: string): DraftOp => ({ type: "patch", id, ifRevisionID: "rev-9", set: { title: "New" } })

  it("writes every op in ONE transaction", async () => {
    const { client, store } = setup()
    await store.writeDrafts([create("drafts.a"), patch("drafts.b"), create("drafts.c")])
    expect(client.transactions).toHaveLength(1)
    expect(client.transactions[0]?.commits).toBe(1)
    expect(client.transactions[0]?.steps).toEqual([
      ["createIfNotExists", { _id: "drafts.a", _type: "thing", title: "drafts.a" }],
      ["patch", "drafts.b", { ifRevisionID: "rev-9", set: { title: "New" } }],
      ["createIfNotExists", { _id: "drafts.c", _type: "thing", title: "drafts.c" }],
    ])
  })

  it("creates without ever replacing, and patches only against the revision it planned for", async () => {
    const { client, store } = setup()
    await store.writeDrafts([create("drafts.a"), patch("drafts.b")])
    const kinds = client.transactions[0]?.steps.map((step) => step[0])
    expect(kinds).toEqual(["createIfNotExists", "patch"])
    expect((client.transactions[0]?.steps[1] as Step & ["patch", string, { ifRevisionID: string }])[2].ifRevisionID).toBe("rev-9")
  })

  it("starts nothing for no op", async () => {
    const { client, store } = setup()
    await store.writeDrafts([])
    expect(client.transactions).toEqual([])
  })

  describe("what is not a draft", () => {
    it.each([
      ["a published document to create", create("rules")],
      ["a published document to patch", patch("settings")],
      ["a release version", create("versions.spring.rules")],
    ])("refuses %s, before any transaction exists", async (_name, op) => {
      const { client, store } = setup()
      await expect(store.writeDrafts([op])).rejects.toThrow(/Refusing to write ".+": only drafts may be written/)
      expect(client.transactions).toEqual([])
    })

    it("checks every op before it writes any, so that one bad id stops the whole batch", async () => {
      const { client, store } = setup()
      await expect(store.writeDrafts([create("drafts.a"), create("drafts.b"), patch("published")])).rejects.toThrow('Refusing to write "published"')
      expect(client.transactions).toEqual([])
    })

    it("refuses a malformed draft id", async () => {
      const { client, store } = setup()
      await expect(store.writeDrafts([create("drafts.a.b")])).rejects.toThrow("Invalid seed document id")
      expect(client.transactions).toEqual([])
    })
  })

  it("lets the failure of the commit through, as the whole batch failed", async () => {
    const { client, store } = setup()
    client.commitFailure = new Error("Document revision does not match")
    await expect(store.writeDrafts([patch("drafts.a")])).rejects.toThrow("Document revision does not match")
  })
})

describe("the store", () => {
  it("can read, upload and write drafts, and nothing else: no publish, no delete", () => {
    const { store } = setup()
    expect(Object.keys(store).sort()).toEqual(["findImageAssets", "getDocuments", "listDocumentIds", "uploadImage", "writeDrafts"])
  })
})

describe("connect", () => {
  beforeEach(() => {
    created.configs.length = 0
    created.client = new FakeClient()
  })

  it("reads everything, drafts and versions included, straight from the API", () => {
    connect({ projectId: "proj", dataset: "production", apiVersion: "2025-01-01", token: "test-token" })
    expect(created.configs).toEqual([{ projectId: "proj", dataset: "production", apiVersion: "2025-01-01", token: "test-token", useCdn: false, perspective: "raw" }])
  })

  it("gives a store that goes through the same draft guard", async () => {
    const store = connect({ projectId: "proj", dataset: "production", apiVersion: "2025-01-01", token: "test-token" })
    await expect(store.writeDrafts([{ type: "createIfNotExists", doc: { _id: "rules", _type: "rules" } }])).rejects.toThrow("only drafts may be written")
    expect((created.client as FakeClient).transactions).toEqual([])
  })
})
