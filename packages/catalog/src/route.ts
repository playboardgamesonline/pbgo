// The pictures of the planned games: `GET /api/catalog/<slug>/<logo|icon|background>`, the handler `apps/web` mounts (docs/catalog.md).
// A planned game's pictures are files of its Notion row, and Notion's own links expire after about an hour, so the catalog only
// flags them: this route asks Notion for a fresh link, downloads the picture (`picture.ts`) and serves it, and the CDN keeps it.
// A live game's pictures are in its Sanity project and never come here. No picture is not an error page: the answer is a 404 and the
// page that asked draws a plain frame.

import { ART_SLOTS, pictureVersion, type ArtSlot } from "./catalog"
import { NotionError, readPictureLinks, type PictureLinks } from "./notion"
import { PictureError, fetchPicture } from "./picture"
import { getCatalog, notionToken, reportOnce } from "./server"

/** How long the links read from Notion are believed: a cold page asks for every picture of every game at once, which Notion's rate limit (about 3 requests a second) would not take. */
export const LINKS_MEMO_MS = 30_000
/** How long a failed read is remembered, so that a Notion that is down is not asked again by every picture of the page. */
export const FAILURE_MEMO_MS = 5000
/** A 429 that asks to wait this many seconds at most is waited for, once, before the read is given up. */
export const MAX_RETRY_WAIT_SECONDS = 3
/** What a picture host is told to wait when it failed for a reason that may pass. */
const PICTURE_RETRY_SECONDS = 30

// The answers and what each one may be kept for, by the browser (`max-age`) and by the CDN (`s-maxage`)
const FRESH = "public, max-age=3600, s-maxage=86400"
// A picture whose URL does not carry the version of its row (the catalog and the read of the links are not of the same minute)
const SHORT = "public, max-age=60, s-maxage=60"
const REDIRECT = "public, max-age=0, s-maxage=10"
const NEVER = "no-store"

// What the media route sends too: the picture is shown by an <img>, and opened on its own it may not run anything
const SECURITY_HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox",
}

const isSlot = (value: string): value is ArtSlot => (ART_SLOTS as readonly string[]).includes(value)

const notFound = () => new Response("Not found", { status: 404, headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": SHORT } })

const unavailable = (retryAfterSeconds: number) =>
  new Response("Try again later", {
    status: 503,
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": NEVER, "Retry-After": String(Math.max(1, Math.ceil(retryAfterSeconds))) },
  })

/** What the last read of the links of the pictures came to, and until when it is believed. `links` is null when the read failed. */
type Reading = { links: PictureLinks | null; until: number }

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

/** One read of the links, or the reason it could not be had. Never throws: a failure is a `Reading` without links. */
async function load(token: string): Promise<Reading> {
  for (let attempt = 0; ; attempt++) {
    try {
      // No cache: the link of an uploaded file lives an hour, a kept one would be dead (`readPictureLinks`)
      return { links: await readPictureLinks({ token, init: { cache: "no-store" } }), until: Date.now() + LINKS_MEMO_MS }
    } catch (error) {
      const wait = error instanceof NotionError && error.status === 429 ? error.retryAfter : null
      if (attempt === 0 && wait !== null && wait <= MAX_RETRY_WAIT_SECONDS) {
        await sleep(wait * 1000)
        continue
      }
      reportOnce(`The pictures of the catalog cannot be read from Notion: ${error instanceof Error ? error.message : "unknown error"}`)
      return { links: null, until: Date.now() + Math.max(FAILURE_MEMO_MS, (wait ?? 0) * 1000) }
    }
  }
}

/**
 * The reader of the links: the answer of the last read for `LINKS_MEMO_MS` (a failure for `FAILURE_MEMO_MS`, or as long as Notion
 * asked), and one read at a time, however many pictures are asked for while it runs. Never rejects.
 */
function linkReader() {
  let settled: Reading | null = null
  let pending: Promise<Reading> | null = null
  return function read(token: string): Promise<Reading> {
    if (settled && Date.now() < settled.until) return Promise.resolve(settled)
    pending ??= load(token).then((reading) => {
      settled = reading
      pending = null
      return reading
    })
    return pending
  }
}

/**
 * `GET /api/catalog/<slug>/<slot>?v=<version>` for `apps/web`. In this order, so that nothing costs more than it has to:
 * 1. The slot is one of the three, and the slug is a planned game of the catalog whose Notion row has that picture: else 404.
 * 2. `v` is the version of the row the catalog read (`pictureVersion`): a URL without it, or with an old one, is sent to the right
 *    one (307) before anything is read or downloaded, so that nobody can make the server fetch a picture under a `v` of their own.
 * 3. The link comes from a fresh read of the Games database, one for all the pictures (`linkReader`), and the picture is downloaded
 *    from it. It is kept for a day when the row is still the one `v` names, for a minute when it is not (the read and the catalog
 *    are never of the same minute), and not at all when Notion or the picture host cannot answer now (503).
 */
export function pictureRoute() {
  const readLinks = linkReader()

  return async function GET(request: Request, { params }: { params: Promise<{ slug: string; slot: string }> }): Promise<Response> {
    const { slug, slot } = await params
    if (!isSlot(slot)) return notFound()

    const catalog = await getCatalog()
    // Notion did not answer: the game may well exist, it is not known to be missing
    if (catalog.notion === "unavailable") return unavailable(FAILURE_MEMO_MS / 1000)
    const entry = catalog.entries.find((candidate) => candidate.slug === slug)
    if (!entry || entry.live || !entry.game.art[slot]) return notFound()
    const game = entry.game

    const expected = pictureVersion(game.editedAt)
    if (new URL(request.url).searchParams.get("v") !== expected) {
      return new Response(null, { status: 307, headers: { Location: `/api/catalog/${game.slug}/${slot}?v=${expected}`, "Cache-Control": REDIRECT } })
    }

    const token = notionToken()
    if (!token) return notFound()
    const reading = await readLinks(token)
    if (!reading.links) return unavailable((reading.until - Date.now()) / 1000)
    const row = reading.links.get(game.notionPageId)
    const link = row?.links[slot]
    if (!row || !link) return notFound()

    try {
      const picture = await fetchPicture(link)
      return new Response(picture.bytes, {
        headers: { ...SECURITY_HEADERS, "Content-Type": picture.type, "Cache-Control": pictureVersion(row.editedAt) === expected ? FRESH : SHORT },
      })
    } catch (error) {
      if (!(error instanceof PictureError)) throw error
      reportOnce(`The ${slot} of "${game.slug}" cannot be served: ${error.message}`)
      return error.retryable ? unavailable(PICTURE_RETRY_SECONDS) : notFound()
    }
  }
}
