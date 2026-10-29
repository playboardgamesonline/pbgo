import type { PostHog } from "posthog-js"
import { isExcludedPath, type AnalyticsConfig } from "./config"
import { allowedOf, type Allowed, type Consent } from "./consent"
import type { ClientEvents } from "./events"
import { buildOptions } from "./options"

/**
 * What the browser SDK is allowed to do (`Allowed`): nothing is kept on the device and nothing is recorded for a visitor who has
 * not answered or who refused; it may keep its identifier ("analytics"), and on top of it record the session ("accepted").
 */
const same = (a: Allowed, b: Allowed) => a.analytics === b.analytics && a.recordings === b.recordings

/** Events asked for while the SDK is still loading are kept for it (a click right after the page opened); more is a page gone wrong. */
const MAX_QUEUED = 20

/** What the driver needs from the page, so a test hands in fakes instead of a window and a real SDK. */
export type DriverEnv = {
  /** Null without a valid key and host: the driver then does nothing at all. */
  config: AnalyticsConfig | null
  /** The address of the page, null on the server. */
  pathname(): string | null
  /** Loads the SDK. Rejects when it cannot (blocked, offline): analytics are then off for this page view, the page is unaffected. */
  load(): Promise<PostHog>
  /** Removes what the SDK left on the device (storage and cookies of this project). */
  forget(config: AnalyticsConfig): void
  warn(error: unknown): void
}

export type TrackOptions = {
  /** Sends at once instead of batching: for an event right before a full page load (a link to another root layout). */
  instant?: boolean
}

/**
 * Drives the browser SDK from the visitor's answer to the banner. Nothing here throws: the SDK, a blocked script or a refused
 * storage must never break a page.
 *
 * - The SDK is loaded (once, lazily) as soon as the answer is known to the page, on the pages that report (never the gamemaster
 *   or a preview). It starts in the mode the answer asks for, so an accepted visitor is recognised from the first event.
 * - Allowing the identifier later switches the SDK to its persistent storage, allowing the recording lets it record; each can be
 *   taken back on its own (the recording alone, then the SDK keeps its identifier). Withdrawing the identifier switches the SDK
 *   back to memory, stops the recording, drops the identifier and removes what it left on the device. A refusal never lets it
 *   store anything.
 * - Events asked for before the SDK is ready wait for it.
 */
export function createDriver(env: DriverEnv) {
  let client: PostHog | undefined
  let booting: Promise<void> | undefined
  let failed = false
  /** What the answer asks for. */
  let desired: Allowed = allowedOf(null)
  /** What the SDK is set to. */
  let applied: Allowed | undefined
  /** The player of the table on screen, identified once the SDK may keep an identity. */
  let pendingId: string | null = null
  let identified: string | null = null
  let queued: Array<(posthog: PostHog) => void> = []

  /** The settings when this page reports, null when it does not (no configuration, the server, the gamemaster, a preview). */
  function active(): AnalyticsConfig | null {
    const pathname = env.pathname()
    if (!env.config || pathname === null || isExcludedPath(pathname)) return null
    return env.config
  }

  function boot(config: AnalyticsConfig): Promise<void> {
    return env
      .load()
      .then((posthog) => {
        // The visitor may have answered while the SDK was loading: the answer of now decides, not the one the load started with.
        const allowed = desired
        posthog.init(config.key, buildOptions(config, allowed))
        client = posthog
        applied = allowed
        // What an earlier acceptance left on this device (it expired, or it was withdrawn in another tab) goes unless this one allows it.
        if (!allowed.analytics) env.forget(config)
        const waiting = queued
        queued = []
        for (const send of waiting) send(posthog)
        identifyIfReady()
      })
      .catch((error: unknown) => {
        failed = true
        queued = []
        env.warn(error)
      })
  }

  /** Moves to what is allowed now: the persistent storage if the identifier was not allowed before, and the recording on or off. */
  function grant(posthog: PostHog, before: Allowed): void {
    try {
      posthog.set_config({
        ...(before.analytics ? {} : { persistence: "localStorage+cookie" as const }),
        disable_session_recording: !desired.recordings,
      })
    } catch (error) {
      env.warn(error)
    }
    identifyIfReady()
  }

  /**
   * In this order: the recording stops, then the identifier moves to memory (which removes its stored copies), then `reset(true)`
   * draws a new anonymous one in memory and drops the device id too. The sweep is for what the SDK did not clean up itself.
   */
  function withdraw(posthog: PostHog, config: AnalyticsConfig): void {
    try {
      posthog.set_config({ disable_session_recording: true })
      posthog.set_config({ persistence: "memory" })
      posthog.reset(true)
    } catch (error) {
      env.warn(error)
    }
    identified = null
    env.forget(config)
  }

  function apply(): void {
    const config = active()
    if (!client || !config || !applied || same(applied, desired)) return
    const before = applied
    applied = desired
    if (desired.analytics) grant(client, before)
    else withdraw(client, config)
  }

  function identifyIfReady(): void {
    if (!client || !applied?.analytics || pendingId === null || identified === pendingId) return
    try {
      client.identify(pendingId)
      identified = pendingId
    } catch (error) {
      env.warn(error)
    }
  }

  return {
    /** Follows the answer of the banner (null: not answered yet). Starts the SDK the first time; safe to call again and again. */
    sync(consent: Consent | null): void {
      desired = allowedOf(consent?.choice)
      const config = active()
      if (!config) return
      booting ??= boot(config)
      apply()
    },

    track<E extends keyof ClientEvents>(event: E, properties: ClientEvents[E], options: TrackOptions = {}): void {
      if (failed || !active()) return
      const send = (posthog: PostHog) => {
        try {
          posthog.capture(event, properties, options.instant ? { send_instantly: true } : undefined)
        } catch (error) {
          env.warn(error)
        }
      }
      if (client) send(client)
      else if (queued.length < MAX_QUEUED) queued.push(send)
    },

    /**
     * Ties the events of a visitor who accepted to the player they are at this table. The id is the one the server already uses
     * for its own events (the player cookie of the game), so the two sides line up. Held until the visitor accepts.
     */
    identify(id: string): void {
      pendingId = id
      identifyIfReady()
    },
  }
}

export type Driver = ReturnType<typeof createDriver>
