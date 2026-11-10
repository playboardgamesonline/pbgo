// The beat of a signed-in member who has the site open: the players online count them for two minutes after the last one (migration 0005, `member_presence`; the route is core's
// `POST /api/hub/presence`). Pure, so that the browser and the tests read it the same way.

/** Where the beat goes (a `POST`). */
export const PRESENCE_PATH = "/api/hub/presence"

/** How often a tab that is in view beats. The players online keep a member for two minutes, so one beat may be lost and the member is still counted. */
export const BEAT_EVERY_MS = 45_000

/** The shortest time between two beats: coming back to the tab beats at once, but not twice in a row. */
export const BEAT_MIN_GAP_MS = 15_000

/**
 * How often a tab beats while its member has a table that may begin any moment, a lobby or a ready check (PLT-120): the beat is also how a member who looks at the hub is taken to their game, and a ready check lasts a minute, so the
 * usual 45 s would leave them little time to confirm that they are there. It is the shortest the beat can be.
 */
export const BEAT_SOON_MS = BEAT_MIN_GAP_MS

/** The longest wait between two beats after failures: a beat that is refused (the database cannot write it, the member signed out in another tab) is tried again later and later, never every 45 s for nothing. */
export const BEAT_BACKOFF_MAX_MS = 5 * 60_000

/** What a beat gives back to the loop: whether the server took it, or that it did and the member has a table that may begin any moment (`soon`, the next beat comes sooner). */
export type BeatResult = boolean | "soon"

/** How long to wait before the next beat: the usual delay after a beat that went through, `BEAT_SOON_MS` after one that says to look again soon, twice as long as the last wait (up to `BEAT_BACKOFF_MAX_MS`) after one that did not. */
export function nextBeatDelay(current: number, result: BeatResult): number {
  if (result === "soon") return BEAT_SOON_MS
  return result ? BEAT_EVERY_MS : Math.min(current * 2, BEAT_BACKOFF_MAX_MS)
}

/** What the table a member is taken to is at: in its ready check (`starting`, where the player has to confirm that they are there) or being played. */
export type BeatStatus = "starting" | "playing"

/** The table the server says a member should be at: the game (its slug), the code and what it is at, a table that is in its ready check or being played. */
export type BeatTable = { game: string; code: string; status: BeatStatus }

/** What the server's answer to a beat says (`POST /api/hub/presence`): the table the member is taken to, if any, and whether they have a table that may begin any moment. */
export type BeatAnswer = { table: BeatTable | null; watching: boolean }

const GAME_SLUG = /^[a-z0-9-]{1,64}$/
const TABLE_CODE = /^[A-Z0-9]{4,12}$/

/**
 * Reads the server's answer strictly: the game and the code build an address, so a value that is not a slug and a code is no table. Anything else, an answer that is not one included, says nothing. Only the word `playing` is read as a game being played: a table with
 * no status, or one this code does not know, is `starting`, the strict reading (a server that has not been deployed yet answers with none, and a member must not miss a confirmation).
 */
export function readBeatAnswer(value: unknown): BeatAnswer {
  const answer = (typeof value === "object" && value !== null ? value : {}) as { table?: unknown; watching?: unknown }
  const table = typeof answer.table === "object" && answer.table !== null ? (answer.table as { game?: unknown; code?: unknown; status?: unknown }) : null
  const valid = table !== null && typeof table.game === "string" && GAME_SLUG.test(table.game) && typeof table.code === "string" && TABLE_CODE.test(table.code)
  return { table: valid ? { game: table.game as string, code: table.code as string, status: table.status === "playing" ? "playing" : "starting" } : null, watching: answer.watching === true }
}

/** The pages of the hub where a member is left alone whatever their table is at: the legal pages, which the cookie banner leads to and which have to be readable. */
const STAYS_ON = ["/legal"]

/** The pages where a member is left alone too while their game is being played: the profile of a player, which the seats of the table lead to, and the member's own pages (their profile, their games and friends, their settings). A member who plays may look at them. */
const STAYS_ON_WHILE_PLAYING = ["/player", "/me"]

const onPage = (pathname: string, pages: readonly string[]) => pages.some((page) => pathname === page || pathname.startsWith(`${page}/`))

/**
 * Whether a member whose table is at `status` is taken to its board from this page of the hub (PLT-120). A table in its ready check takes them from every page but the legal ones, so that nobody misses the confirmation they owe the others; a game that is being played also
 * leaves them on a player's profile and on their own pages.
 */
export const takenToGame = (pathname: string, status: BeatStatus): boolean => !onPage(pathname, STAYS_ON) && !(status === "playing" && onPage(pathname, STAYS_ON_WHILE_PLAYING))

/** What the beat needs from the browser, so that the loop below is the same in the page and in the tests. */
export type BeatEnvironment = {
  /** Sends one beat and says whether the server took it, or that it did and a table of the member may begin any moment (`soon`). A beat that throws counts as one that was not taken. */
  send: () => Promise<BeatResult>
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
    let result: BeatResult = false
    try {
      result = await send()
    } catch {
      result = false
    }
    delay = nextBeatDelay(delay, result)
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
