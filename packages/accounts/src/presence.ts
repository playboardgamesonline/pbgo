// The beat of a signed-in member who has the site open: the players online count them for two minutes after the last one (migration 0005, `member_presence`; the route is core's
// `POST /api/hub/presence`). Pure, so that the browser and the tests read it the same way.

/** Where the beat goes (a `POST`). */
export const PRESENCE_PATH = "/api/hub/presence"

/** How often a tab that is in view beats. The players online keep a member for two minutes, so one beat may be lost and the member is still counted. */
export const BEAT_EVERY_MS = 45_000

/** The longest wait between two beats after failures: a beat that is refused (the database cannot write it, the member signed out in another tab) is tried again later and later, never every 45 s for nothing. */
export const BEAT_BACKOFF_MAX_MS = 5 * 60_000

/** How long to wait before the next beat: the usual delay after a beat that went through, twice as long as the last wait (up to `BEAT_BACKOFF_MAX_MS`) after one that did not. */
export function nextBeatDelay(current: number, ok: boolean): number {
  return ok ? BEAT_EVERY_MS : Math.min(current * 2, BEAT_BACKOFF_MAX_MS)
}

/** The shortest time between two beats: coming back to the tab beats at once, but not twice in a row. */
export const BEAT_MIN_GAP_MS = 15_000

/** What the beat needs from the browser, so that the loop below is the same in the page and in the tests. */
export type BeatEnvironment = {
  /** Sends one beat and says whether the server took it. A beat that throws counts as one that was not taken. */
  send: () => Promise<boolean>
  /** Whether a tab of the site is in view. */
  visible: () => boolean
  /** Calls `callback` each time a tab comes into view; returns what stops it. */
  onVisible: (callback: () => void) => () => void
  now?: () => number
}

/**
 * Beats now, then every `BEAT_EVERY_MS` while a tab is in view (a tab that is not in view skips its beat and tries again at the next one), and at once when a tab comes back into view, never twice within
 * `BEAT_MIN_GAP_MS`. A beat that is not taken makes the next wait twice as long, up to `BEAT_BACKOFF_MAX_MS` (`nextBeatDelay`). Returns what stops it.
 */
export function startBeating({ send, visible, onVisible, now = Date.now }: BeatEnvironment): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined
  let delay = BEAT_EVERY_MS
  let last = Number.NEGATIVE_INFINITY
  let stopped = false

  const beat = async () => {
    if (!visible() || now() - last < BEAT_MIN_GAP_MS) return
    last = now()
    let taken = false
    try {
      taken = await send()
    } catch {
      taken = false
    }
    delay = nextBeatDelay(delay, taken)
  }
  const loop = async () => {
    await beat()
    if (!stopped) timer = setTimeout(loop, delay)
  }

  const stopListening = onVisible(() => void beat())
  void loop()
  return () => {
    stopped = true
    clearTimeout(timer)
    stopListening()
  }
}
