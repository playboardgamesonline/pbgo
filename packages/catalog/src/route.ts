// The pictures of the games and the icons of their publishers: `GET /api/catalog/<slug>/<slot>`, the handler `apps/web` mounts (docs/catalog.md).
// A game's pictures are files of its game in the platform's Sanity project, and the hub draws them straight from Sanity's image CDN
// (`pictureUrl`). The address on this site (`logo`, `icon` or `background` for the slot) is only kept for the links that were shared
// when the pictures were served from here, and sends them to the CDN. No picture is not an error page: the answer is a 404 and the
// page that asked draws a plain frame.
// The same address, `publisher-<n>` for a slot, is the icon of the n-th publisher of the game (from 0): its page has no picture of its
// own, so the server looks for the icon of its website (`favicon.ts`) and serves that, from this site, whose visitors then never meet
// the publisher's.

import { ART_SLOTS, iconVersion, pictureUrl, type ArtSlot, type CatalogGame } from "./catalog"
import { fetchFavicon } from "./favicon"
import { PictureError } from "./picture"
import { getCatalog, reportOnce } from "./server"

/** What a visitor is told to wait when the catalog could not be read. */
export const FAILURE_MEMO_MS = 5000

// The answers and what each one may be kept for, by the browser (`max-age`) and by the CDN (`s-maxage`)
const SHORT = "public, max-age=60, s-maxage=60"
const REDIRECT = "public, max-age=0, s-maxage=10"
const PICTURE_REDIRECT = "public, max-age=300, s-maxage=3600"
const NEVER = "no-store"
// The icon of a publisher's website changes once in years: a day. A site that has none is looked at again in an hour, not at every page
const ICON_FRESH = "public, max-age=86400, s-maxage=86400"
const ICON_ABSENT = "public, max-age=3600, s-maxage=3600"
/** How long a website that could not be reached is left alone: every visit to the page of its game would ask it again, and some would hold a function for the whole time limit. Per server instance. */
export const SITE_FAILURE_MEMO_MS = 5 * 60_000
const MAX_FAILED_SITES = 200

// What the media route sends too: the picture is shown by an <img>, and opened on its own it may not run anything
const SECURITY_HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox",
}

const isSlot = (value: string): value is ArtSlot => (ART_SLOTS as readonly string[]).includes(value)

/** `publisher-<n>`, n from 0, with no leading zero: one icon has one address, so the CDN keeps it once. */
const PUBLISHER_SLOT = /^publisher-(0|[1-9]\d?)$/

/** What an address asks for: one of the three pictures of the game, or the icon of one of its publishers. Null for anything else. */
function wantedOf(slot: string): { picture: ArtSlot } | { publisher: number } | null {
  if (isSlot(slot)) return { picture: slot }
  const place = PUBLISHER_SLOT.exec(slot)?.[1]
  return place === undefined ? null : { publisher: Number(place) }
}

const notFound = (cache = SHORT) => new Response("Not found", { status: 404, headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": cache } })

const unavailable = (retryAfterSeconds: number) =>
  new Response("Try again later", {
    status: 503,
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": NEVER, "Retry-After": String(Math.max(1, Math.ceil(retryAfterSeconds))) },
  })

/**
 * The redirect to the address that carries the version of the website the catalog read, or null when the address is that one already: so
 * that nobody can make the server look for an icon under a `v` of their own, and nothing is downloaded before the address is right.
 */
function staleVersion(request: Request, game: Pick<CatalogGame, "slug">, slot: string, website: string): Response | null {
  const expected = iconVersion(website)
  if (new URL(request.url).searchParams.get("v") === expected) return null
  return new Response(null, { status: 307, headers: { Location: `/api/catalog/${game.slug}/${slot}?v=${expected}`, "Cache-Control": REDIRECT } })
}

/**
 * The icon of a publisher's website, found there (`fetchFavicon`): a day for the CDN, a 404 for a site that has none, a 503 for one that cannot be reached now, and that
 * site is then left alone for `SITE_FAILURE_MEMO_MS` (`failed`: website → until when), so that a website that is down, or that has a broken certificate, is not asked again
 * by every visit to its game's page.
 */
async function publisherIcon(failed: Map<string, number>, slug: string, place: number, website: string): Promise<Response> {
  const until = failed.get(website)
  if (until !== undefined && Date.now() < until) return unavailable((until - Date.now()) / 1000)
  try {
    const icon = await fetchFavicon(website)
    return new Response(icon.bytes, { headers: { ...SECURITY_HEADERS, "Content-Type": icon.type, "Cache-Control": ICON_FRESH } })
  } catch (error) {
    if (!(error instanceof PictureError)) throw error
    reportOnce(`The icon of the publisher ${place + 1} of "${slug}" cannot be served: ${error.message}`)
    if (!error.retryable) return notFound(ICON_ABSENT)
    if (failed.size >= MAX_FAILED_SITES) failed.clear()
    failed.set(website, Date.now() + SITE_FAILURE_MEMO_MS)
    return unavailable(SITE_FAILURE_MEMO_MS / 1000)
  }
}

/**
 * `GET /api/catalog/<slug>/<slot>?v=<version>` for `apps/web`. In this order, so that nothing costs more than it has to:
 * 1. The slot is one of the three, or `publisher-<n>`, and the slug is a game of the catalog: else 404. A live game that has no game
 *    in the Studio has no picture either (its `registryRow` has none).
 * 2. A picture is sent to its address in the image CDN of the platform's project (308), or is a 404 when the game does not have it.
 * 3. `publisher-<n>`: the game must name an n-th publisher and give it a website, `v` is the version of that website (`iconVersion`): a URL
 *    without it, or with an old one, is sent to the right one (307) before anything is looked for, so that nobody can make the server look
 *    for an icon under a `v` of their own. Then the icon is looked for on that website, whose address is the game's and never the request's.
 */
export function pictureRoute() {
  const failedSites = new Map<string, number>()

  return async function GET(request: Request, { params }: { params: Promise<{ slug: string; slot: string }> }): Promise<Response> {
    const { slug, slot } = await params
    const wanted = wantedOf(slot)
    if (!wanted) return notFound()

    const catalog = await getCatalog()
    // The project did not answer: the game may well exist, it is not known to be missing
    if (catalog.source === "unavailable") return unavailable(FAILURE_MEMO_MS / 1000)
    const entry = catalog.entries.find((candidate) => candidate.slug === slug)
    if (!entry) return notFound()
    const game = entry.game

    if ("publisher" in wanted) {
      const website = game.publishers[wanted.publisher]?.url
      if (!website) return notFound()
      return staleVersion(request, game, slot, website) ?? (await publisherIcon(failedSites, game.slug, wanted.publisher, website))
    }

    const picture = pictureUrl(game, wanted.picture)
    return picture ? new Response(null, { status: 308, headers: { Location: picture, "Cache-Control": PICTURE_REDIRECT } }) : notFound()
  }
}
