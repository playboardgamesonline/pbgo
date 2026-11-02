import { describe, expect, it } from "vitest"
import { API_VERSION, CATALOG_DOCUMENTS_QUERY, DatasetError, createHttpStore, createTranslationStore } from "./http-store.ts"
import type { Mutation } from "./expansions.ts"

// The migration's HTTP store against a fake `fetch`: the addresses it calls, what it sends, and that the token is in a header only.

const TOKEN = "sk-test-token-0123456789"

type Call = { url: URL; init: RequestInit }

/** A `fetch` that answers from a list, in order, and remembers what it was asked. */
function fakeFetch(...answers: (Response | Error)[]) {
  const calls: Call[] = []
  const send = (async (input: string | URL | Request, init: RequestInit = {}) => {
    calls.push({ url: new URL(String(input)), init })
    const answer = answers.shift()
    if (answer === undefined) throw new Error("No answer left")
    if (answer instanceof Error) throw answer
    return answer
  }) as typeof fetch
  return { send, calls }
}

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } })

const store = (send: typeof fetch) => createHttpStore({ projectId: "mhgqs6fe", dataset: "production", token: TOKEN, fetch: send })

const authorization = (call: Call | undefined) => (call?.init.headers as Record<string, string> | undefined)?.Authorization

describe("the games of kind expansion", () => {
  it("are read with one query over every perspective, as the token's owner may see them", async () => {
    const { send, calls } = fakeFetch(json({ result: [{ _id: "drafts.game-x", _type: "game", kind: "expansion" }] }))
    const found = await store(send).expansionGames()
    expect(found).toEqual([{ _id: "drafts.game-x", _type: "game", kind: "expansion" }])
    const [call] = calls
    expect(call?.url.origin).toBe("https://mhgqs6fe.api.sanity.io")
    expect(call?.url.pathname).toBe(`/v${API_VERSION}/data/query/production`)
    expect(call?.url.searchParams.get("query")).toBe('*[_type == "game" && kind == "expansion"]')
    expect(call?.url.searchParams.get("perspective")).toBe("raw")
  })

  it("are none when the answer holds no result", async () => {
    expect(await store(fakeFetch(json({})).send).expansionGames()).toEqual([])
    expect(await store(fakeFetch(json({ result: null })).send).expansionGames()).toEqual([])
  })
})

describe("the documents by id", () => {
  it("are read by their ids in the address, a few at a time, and keyed by id", async () => {
    const ids = Array.from({ length: 45 }, (_, index) => `creator-${index}`)
    const { send, calls } = fakeFetch(json({ documents: [{ _id: "creator-1", _type: "creator" }] }), json({ documents: [{ _id: "creator-44", _type: "creator" }] }))
    const found = await store(send).getDocuments(ids)
    expect([...found.keys()]).toEqual(["creator-1", "creator-44"])
    expect(calls).toHaveLength(2)
    expect(calls[0]?.url.pathname).toBe(`/v${API_VERSION}/data/doc/production/${ids.slice(0, 40).join(",")}`)
    expect(calls[1]?.url.pathname).toBe(`/v${API_VERSION}/data/doc/production/${ids.slice(40).join(",")}`)
  })

  it("make no call for no id, and keep the dot of a draft's id", async () => {
    const { send, calls } = fakeFetch(json({ documents: [] }))
    expect((await store(send).getDocuments([])).size).toBe(0)
    expect(calls).toHaveLength(0)
    await store(send).getDocuments(["drafts.game-x"])
    expect(calls[0]?.url.pathname.endsWith("/data/doc/production/drafts.game-x")).toBe(true)
  })

  it("leave out what the dataset does not answer with", async () => {
    const found = await store(fakeFetch(json({ documents: [{ _type: "creator" }, "text", { _id: "a", _type: "creator" }] })).send).getDocuments(["a", "b"])
    expect([...found.keys()]).toEqual(["a"])
  })
})

describe("the transaction", () => {
  const mutations: Mutation[] = [{ create: { _id: "drafts.expansion-x", _type: "expansion" } }, { delete: { id: "drafts.game-x" } }]

  it("is one request with every mutation in it", async () => {
    const { send, calls } = fakeFetch(json({ transactionId: "t", results: [] }))
    await store(send).commit(mutations)
    expect(calls).toHaveLength(1)
    expect(calls[0]?.init.method).toBe("POST")
    expect(calls[0]?.url.pathname).toBe(`/v${API_VERSION}/data/mutate/production`)
    expect(JSON.parse(String(calls[0]?.init.body))).toEqual({ mutations })
  })

  it("is no request at all for no mutation", async () => {
    const { send, calls } = fakeFetch()
    await store(send).commit([])
    expect(calls).toHaveLength(0)
  })
})

