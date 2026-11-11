// The pictures of the games and the icons of their publishers: `GET /api/catalog/<slug>/<slot>`, the handler `apps/web` mounts (docs/catalog.md).
// A game's pictures are files of its game in the platform's Sanity project, and the hub draws them straight from Sanity's image CDN
// (`pictureUrl`). The address on this site (`logo`, `icon` or `background` for the slot) is only kept for the links that were shared
// when the pictures were served from here, and sends them to the CDN. A game's cover (PLT-114) came after those links and has no address
// here: a page draws it from `pictureUrl(game, "cover")`. A picture that cannot be served is no error for the page that asked, nor for the console of its visitor, which reports every 404 and 503 an
// `<img>` meets: the answer is a 204, with nothing in it, that an `<img>` takes as a picture that failed (its `error` fires, and the page draws a plain frame or leaves a name alone). A 404 is for an
// address that nothing points at: a slot that does not exist, a game that is not in the catalog, a publisher that the game does not have.
// The same address, `publisher-<n>` for a slot, is the icon of the n-th publisher of the game (from 0): its page has no picture of its
// own, so the server looks for the icon of its website (`favicon.ts`) and serves that, from this site, whose visitors then never meet
// the publisher's. And `bgg` is the icon of BoardGameGeek, which the game's page draws on its link there, found on BoardGameGeek's website the same way.

import { BGG_SITE, BGG_SLOT, iconVersion, pictureUrl, type ArtSlot, type CatalogGame } from "./catalog"
import { fetchFavicon } from "./favicon"
import { PictureError } from "./picture"
import { getCatalog, reportOnce } from "./server"

// The answers and what each one may be kept for, by the browser (`max-age`) and by the CDN (`s-maxage`). Vercel's CDN keeps a 200, a 404, a 410 and a redirect and does not keep a 204, so what must not be
// looked for again after one is remembered by the route itself (`siteIcon`)
const SHORT = "public, max-age=60, s-maxage=60"
const REDIRECT = "public, max-age=0, s-maxage=10"
const PICTURE_REDIRECT = "public, max-age=300, s-maxage=3600"
const NEVER = "no-store"
// The icon of a publisher's website changes once in years: a day, and so is the answer for a site that has none, which is not looked at again before the day is over
const ICON_FRESH = "public, max-age=86400, s-maxage=86400"
const ICON_ABSENT = ICON_FRESH
/** How long a website that could not be reached is left alone: every visit to the page of its game would ask it again, and some would hold a function for the whole time limit. Per server instance. */
export const SITE_FAILURE_MEMO_MS = 5 * 60_000
/** How long a website that answered and has no icon is left alone: asking is five requests to a site that has nothing for the server, and nothing but this keeps the answer, a 204 being no CDN's to keep. Per server instance. */
export const SITE_ABSENT_MEMO_MS = 24 * 60 * 60_000
const MAX_SKIPPED_SITES = 200

// What the media route sends too: the picture is shown by an <img>, and opened on its own it may not run anything
const SECURITY_HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox",
}

/** The pictures that have an address here: the three that were served from this site before the hub drew them from Sanity's image CDN. The cover of a game came after, and has none. */
const ADDRESSED_SLOTS = ["logo", "icon", "background"] as const satisfies readonly ArtSlot[]
type AddressedSlot = (typeof ADDRESSED_SLOTS)[number]

const isSlot = (value: string): value is AddressedSlot => (ADDRESSED_SLOTS as readonly string[]).includes(value)

/** `publisher-<n>`, n from 0, with no leading zero: one icon has one address, so the CDN keeps it once. */
const PUBLISHER_SLOT = /^publisher-(0|[1-9]\d?)$/

/** What an address asks for: one of the three pictures of the game that have an address, the icon of one of its publishers, or BoardGameGeek's. Null for anything else, the game's cover included. */
function wantedOf(slot: string): { picture: AddressedSlot } | { publisher: number } | { bgg: true } | null {
  if (isSlot(slot)) return { picture: slot }
  if (slot === BGG_SLOT) return { bgg: true }
  const place = PUBLISHER_SLOT.exec(slot)?.[1]
  return place === undefined ? null : { publisher: Number(place) }
}

