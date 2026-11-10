import { parseSearch, parseThings, type BggCandidate, type BggThing } from "./xml.ts"

// BoardGameGeek's XML API 2 (PLT-78), with the token of the application the owner registered there. The terms of BGG apply to everything read here: the figures are shown
// with "Powered by BGG" and a link, unaltered, and the use is not a commercial one without a licence (`docs/platform-sanity.md`, "Figures from BoardGameGeek"). A plain
// `fetch` that a test can hand its own to; the token travels in a header only and no message here repeats it.

/** The API, on the bare host: with `www` the authorization is lost. */
export const BGG_API = "https://boardgamegeek.com/xmlapi2"

/** Ids per `thing` request: the API takes twenty. */
export const THINGS_PER_REQUEST = 20

/** Between two requests: BGG asks for about one a second. */
const PAUSE_MS = 1100

/** Tries for an answer that is not ready (202) or refused for going too fast (429). */
const TRIES = 6

const TIMEOUT_MS = 20_000

/** A call BGG refused or could not answer. The message says what happened, never the token. */
export class BggError extends Error {
  readonly status: number
  constructor(message: string, status: number) {
    super(message)
    this.name = "BggError"
    this.status = status
  }
}

export type BggClientOptions = {
  token: string
  /** Defaults to the global `fetch`. */
  fetch?: typeof fetch
  /** Waits that many milliseconds; defaults to a timer, a test hands in its own. */
  wait?: (ms: number) => Promise<void>
}

export type BggClient = {
  /** The figures of these items, by id. An item BGG does not answer for is not in the map. */
  things(ids: readonly number[]): Promise<Map<number, BggThing>>
  /** The board games whose name matches (the exact name first asked for by `exact`). */
  search(name: string, options?: { exact?: boolean }): Promise<BggCandidate[]>
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

export function createBggClient({ token, fetch: send = fetch, wait = sleep }: BggClientOptions): BggClient {
  let first = true

  /** One GET with the token, politely spaced, trying again when BGG says "not yet" (202) or "slow down" (429). */
  async function get(path: string): Promise<string> {
    for (let attempt = 1; attempt <= TRIES; attempt++) {
      if (!first) await wait(PAUSE_MS * (attempt > 1 ? attempt : 1))
      first = false
      let response: Response
      try {
        response = await send(`${BGG_API}/${path}`, {
          headers: { Authorization: `Bearer ${token}`, Accept: "application/xml", "User-Agent": "pbgo-catalog/1.0 (+https://playboardgamesonline.app)" },
          signal: AbortSignal.timeout(TIMEOUT_MS),
        })
      } catch (error) {
        // Only the kind of failure (TimeoutError, TypeError…): the request holds the token
        throw new BggError(`BoardGameGeek could not be reached (${error instanceof Error ? error.name : "unknown error"})`, 0)
      }
      if (response.status === 202 || response.status === 429) continue
      if (response.status === 401 || response.status === 403) throw new BggError(`BoardGameGeek refused the token (${response.status}): check BGG_API_TOKEN, and that the application is registered at boardgamegeek.com/applications`, response.status)
      if (!response.ok) throw new BggError(`BoardGameGeek answered ${response.status}`, response.status)
      return response.text()
    }
    throw new BggError("BoardGameGeek kept answering that it was busy: try again in a few minutes", 429)
  }

  return {
    async things(ids) {
      const found = new Map<number, BggThing>()
      const wanted = [...new Set(ids)]
      for (let i = 0; i < wanted.length; i += THINGS_PER_REQUEST) {
        const batch = wanted.slice(i, i + THINGS_PER_REQUEST)
        for (const thing of parseThings(await get(`thing?id=${batch.join(",")}&stats=1`))) found.set(thing.id, thing)
      }
      return found
    },

    async search(name, { exact = false } = {}) {
      return parseSearch(await get(`search?query=${encodeURIComponent(name)}&type=boardgame${exact ? "&exact=1" : ""}`))
    },
  }
}