describe("the token", () => {
  it("is sent in a header, on every kind of call, and in no address", async () => {
    const { send, calls } = fakeFetch(json({ result: [] }), json({ documents: [] }), json({}))
    const dataset = store(send)
    await dataset.expansionGames()
    await dataset.getDocuments(["a"])
    await dataset.commit([{ delete: { id: "drafts.x" } }])
    for (const call of calls) {
      expect(authorization(call)).toBe(`Bearer ${TOKEN}`)
      expect(call.url.href).not.toContain(TOKEN)
    }
  })

  it("is in no message: a refusal gives what Sanity says, a failure to connect only the kind of failure", async () => {
    const refused = store(fakeFetch(json({ error: { description: "Insufficient permissions; permission \"update\" required" } }, 403)).send)
    const failure = await refused.commit([{ delete: { id: "drafts.x" } }]).catch((error: unknown) => error)
    expect(failure).toBeInstanceOf(DatasetError)
    expect((failure as DatasetError).status).toBe(403)
    expect((failure as DatasetError).message).toBe('The dataset answered 403: Insufficient permissions; permission "update" required')

    const echoing = new TypeError(`fetch failed for Bearer ${TOKEN}`)
    const unreachable = await store(fakeFetch(echoing).send).expansionGames().catch((error: unknown) => error)
    expect(unreachable).toBeInstanceOf(DatasetError)
    expect((unreachable as DatasetError).status).toBe(0)
    expect((unreachable as DatasetError).message).toBe("The dataset could not be reached (TypeError)")
    expect(String((unreachable as DatasetError).message)).not.toContain(TOKEN)
  })

  it("is not repeated by an answer that is not JSON either", async () => {
    const failure = await store(fakeFetch(new Response("<html>Bad gateway</html>", { status: 502, statusText: "Bad Gateway" })).send).expansionGames().catch((error: unknown) => error)
    expect((failure as DatasetError).message).toBe("The dataset answered 502: Bad Gateway")
  })
})

describe("the documents of the catalog (PLT-104)", () => {
  const translations = (send: typeof fetch) => createTranslationStore({ projectId: "mhgqs6fe", dataset: "production", token: TOKEN, fetch: send })

  it("are read with one query over every perspective: the games, the expansions and the categories, drafts and versions with the published ones", async () => {
    const { send, calls } = fakeFetch(json({ result: [{ _id: "game-x", _type: "game" }, { _id: "drafts.category-y", _type: "category" }] }))
    const found = await translations(send).documents()
    expect(found.map((doc) => doc._id)).toEqual(["game-x", "drafts.category-y"])
    const [call] = calls
    expect(call?.url.origin).toBe("https://mhgqs6fe.api.sanity.io")
    expect(call?.url.pathname).toBe(`/v${API_VERSION}/data/query/production`)
    expect(call?.url.searchParams.get("query")).toBe(CATALOG_DOCUMENTS_QUERY)
    expect(CATALOG_DOCUMENTS_QUERY).toBe('*[_type in ["game", "expansion", "category"]]')
    expect(call?.url.searchParams.get("perspective")).toBe("raw")
    expect(authorization(call)).toBe(`Bearer ${TOKEN}`)
  })

  it("are none when the answer holds no result", async () => {
    expect(await translations(fakeFetch(json({})).send).documents()).toEqual([])
  })

  it("are patched in one request, which is one transaction, with the token in a header and in no address", async () => {
    const { send, calls } = fakeFetch(json({ transactionId: "t1" }))
    const patches = [{ patch: { id: "game-x", ifRevisionID: "r1", set: { description: [] }, unset: ["rulesFr"] } }, { patch: { id: "drafts.game-y", ifRevisionID: "r2", set: { names: [] } } }]
    await translations(send).commit(patches)
    expect(calls).toHaveLength(1)
    const [call] = calls
    expect(call?.url.pathname).toBe(`/v${API_VERSION}/data/mutate/production`)
    expect(call?.url.searchParams.get("returnIds")).toBe("true")
    expect(call?.init.method).toBe("POST")
    expect(JSON.parse(String(call?.init.body))).toEqual({ mutations: patches })
    expect(call?.url.href).not.toContain(TOKEN)
    expect(String(call?.init.body)).not.toContain(TOKEN)
  })

  it("makes no call for no patch", async () => {
    const { send, calls } = fakeFetch()
    await translations(send).commit([])
    expect(calls).toEqual([])
  })

  it("say what the dataset answers when it refuses, never the token", async () => {
    const refused = json({ error: { description: "Document revision does not match" } }, 409)
    const failure = await translations(fakeFetch(refused).send).commit([{ patch: { id: "game-x", ifRevisionID: "old" } }]).catch((error: unknown) => error)
    expect(failure).toBeInstanceOf(DatasetError)
    expect((failure as DatasetError).status).toBe(409)
    expect((failure as DatasetError).message).toBe("The dataset answered 409: Document revision does not match")
    const unreachable = await translations(fakeFetch(new TypeError("fetch failed")).send).documents().catch((error: unknown) => error)
    expect((unreachable as DatasetError).message).toBe("The dataset could not be reached (TypeError)")
    expect((unreachable as DatasetError).message).not.toContain(TOKEN)
  })
})
