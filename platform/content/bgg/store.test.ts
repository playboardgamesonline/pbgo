import { describe, expect, it } from "vitest"
import { API_VERSION, DatasetError } from "../migration/http-store.ts"
import type { Mutation } from "./figures.ts"
import { GAMES_QUERY, createFiguresStore } from "./store.ts"

// The store of the figures against a fake `fetch`: the addresses it calls, what it sends, and that the token is in a header only.

const TOKEN = "sk-test-token-0123456789"

type Call = { url: URL; init: RequestInit }

/** A `fetch` that answers from a list, in order, and remembers what it was asked. */
function fakeFetch(...answers: Response[]) {
  const calls: Call[] = []
  const send = (async (input: string | URL | Request, init: RequestInit = {}) => {
    calls.push({ url: new URL(String(input)), init })
    const answer = answers.shift()
    if (answer === undefined) throw new Error("No answer left")
    return answer
  }) as typeof fetch
  return { send, calls }
}

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } })

const store = (send: typeof fetch) => createFiguresStore({ projectId: "mhgqs6fe", dataset: "production", token: TOKEN, fetch: send })

describe("the games", () => {
  it("are read with one query over every perspective, the drafts and the versions with the published ones", async () => {
    const { send, calls } = fakeFetch(json({ result: [{ _id: "game-azul", _type: "game" }, { _id: "drafts.game-azul", _type: "game" }] }))
    expect(await store(send).documents()).toHaveLength(2)
    const [call] = calls
    expect(call?.url.origin).toBe("https://mhgqs6fe.api.sanity.io")
    expect(call?.url.pathname).toBe(`/v${API_VERSION}/data/query/production`)
    expect(call?.url.searchParams.get("query")).toBe(GAMES_QUERY)
    expect(call?.url.searchParams.get("perspective")).toBe("raw")
    expect((call?.init.headers as Record<string, string>).Authorization).toBe(`Bearer ${TOKEN}`)
    expect(call?.url.href).not.toContain(TOKEN)
  })

  it("are not an empty dataset when the answer is not a list", async () => {
    await expect(store(fakeFetch(json({})).send).documents()).rejects.toBeInstanceOf(DatasetError)
    await expect(store(fakeFetch(json({ result: null })).send).documents()).rejects.toThrow("not a list of documents")
  })

  it("say what Sanity refused, without the token", async () => {
    const error = await store(fakeFetch(json({ error: { description: "Session not found" } }, 401)).send).documents().catch((failure: unknown) => failure)
    expect(error).toMatchObject({ status: 401, message: "The dataset answered 401: Session not found" })
    expect(String((error as Error).message)).not.toContain(TOKEN)
  })
})

describe("the write", () => {
  const mutations: Mutation[] = [
    { createIfNotExists: { _id: "drafts.game-azul", _type: "game", name: "Azul" } },
    { patch: { id: "drafts.game-azul", set: { duration: 45 } } },
  ]

  it("is one request, one transaction, with every mutation in it", async () => {
    const { send, calls } = fakeFetch(json({ transactionId: "t" }))
    await store(send).commit(mutations)
    const [call] = calls
    expect(call?.init.method).toBe("POST")
    expect(call?.url.pathname).toBe(`/v${API_VERSION}/data/mutate/production`)
    expect(JSON.parse(String(call?.init.body))).toEqual({ mutations })
  })

  it("is no request at all when there is nothing to write", async () => {
    const { send, calls } = fakeFetch()
    await store(send).commit([])
    expect(calls).toEqual([])
  })

  it("fails with what Sanity says when it refuses, and nothing is half written", async () => {
    const { send } = fakeFetch(json({ error: { description: "Document revision mismatch" } }, 409))
    await expect(store(send).commit(mutations)).rejects.toMatchObject({ status: 409, message: "The dataset answered 409: Document revision mismatch" })
  })
})
