import { describe, expect, it, vi } from "vitest"
import { BGG_API, BggError, THINGS_PER_REQUEST, createBggClient } from "./client.ts"

// The client against a fake `fetch`: the addresses it calls, the token in a header only, the waits between requests, the answers that mean "not yet", and what it says when BGG refuses.

const TOKEN = "bgg-test-token-0123456789"

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

const xml = (body: string, status = 200) => new Response(body, { status })

const item = (id: number, name = `Game ${id}`) => `<item type="boardgame" id="${id}"><name type="primary" value="${name}" /><minplayers value="2" /></item>`
const items = (...ids: number[]) => xml(`<items>${ids.map((id) => item(id)).join("")}</items>`)

const client = (send: typeof fetch, wait = vi.fn(async (_ms: number) => {})) => ({ bgg: createBggClient({ token: TOKEN, fetch: send, wait }), wait })

describe("things", () => {
  it("asks for the items with their statistics, on the bare host, with the token in a header only", async () => {
    const { send, calls } = fakeFetch(items(432, 13))
    const { bgg } = client(send)
    const found = await bgg.things([432, 13])
    expect([...found.keys()].sort((a, b) => a - b)).toEqual([13, 432])
    const [call] = calls
    expect(`${call?.url.origin}${call?.url.pathname}`).toBe(`${BGG_API}/thing`)
    expect(call?.url.searchParams.get("id")).toBe("432,13")
    expect(call?.url.searchParams.get("stats")).toBe("1")
    expect(call?.url.href).not.toContain(TOKEN)
    const headers = call?.init.headers as Record<string, string>
    expect(headers.Authorization).toBe(`Bearer ${TOKEN}`)
    expect(headers["User-Agent"]).toContain("pbgo")
  })

  it("asks twenty at a time, spaced out, and asks for none twice", async () => {
    const ids = Array.from({ length: 45 }, (_, index) => index + 1)
    const { send, calls } = fakeFetch(items(...ids.slice(0, 20)), items(...ids.slice(20, 40)), items(...ids.slice(40)))
    const { bgg, wait } = client(send)
    const found = await bgg.things([...ids, ...ids.slice(0, 5)])
    expect(found.size).toBe(45)
    expect(calls.map((call) => call.url.searchParams.get("id")?.split(",").length)).toEqual([THINGS_PER_REQUEST, THINGS_PER_REQUEST, 5])
    // No wait before the first request, one before each of the others
    expect(wait).toHaveBeenCalledTimes(2)
    expect(wait.mock.calls.every(([ms]) => ms >= 1000)).toBe(true)
  })

  it("asks for nothing when it is given nothing", async () => {
    const { send, calls } = fakeFetch()
    expect((await client(send).bgg.things([])).size).toBe(0)
    expect(calls).toHaveLength(0)
  })

  it("tries again, waiting longer, when BGG says the answer is not ready (202) or to go slower (429)", async () => {
    const { send, calls } = fakeFetch(xml("", 202), xml("", 429), items(432))
    const { bgg, wait } = client(send)
    expect((await bgg.things([432])).has(432)).toBe(true)
    expect(calls).toHaveLength(3)
    const waits = wait.mock.calls.map(([ms]) => ms)
    expect(waits).toHaveLength(2)
    expect(waits[1]!).toBeGreaterThan(waits[0]!)
  })

  it("gives up with a message when BGG keeps saying it is busy", async () => {
    const { send, calls } = fakeFetch(...Array.from({ length: 10 }, () => xml("", 202)))
    await expect(client(send).bgg.things([432])).rejects.toMatchObject({ name: "BggError", status: 429 })
    expect(calls.length).toBeLessThan(10)
  })

  it("says that the token was refused, without repeating it", async () => {
    for (const status of [401, 403]) {
      const { send } = fakeFetch(xml("Unauthorized", status))
      const error = await client(send).bgg.things([432]).catch((failure: unknown) => failure)
      expect(error).toBeInstanceOf(BggError)
      expect((error as BggError).status).toBe(status)
      expect((error as BggError).message).toContain("BGG_API_TOKEN")
      expect((error as BggError).message).not.toContain(TOKEN)
    }
  })

  it("says what BGG answered for any other refusal", async () => {
    await expect(client(fakeFetch(xml("", 500)).send).bgg.things([1])).rejects.toMatchObject({ status: 500, message: "BoardGameGeek answered 500" })
  })

  it("says only the kind of failure when BGG cannot be reached", async () => {
    const failure = Object.assign(new TypeError(`fetch failed for Bearer ${TOKEN}`), { name: "TypeError" })
    const error = await client(fakeFetch(failure).send).bgg.things([1]).catch((caught: unknown) => caught)
    expect((error as BggError).message).toBe("BoardGameGeek could not be reached (TypeError)")
    expect((error as BggError).message).not.toContain(TOKEN)
  })
})

describe("search", () => {
  it("searches board games by name, the name encoded, and reads the results", async () => {
    const { send, calls } = fakeFetch(xml(`<items total="1"><item type="boardgame" id="3955"><name type="primary" value="BANG!" /><yearpublished value="2002" /></item></items>`))
    const results = await client(send).bgg.search("Bang & Co?")
    expect(results).toEqual([{ id: 3955, name: "BANG!", year: 2002 }])
    expect(calls[0]?.url.pathname).toBe("/xmlapi2/search")
    expect(calls[0]?.url.searchParams.get("query")).toBe("Bang & Co?")
    expect(calls[0]?.url.searchParams.get("type")).toBe("boardgame")
    expect(calls[0]?.url.searchParams.has("exact")).toBe(false)
  })

  it("asks for the exact name when it is asked to", async () => {
    const { send, calls } = fakeFetch(xml(`<items total="0"></items>`))
    await client(send).bgg.search("Trio", { exact: true })
    expect(calls[0]?.url.searchParams.get("exact")).toBe("1")
  })
})
