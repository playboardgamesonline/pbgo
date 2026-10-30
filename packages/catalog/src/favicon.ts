// The icon of a publisher's website, which the page of a game shows at the left of the publisher's name (`/api/catalog/<slug>/publisher-<n>`, `route.ts`).
// The visitor's browser never asks the publisher's site for it: the server does, and the CDN keeps the answer, so a visitor of a game's page is a visitor
// of this site and of nobody else. The site is looked at the way a browser would look: its page is read as far as its head for the links to its icons
// (`rel="icon"`, `shortcut icon`, `apple-touch-icon`), the best ones are tried in turn, and `/favicon.ico` is the last one tried.
// Everything that is fetched goes through `download` (`picture.ts`): https only, no address and no name that stays inside a network, no redirect to such a
// place, a size and a time limit, and what comes must be a picture. The address of the site is the one of the publisher's row in the Editors database,
// never one that a visitor sends: the route only says which publisher of a game's row is wanted (docs/catalog.md).

import { PAGE, PictureError, allowedUrl, download, fetchPicture, type Picture, type PictureOptions } from "./picture"

/** Of a page, the head is all that is read: the links to the icons are there, and a page can be long. */
export const MAX_PAGE_BYTES = 256 * 1024
/** An icon is shown at 16 pixels: one over this is refused. */
export const MAX_ICON_BYTES = 512 * 1024
/** One limit for the page and the icons together (a Vercel function must answer within seconds). */
export const FAVICON_TIMEOUT_MS = 8000
/** How many icons are tried at most, the best first, `/favicon.ico` included. */
export const MAX_TRIES = 4
/** Who asks, for a site that turns a client with no name away. */
export const USER_AGENT = "PlayBoardGamesOnline-icons/1.0 (+https://playboardgamesonline.app)"

/** A link to an icon in a page, and what the page says of it. */
export type IconLink = {
  url: URL
  /** The side of the biggest size the link announces (`sizes="32x32"`), null when it announces none. */
  size: number | null
  /** An SVG, or `sizes="any"`: it is as sharp at any size. */
  scalable: boolean
  /** An `apple-touch-icon`: a square of 180 pixels or so, with a background of its own. */
  apple: boolean
}

const TAG = /<link\b[^>]*>/gi
const COMMENT = /<!--[\s\S]*?-->/g

/** The value of an attribute of a tag, quoted or not, or undefined. */
function attribute(tag: string, name: string): string | undefined {
  const match = new RegExp(`[\\s"'/]${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s"'>]+))`, "i").exec(tag)
  return match ? (match[1] ?? match[2] ?? match[3]) : undefined
}

/**
 * The links to an icon in the HTML of a page (a `<link>` whose `rel` has `icon`, or is an `apple-touch-icon`), resolved against the address the page was
 * found at, in the order the page lists them. A link the server would not follow (`allowedUrl`: an inline `data:` icon, a plain http one, an address) is left
 * out, and so is whatever a comment holds.
 */
export function iconLinks(html: string, base: URL): IconLink[] {
  const links: IconLink[] = []
  for (const [tag] of html.replace(COMMENT, "").matchAll(TAG)) {
    const rel = (attribute(tag, "rel") ?? "").toLowerCase().split(/\s+/)
    const apple = rel.includes("apple-touch-icon") || rel.includes("apple-touch-icon-precomposed")
    if (!apple && !rel.includes("icon")) continue
    const href = attribute(tag, "href")?.trim().replace(/&amp;/gi, "&")
    const url = href ? allowedUrl(href, base) : null
    if (!url) continue
    const sizes = (attribute(tag, "sizes") ?? "").toLowerCase()
    const sides = [...sizes.matchAll(/(\d+)x(\d+)/g)].map((match) => Math.min(Number(match[1]), Number(match[2])))
    const type = (attribute(tag, "type") ?? "").toLowerCase()
    links.push({
      url,
      size: sides.length > 0 ? Math.max(...sides) : null,
      scalable: sizes.includes("any") || type === "image/svg+xml" || /\.svg$/i.test(url.pathname),
      apple,
    })
  }
  return links
}

/**
 * What a link is worth for an icon that is drawn at 16 pixels, and on a screen that doubles them at 32: the lowest first. A picture of 32 to 128 pixels is the
 * best (the nearest to 64 first), a scalable one comes after it, then an `apple-touch-icon` (180 pixels, sharp but with its own background), then a link that
 * announces no size (an ICO, most of the time, from 16 to 48 pixels), then a bigger picture, and the ones under 32 pixels last (they are blurred when doubled).
 */
export function rank(link: IconLink): number {
  if (link.scalable) return 20
  if (link.apple) return 40
  if (link.size === null) return 60
  if (link.size > 128) return 50
  if (link.size >= 32) return Math.abs(link.size - 64) / 8
  return 80 + (32 - link.size)
}

/** The address of a site as the server fetches it: https, even when the row says http (a site that has no https has no icon for us). Null when the server would not follow it. */
function secure(site: string): URL | null {
  try {
    const url = new URL(site)
    if (url.protocol === "http:") url.protocol = "https:"
    return allowedUrl(url.href)
  } catch {
    return null
  }
}

export type FaviconOptions = Pick<PictureOptions, "fetch" | "timeoutMs">

/**
 * The icon of a website: the best of the icons its page links to that can be had, else its `/favicon.ico`. At most `MAX_TRIES` are tried, all within one time
 * limit. Fails with a `PictureError`, and only with one: `retryable` when nobody could be reached (the site is down or slow), so the next try may find it, and not
 * when the site answered and has nothing the server can use.
 */
export async function fetchFavicon(site: string, options: FaviconOptions = {}): Promise<Picture> {
  const shared = { fetch: options.fetch, signal: AbortSignal.timeout(options.timeoutMs ?? FAVICON_TIMEOUT_MS), userAgent: USER_AGENT }
  const start = secure(site)
  if (!start) throw new PictureError("The website of the publisher is not one the server follows", false)

  const failures: PictureError[] = []
  const candidates: URL[] = []
  let origin = start
  try {
    // The page says where the icons are. One that cannot be had (the site is down, it turns the server away) still leaves the icon that every browser asks for
    const page = await download(start.href, PAGE, { ...shared, maxBytes: MAX_PAGE_BYTES })
    origin = page.url
    candidates.push(...iconLinks(new TextDecoder().decode(page.bytes), page.url).sort((a, b) => rank(a) - rank(b)).map((link) => link.url))
  } catch (error) {
    if (!(error instanceof PictureError)) throw error
    failures.push(error)
  }
  candidates.push(new URL("/favicon.ico", origin))

  const tried = new Set<string>()
  for (const candidate of candidates) {
    if (tried.size >= MAX_TRIES) break
    if (tried.has(candidate.href)) continue
    tried.add(candidate.href)
    try {
      return await fetchPicture(candidate.href, { ...shared, maxBytes: MAX_ICON_BYTES })
    } catch (error) {
      if (!(error instanceof PictureError)) throw error
      failures.push(error)
    }
  }
  const why = failures[0]?.message
  throw new PictureError(`${start.host} has no icon the server can use${why ? ` (${why})` : ""}`, failures.length > 0 && failures.every((failure) => failure.retryable))
}