const notFound = (cache = SHORT) => new Response("Not found", { status: 404, headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": cache } })

/** A picture that cannot be served now, and no error: a 204 with nothing in it, that the page that asked hears as a picture that failed and that no console reports. `cache` says what the answer may be kept for. */
const noPicture = (cache: string) => new Response(null, { status: 204, headers: { "Cache-Control": cache } })

/**
 * The redirect to the address that carries the version of the website the catalog read, or null when the address is that one already: so
 * that nobody can make the server look for an icon under a `v` of their own, and nothing is downloaded before the address is right.
 */
function staleVersion(request: Request, game: Pick<CatalogGame, "slug">, slot: string, website: string): Response | null {
  const expected = iconVersion(website)
  if (new URL(request.url).searchParams.get("v") === expected) return null
  return new Response(null, { status: 307, headers: { Location: `/api/catalog/${game.slug}/${slot}?v=${expected}`, "Cache-Control": REDIRECT } })
}

/** A website that gave no icon: `until` is when it is looked at again, `cache` what the answer for it may be kept for meanwhile. */
type Skipped = { until: number; cache: string }

/**
 * The icon of a website, a publisher's or BoardGameGeek's, found there (`fetchFavicon`): a day for the browser and the CDN, and a 204 for a site that has none or that cannot be reached now. That site is
 * then left alone (`skipped`: website → what it was left for), for `SITE_ABSENT_MEMO_MS` when it answered and has no icon and for `SITE_FAILURE_MEMO_MS` when it could not be reached (the next try may find the
 * icon), so that a website that has none, or that is down, or that has a broken certificate, is not asked again by every visit to its game's page. `what` says whose icon it is, for the line that is logged
 * when it cannot be served.
 */
async function siteIcon(skipped: Map<string, Skipped>, what: string, website: string): Promise<Response> {
  const known = skipped.get(website)
  if (known && Date.now() < known.until) return noPicture(known.cache)
  try {
    const icon = await fetchFavicon(website)
    return new Response(icon.bytes, { headers: { ...SECURITY_HEADERS, "Content-Type": icon.type, "Cache-Control": ICON_FRESH } })
  } catch (error) {
    if (!(error instanceof PictureError)) throw error
    reportOnce(`The icon of ${what} cannot be served: ${error.message}`)
    const left: Skipped = error.retryable ? { until: Date.now() + SITE_FAILURE_MEMO_MS, cache: SHORT } : { until: Date.now() + SITE_ABSENT_MEMO_MS, cache: ICON_ABSENT }
    if (skipped.size >= MAX_SKIPPED_SITES) skipped.clear()
    skipped.set(website, left)
    return noPicture(left.cache)
  }
}

/**
 * `GET /api/catalog/<slug>/<slot>?v=<version>` for `apps/web`. In this order, so that nothing costs more than it has to:
 * 1. The slot is one of the three, `publisher-<n>` or `bgg`, else 404.
 * 2. The catalog could not be read: a 204 that nobody keeps. The game may well exist, and a picture that cannot be served is no error.
 * 3. The slug is a game of the catalog, else 404. A live game that has no game in the Studio has no picture either (its `registryRow` has none).
 * 4. A picture is sent to its address in the image CDN of the platform's project (308), or is a 204 when the game does not have it.
 * 5. `publisher-<n>`: the game must name an n-th publisher and give it a website, else 404, `v` is the version of that website (`iconVersion`): a URL
 *    without it, or with an old one, is sent to the right one (307) before anything is looked for, so that nobody can make the server look
 *    for an icon under a `v` of their own. Then the icon is looked for on that website, whose address is the game's and never the request's.
 * 6. `bgg`: the game must have a page on BoardGameGeek (its id there), else 404, and the icon is looked for on BoardGameGeek's website, a constant (`BGG_SITE`), under the same `v` rule.
 */
export function pictureRoute() {
  const skippedSites = new Map<string, Skipped>()

  return async function GET(request: Request, { params }: { params: Promise<{ slug: string; slot: string }> }): Promise<Response> {
    const { slug, slot } = await params
    const wanted = wantedOf(slot)
    if (!wanted) return notFound()

    const catalog = await getCatalog()
    // The project did not answer: the game may well exist, it is not known to be missing, and the answer is not kept
    if (catalog.source === "unavailable") return noPicture(NEVER)
    const entry = catalog.entries.find((candidate) => candidate.slug === slug)
    if (!entry) return notFound()
    const game = entry.game

    if ("publisher" in wanted) {
      const website = game.publishers[wanted.publisher]?.url
      if (!website) return notFound()
      return staleVersion(request, game, slot, website) ?? (await siteIcon(skippedSites, `the publisher ${wanted.publisher + 1} of "${game.slug}"`, website))
    }

    if ("bgg" in wanted) {
      if (game.bggId === null) return notFound()
      return staleVersion(request, game, slot, BGG_SITE) ?? (await siteIcon(skippedSites, `BoardGameGeek, for "${game.slug}"`, BGG_SITE))
    }

    const picture = pictureUrl(game, wanted.picture)
    return picture ? new Response(null, { status: 308, headers: { Location: picture, "Cache-Control": PICTURE_REDIRECT } }) : noPicture(SHORT)
  }
}
