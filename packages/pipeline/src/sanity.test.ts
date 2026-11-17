import { describe, expect, it } from "vitest"
import { missingPublished } from "./sanity.ts"

const answer = (body: unknown, status = 200) => async () => new Response(JSON.stringify(body), { status })

describe("which documents the platform's Sanity shows as published", () => {
  it("asks the public API of the platform's project, the published perspective, with the ids as a variable", async () => {
    let asked = ""
    const fetchImpl = (async (url: string) => {
      asked = url
      return new Response(JSON.stringify({ result: ["game-x"] }))
    }) as unknown as typeof fetch
    expect(await missingPublished(["game-x", "publisher-y"], { fetchImpl })).toEqual(["publisher-y"])
    const url = new URL(asked)
    expect(url.origin).toBe("https://mhgqs6fe.api.sanity.io")
    expect(url.pathname).toBe("/v2025-02-19/data/query/production")
    expect(url.searchParams.get("perspective")).toBe("published")
    expect(url.searchParams.get("query")).toBe("*[_id in $ids]._id")
    expect(JSON.parse(url.searchParams.get("$ids") ?? "")).toEqual(["game-x", "publisher-y"])
  })

  it("says nothing is missing when every id came back, and asks nothing for no id", async () => {
    expect(await missingPublished(["game-x"], { fetchImpl: answer({ result: ["game-x"] }) as unknown as typeof fetch })).toEqual([])
    const never = (async () => {
      throw new Error("no call expected")
    }) as unknown as typeof fetch
    expect(await missingPublished([], { fetchImpl: never })).toEqual([])
  })

  it("counts a document only when it was written since a moment, for a game that was in the catalog before the owner said publish", async () => {
    let asked = ""
    const fetchImpl = (async (url: string) => {
      asked = url
      return new Response(JSON.stringify({ result: ["game-x"] }))
    }) as unknown as typeof fetch
    expect(await missingPublished(["game-x", "publisher-y"], { fetchImpl, since: "2026-11-17T09:00:00.000Z" })).toEqual(["publisher-y"])
    const url = new URL(asked)
    expect(url.searchParams.get("query")).toBe("*[_id in $ids && dateTime(_updatedAt) >= dateTime($since)]._id")
    expect(JSON.parse(url.searchParams.get("$since") ?? "")).toBe("2026-11-17T09:00:00.000Z")
    // with no moment the query is the plain one, and no variable is sent for it
    await missingPublished(["game-x"], { fetchImpl, since: null })
    expect(new URL(asked).searchParams.get("$since")).toBeNull()
  })

  it("takes a draft for what it is: not published", async () => {
    // the perspective makes the API leave drafts out, whatever the id: an answer that holds only the published ids
    expect(await missingPublished(["game-x"], { fetchImpl: answer({ result: [] }) as unknown as typeof fetch })).toEqual(["game-x"])
  })

  it("says it could not be read, never that all is well, when the API is down, answers something else or does not answer", async () => {
    for (const fetchImpl of [
      answer({ error: "down" }, 500),
      answer({ result: "nope" }),
      answer({}),
      async () => new Response("not json"),
      async () => {
        throw new Error("offline")
      },
      (_url: string, init?: { signal?: AbortSignal }) => new Promise((_resolve, reject) => init?.signal?.addEventListener("abort", () => reject(new Error("aborted")))),
    ]) {
      expect(await missingPublished(["game-x"], { fetchImpl: fetchImpl as unknown as typeof fetch, timeoutMs: 50 })).toBeNull()
    }
  })

  it("asks another base when a test says so (PBGO_SANITY_API_BASE)", async () => {
    let asked = ""
    const fetchImpl = (async (url: string) => {
      asked = url
      return new Response(JSON.stringify({ result: [] }))
    }) as unknown as typeof fetch
    await missingPublished(["game-x"], { base: "http://127.0.0.1:1234/", fetchImpl })
    expect(asked.startsWith("http://127.0.0.1:1234/v2025-02-19/data/query/production?")).toBe(true)
  })
})
