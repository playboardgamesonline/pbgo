/**
 * How the browser keeps the social state of a signed-in member fresh (PLT-23): it reads `GET /api/hub/friends` when the panel opens and again every `SOCIAL_EVERY_MS` while a tab is in view, at once when a tab comes back into view, and
 * whenever the page asks for it (after a change the member made). Pure, so that the page and the tests read it the same way: what the browser has (the read itself, whether a tab is in view, the moment) is given in.
 */

/** How often a tab that is in view reads the state. A friend who comes online, or a request that comes in, shows within this time. */
export const SOCIAL_EVERY_MS = 20_000

/** The shortest time between two reads that nobody asked for: coming back to a tab reads at once, but not twice in a row. A read the page asks for (after a change) is never held back. */
export const SOCIAL_MIN_GAP_MS = 5_000

/** The longest wait between two reads after failures: a read that fails (the database is down, the member signed out in another tab) is tried again later and later. */
export const SOCIAL_BACKOFF_MAX_MS = 5 * 60_000

/** How long to wait before the next read: the usual time after a read that went through, twice the last wait (up to `SOCIAL_BACKOFF_MAX_MS`) after one that did not. */
export function nextSocialDelay(current: number, ok: boolean): number {
  return ok ? SOCIAL_EVERY_MS : Math.min(current * 2, SOCIAL_BACKOFF_MAX_MS)
}

/** What the loop needs from the browser. */
export type SocialSyncEnvironment = {
  /** Reads the state once and says whether it went through. A read that throws counts as one that did not. */
  load: () => Promise<boolean>
  /** Whether a tab of the site is in view. */
  visible: () => boolean
  /** Calls `callback` each time a tab comes into view; returns what stops it. */
  onVisible: (callback: () => void) => () => void
  now?: () => number
}

/**
 * Reads now, then every `SOCIAL_EVERY_MS` while a tab is in view (a tab that is not in view skips its read and tries again at the next time), and at once when a tab comes back into view, never twice within `SOCIAL_MIN_GAP_MS`. A read that fails makes the next wait
 * twice as long (`nextSocialDelay`). One read runs at a time: `refresh` asks for one now, and when a read is on its way it asks for another to follow it, since the one on its way may have started before the change that made the page ask.
 * Returns what stops the loop, and `refresh`.
 */
export function startSocialSync({ load, visible, onVisible, now = Date.now }: SocialSyncEnvironment): { stop: () => void; refresh: () => void } {
  let timer: ReturnType<typeof setTimeout> | undefined
  let delay = SOCIAL_EVERY_MS
  let last = Number.NEGATIVE_INFINITY
  let running = false
  let again = false
  let stopped = false

  const schedule = () => {
    if (stopped) return
    clearTimeout(timer)
    timer = setTimeout(() => void read(false), delay)
  }

  async function read(forced: boolean): Promise<void> {
    if (stopped) return
    if (running) {
      if (forced) again = true
      return
    }
    if (!forced && (!visible() || now() - last < SOCIAL_MIN_GAP_MS)) {
      schedule()
      return
    }
    running = true
    last = now()
    let ok = false
    try {
      ok = await load()
    } catch {
      ok = false
    }
    running = false
    if (stopped) return
    delay = nextSocialDelay(delay, ok)
    if (again) {
      again = false
      void read(true)
      return
    }
    schedule()
  }

  void read(true)
  const stopWatching = onVisible(() => void read(false))
  return {
    stop() {
      stopped = true
      clearTimeout(timer)
      stopWatching()
    },
    refresh() {
      void read(true)
    },
  }
}
