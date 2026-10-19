import http from "node:http"
import type { AddressInfo } from "node:net"
import { PostHog } from "posthog-node"
import { afterEach, describe, expect, it, vi } from "vitest"
import { createTracker } from "./tracker"

// The real `posthog-node` against responders of this machine, nothing leaves it. `tracker.test.ts` hands in a fake client; this
// one pins what the tracker relies on: the SDK does not reject a send that fails, it emits `error`. If a version of the SDK
// changes that, the failures silently stop being logged, and an empty log would prove nothing.

const KEY = "phc_localtestkey0123456789abcdefghijklmnop"
const servers: http.Server[] = []
const clients: PostHog[] = []

async function listen(server: http.Server): Promise<string> {
  servers.push(server)
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve))
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}`
}

/** A PostHog that answers every request with `status`, and counts the requests it got. */
async function responder(status: number) {
  const seen = { requests: 0 }
  const host = await listen(
    http.createServer((request, response) => {
      seen.requests++
      request.resume()
      request.on("end", () => {
        response.writeHead(status, { "content-type": "application/json" })
        response.end(JSON.stringify({ status: status === 200 ? "Ok" : "error" }))
      })
    }),
  )
  return { host, seen }
}

/** An address nobody listens on. */
async function closedPort(): Promise<string> {
  const server = http.createServer()
  const host = await listen(server)
  await new Promise((resolve) => server.close(resolve))
  return host
}

function clientFor(host: string): PostHog {
  // The options of `server.ts`, without its retry: a failure is then reported at once
  const client = new PostHog(KEY, { host, flushAt: 1, flushInterval: 0, requestTimeout: 2000, fetchRetryCount: 0, disableGeoip: true })
  clients.push(client)
  return client
}

afterEach(async () => {
  await Promise.all(clients.splice(0).map((client) => client.shutdown().catch(() => {})))
  await Promise.all(
    servers.splice(0).map(
      (server) =>
        new Promise((resolve) => {
          server.close(resolve)
          server.closeAllConnections()
        }),
    ),
  )
})

describe("createTracker with the posthog-node client", () => {
  it("sends the event and logs nothing when PostHog accepts it", async () => {
    const { host, seen } = await responder(200)
    const log = vi.fn()
    const track = createTracker(clientFor(host), "development", log)
    await track("game_created", "id-1", { game: "hanabi", options: {}, max_players: 5, locale: "en" })
    expect(seen.requests).toBe(1)
    expect(log).not.toHaveBeenCalled()
  })

  it("logs an HTTP error once, and the call does not reject", async () => {
    const { host, seen } = await responder(500)
    const log = vi.fn()
    const track = createTracker(clientFor(host), "development", log)
    await expect(track("game_created", "id-1", { game: "hanabi", options: {}, max_players: 5, locale: "en" })).resolves.toBeUndefined()
    expect(seen.requests).toBe(1)
    expect(log).toHaveBeenCalledTimes(1)
    expect(log.mock.calls[0][0]).toBe("[analytics] could not send an event")
    expect(String((log.mock.calls[0][1] as Error).message)).toContain("status=500")
  })

  it("logs an unreachable PostHog once, and the call does not reject", async () => {
    const log = vi.fn()
    const track = createTracker(clientFor(await closedPort()), "development", log)
    await expect(track("rematch_started", "id-1", { game: "hanabi" })).resolves.toBeUndefined()
    expect(log).toHaveBeenCalledTimes(1)
    expect(String((log.mock.calls[0][1] as Error).message)).toMatch(/network error/i)
  })

  it("keeps working after a failure", async () => {
    const { host, seen } = await responder(500)
    const log = vi.fn()
    const track = createTracker(clientFor(host), "development", log)
    await track("rematch_started", "id-1", { game: "hanabi" })
    await track("rematch_started", "id-1", { game: "hanabi" })
    expect(seen.requests).toBe(2)
    expect(log).toHaveBeenCalledTimes(2)
  })
})
