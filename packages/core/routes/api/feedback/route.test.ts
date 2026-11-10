import { assertNoPersonalData } from "@pbgo/analytics/privacy"
import sharp from "sharp"
import { beforeEach, describe, expect, it, vi } from "vitest"

const h = vi.hoisted(() => ({
  scheduled: [] as Array<() => unknown>,
  track: vi.fn<(event: string, distinctId: string, properties: object) => Promise<void>>(async () => {}),
  /** What the limits count: the sends of the player, of the IP (10 s, an hour) and of the game */
  recent: 0,
  inserted: [] as object[],
  insertError: null as { message: string } | null,
  uploaded: [] as string[],
  removed: [] as string[][],
}))

vi.mock("server-only", () => ({}))
vi.mock("next/server", () => ({ after: (callback: () => unknown) => void h.scheduled.push(callback) }))
vi.mock("@pbgo/analytics/server", () => ({ track: h.track }))
vi.mock("../../../server/player", () => ({ getPlayerId: async () => "player-1" }))
vi.mock("../../../server/rate-limit", () => ({ rateLimit: async () => {} }))
vi.mock("../../../server/supabase", () => ({
  supabaseAdmin: () => ({
    from: () => ({
      select: () => {
        const query = { gte: () => query, eq: () => query, then: (resolve: (value: { count: number }) => unknown) => resolve({ count: h.recent }) }
        return query
      },
      insert: async (row: object) => {
        if (h.insertError) return { error: h.insertError }
        h.inserted.push(row)
        return { error: null }
      },
    }),
    storage: {
      from: () => ({
        upload: async (path: string) => {
          h.uploaded.push(path)
          return { error: null }
        },
        remove: async (paths: string[]) => void h.removed.push(paths),
      }),
    },
  }),
}))

import { POST } from "./route"

const ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
const context = { game: { slug: "flip-7" }, params: {} } as never

async function send(fields: Record<string, string>, screenshot?: Blob) {
  const form = new FormData()
  for (const [name, value] of Object.entries(fields)) form.set(name, value)
  if (screenshot) form.set("screenshot", screenshot, "screen.png")
  const request = new Request("http://localhost/api/flip-7/feedback", { method: "POST", headers: { "content-length": "2048" }, body: form })
  return POST(request, context)
}

/** What was counted in PostHog once the response has left. */
function counted() {
  h.scheduled.splice(0).forEach((callback) => callback())
  const sent = h.track.mock.calls.map(([event, distinctId, properties]) => ({ event, distinctId, properties }))
  h.track.mockClear()
  return sent
}

beforeEach(() => {
  h.scheduled.length = 0
  h.track.mockClear()
  h.recent = 0
  h.inserted.length = 0
  h.insertError = null
  h.uploaded.length = 0
  h.removed.length = 0
})

describe("feedback_sent", () => {
  it("counts the feedback once it is kept: the game and the type, and whether an address and a screenshot came with it", async () => {
    const response = await send({ type: "bug", message: "The pile does not move, Marly says hello", email: "marly@example.com", nickname: "Marly", gameCode: "ABC234", page: "/flip-7/game/ABC234" })
    expect(response.status).toBe(200)
    expect(h.inserted).toHaveLength(1)
    expect(counted()).toEqual([{ event: "feedback_sent", distinctId: expect.stringMatching(ID), properties: { game: "flip-7", type: "bug", with_screenshot: false, with_email: true } }])
  })

  it("is for nobody: not the player's identifier, and nothing the person wrote", async () => {
    await send({ type: "suggestion", message: "A secret sentence", email: "marly@example.com", nickname: "Marly", gameCode: "ABC234" })
    const [entry] = counted()
    expect(entry?.distinctId).not.toBe("player-1")
    assertNoPersonalData(entry!.properties)
    for (const secret of ["A secret sentence", "marly@example.com", "Marly", "ABC234", "player-1"]) expect(JSON.stringify(entry)).not.toContain(secret)
  })

  it("says that no address came with it", async () => {
    await send({ type: "review", message: "Great game" })
    expect(counted().map((entry) => entry.properties)).toEqual([{ game: "flip-7", type: "review", with_screenshot: false, with_email: false }])
  })

  it("says that a screenshot came with it", async () => {
    const png = await sharp({ create: { width: 4, height: 4, channels: 3, background: "#336699" } }).png().toBuffer()
    const response = await send({ type: "bug", message: "Look at this" }, new Blob([new Uint8Array(png)], { type: "image/png" }))
    expect(response.status).toBe(200)
    expect(h.uploaded).toHaveLength(1)
    expect(counted().map((entry) => entry.properties)).toEqual([{ game: "flip-7", type: "bug", with_screenshot: true, with_email: false }])
  })

  it("is not sent for a robot that filled the hidden field, a type that is not one, an empty message or a bad address", async () => {
    expect((await send({ type: "bug", message: "hello", website: "http://spam.example" })).status).toBe(200)
    expect((await send({ type: "love", message: "hello" })).status).toBe(400)
    expect((await send({ type: "bug", message: "   " })).status).toBe(400)
    expect((await send({ type: "bug", message: "hello", email: "not an address" })).status).toBe(400)
    expect(h.inserted).toHaveLength(0)
    expect(counted()).toEqual([])
  })

  it("is not sent when the limits turn the feedback away, nor when it could not be kept", async () => {
    h.recent = 1
    expect((await send({ type: "bug", message: "hello" })).status).toBe(429)
    h.recent = 0
    h.insertError = { message: "connection lost" }
    vi.spyOn(console, "error").mockImplementation(() => {})
    expect((await send({ type: "bug", message: "hello" })).status).toBe(500)
    expect(counted()).toEqual([])
  })
})
