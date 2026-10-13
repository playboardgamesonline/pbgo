import { describe, expect, it, vi } from "vitest"
import { createTracker, type CaptureClient } from "./tracker"

function fakeClient() {
  const captureImmediate = vi.fn<CaptureClient["captureImmediate"]>(async () => {})
  const listeners: Array<(error: unknown) => void> = []
  const on = vi.fn((_event: "error", listener: (error: unknown) => void) => {
    listeners.push(listener)
    return () => {}
  })
  return {
    client: { captureImmediate, on } satisfies CaptureClient,
    captureImmediate,
    on,
    /** What `posthog-node` does when a send fails: `captureImmediate` resolves, and the failure comes out as an `error` event. */
    fail: (error: unknown) => listeners.forEach((listener) => listener(error)),
  }
}

describe("createTracker", () => {
  it("sends one event with the player id, the environment and no person profile", async () => {
    const { client, captureImmediate } = fakeClient()
    const track = createTracker(client, "preview")
    await track("player_joined", "6c0ad2de-1b0f-4f4e-a1a2-5d1f0ae3c0aa", { game: "hanabi", seat: 1, players: 2 })
    expect(captureImmediate).toHaveBeenCalledTimes(1)
    expect(captureImmediate).toHaveBeenCalledWith({
      distinctId: "6c0ad2de-1b0f-4f4e-a1a2-5d1f0ae3c0aa",
      event: "player_joined",
      properties: {
        game: "hanabi",
        seat: 1,
        players: 2,
        env: "preview",
        identity_stable: false,
        $process_person_profile: false,
      },
      disableGeoip: true,
    })
  })

  it("does not let a property take the place of the fields it adds", async () => {
    const { client, captureImmediate } = fakeClient()
    const track = createTracker(client, "production")
    const hostile = { game: "hanabi", env: "development", identity_stable: true, $process_person_profile: true }
    await track("rematch_started", "id-1", hostile as never)
    const properties = captureImmediate.mock.calls[0][0].properties
    expect(properties).toMatchObject({ env: "production", identity_stable: false, $process_person_profile: false })
  })

  it("leaves the properties it was given untouched", async () => {
    const { client } = fakeClient()
    const track = createTracker(client, "development")
    const properties = { game: "hanabi" }
    await track("takeover_completed", "id-1", properties)
    expect(properties).toEqual({ game: "hanabi" })
  })

  it("does nothing without a client", async () => {
    const log = vi.fn()
    const track = createTracker(null, "production", log)
    await expect(track("rematch_started", "id-1", { game: "hanabi" })).resolves.toBeUndefined()
    expect(log).not.toHaveBeenCalled()
  })

  it("does nothing without a player id", async () => {
    const { client, captureImmediate } = fakeClient()
    const track = createTracker(client, "production")
    await track("rematch_started", "", { game: "hanabi" })
    expect(captureImmediate).not.toHaveBeenCalled()
  })

  it("resolves and logs when PostHog cannot be reached", async () => {
    const log = vi.fn()
    const client: CaptureClient = {
      captureImmediate: async () => {
        throw new Error("network down")
      },
    }
    const track = createTracker(client, "production", log)
    await expect(track("game_started", "id-1", { game: "hanabi", players: 3, options: {} })).resolves.toBeUndefined()
    expect(log).toHaveBeenCalledTimes(1)
    expect(log.mock.calls[0][0]).toContain("game_started")
  })

  it("resolves when the SDK throws before returning a promise", async () => {
    const log = vi.fn()
    const client: CaptureClient = {
      captureImmediate: () => {
        throw new TypeError("bug in the SDK")
      },
    }
    const track = createTracker(client, "production", log)
    await expect(track("chat_message_sent", "id-1", { game: "hanabi", kind: "text" })).resolves.toBeUndefined()
    expect(log).toHaveBeenCalledTimes(1)
  })

  describe("a send that fails", () => {
    it("listens to the error event of the client, once", () => {
      const { client, on } = fakeClient()
      createTracker(client, "production", vi.fn())
      expect(on).toHaveBeenCalledTimes(1)
      expect(on.mock.calls[0][0]).toBe("error")
    })

    it("is logged, without making the call reject, when the SDK reports it as an event", async () => {
      const log = vi.fn()
      const { client, fail } = fakeClient()
      const track = createTracker(client, "production", log)
      await expect(track("game_started", "id-1", { game: "hanabi", players: 3, options: {} })).resolves.toBeUndefined()
      expect(log).not.toHaveBeenCalled()
      const failure = new Error("HTTP error while fetching PostHog: status=500, reqByteLength=246")
      fail(failure)
      expect(log).toHaveBeenCalledTimes(1)
      expect(log).toHaveBeenCalledWith("[analytics] could not send an event", failure)
    })

    it("prints its message and nothing else by default", () => {
      const print = vi.spyOn(console, "error").mockImplementation(() => {})
      try {
        const { client, fail } = fakeClient()
        createTracker(client, "production")
        // An error that carries the request, as a failed fetch can: none of it may reach the console
        fail(Object.assign(new Error("Network error while fetching PostHog"), { request: { distinct_id: "id-1", event: "game_created" } }))
        fail({ batch: [{ distinct_id: "id-1" }] })
        expect(print).toHaveBeenNthCalledWith(1, "[analytics] could not send an event", "Network error while fetching PostHog")
        expect(print).toHaveBeenNthCalledWith(2, "[analytics] could not send an event", "[object Object]")
      } finally {
        print.mockRestore()
      }
    })

    it("needs neither a listener on the client nor a client", async () => {
      const bare: CaptureClient = { captureImmediate: async () => {} }
      await expect(createTracker(bare, "production", vi.fn())("rematch_started", "id-1", { game: "hanabi" })).resolves.toBeUndefined()
      expect(() => createTracker(null, "production", vi.fn())).not.toThrow()
    })
  })
})
