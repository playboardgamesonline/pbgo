import type { AppEnv } from "./config"
import type { ServerEvents } from "./events"

/** The part of the `posthog-node` client that we use, so a test hands in a fake one. */
export type CaptureClient = {
  captureImmediate(message: {
    distinctId: string
    event: string
    properties?: Record<string, unknown>
    disableGeoip?: boolean
  }): Promise<void>
  /**
   * How `posthog-node` reports a send that failed (an HTTP error, an unreachable host, a timeout): `captureImmediate` still
   * resolves and the failure comes out as an `error` event. The only thing it rejects for is a bug.
   */
  on?(event: "error", listener: (error: unknown) => void): unknown
}

export type Tracker = <E extends keyof ServerEvents>(
  event: E,
  distinctId: string,
  properties: ServerEvents[E],
) => Promise<void>

/** Only a message is printed, never an object that could hold the event, its properties or the player id. */
function logFailure(message: string, error: unknown): void {
  console.error(message, error instanceof Error ? error.message : String(error))
}

/**
 * A `track` bound to a client. Statistics must never break a game: it resolves whatever happens (no client, an unreachable
 * PostHog, a bug in the SDK), and reports a failure on the console only.
 *
 * A send that fails is not a rejection: `posthog-node` swallows it and emits `error` (see `CaptureClient.on`), so the tracker
 * listens to that event, once, for as long as the client lives. Without it an empty log would prove nothing. The event does not
 * say which send failed, so the log line does not either.
 *
 * - `distinctId` is the random value of the game's own `<slug>_player` cookie (per game and per device, 30 days at most). No
 *   name, no chat text and no table code ever goes into `properties`.
 * - The events create no person profile and carry no geolocation; `identity_stable: false` tells an analyst that the same
 *   human gets a new id in another game or after the cookie expires.
 * - `env` says where the event comes from, so the project can keep previews and local runs out of its numbers.
 */
export function createTracker(
  client: CaptureClient | null,
  env: AppEnv,
  log: (message: string, error: unknown) => void = logFailure,
): Tracker {
  client?.on?.("error", (error) => log("[analytics] could not send an event", error))
  return async (event, distinctId, properties) => {
    if (!client || !distinctId) return
    try {
      await client.captureImmediate({
        distinctId,
        event,
        properties: {
          ...properties,
          env,
          identity_stable: false,
          $process_person_profile: false,
        },
        disableGeoip: true,
      })
    } catch (error) {
      log(`[analytics] could not send ${event}`, error)
    }
  }
}
