import "server-only"
import { PostHog } from "posthog-node"
import { CONFIG } from "./config"
import { createTracker, type Tracker } from "./tracker"

export type { CaptureClient, Tracker } from "./tracker"
export type { ServerEvents } from "./events"

let tracker: Tracker | undefined

/** Built on first use. Without a key and a host it never sends anything. */
function build(): Tracker {
  if (!CONFIG) return createTracker(null, "development")
  const client = new PostHog(CONFIG.key, {
    // The EU ingest host directly: the server has no use for the `/ingest` proxy of the browser.
    host: CONFIG.ingestHost,
    // An event is sent at once, from `after()`, when the response has already left; nothing waits in a buffer that a frozen
    // serverless function would lose. A short timeout and a single retry keep a PostHog outage from holding the function.
    flushAt: 1,
    flushInterval: 0,
    requestTimeout: 3000,
    fetchRetryCount: 1,
    fetchRetryDelay: 500,
    disableGeoip: true,
  })
  return createTracker(client, CONFIG.appEnv)
}

/**
 * Sends a game event from the server: `after(() => track("game_created", playerId, { game, … }))` once the write is done,
 * never inside a retried modifier. Does nothing without `NEXT_PUBLIC_POSTHOG_KEY` and `NEXT_PUBLIC_POSTHOG_HOST`, and never throws.
 */
export const track: Tracker = (event, distinctId, properties) => (tracker ??= build())(event, distinctId, properties)
