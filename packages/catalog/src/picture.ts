// The picture download: one picture from a link, for the route to serve (the icon of a publisher's website) and for the platform's seed (the
// pictures of its Notion rows). Everything the server does with a link it did not write itself is here and nowhere else: which links it follows (`allowedUrl`), how far it follows them (redirects, time,
// size) and what it accepts as a picture (`sniff`). A plain `fetch`, no framework: the caller can hand in its own. The download
// itself (`download`) is also what the icon of a publisher's website is looked for with (`favicon.ts`: its page, then its icons).
// Not here: the cache headers and the answers (`route.ts`).

/** A picture over this many bytes is refused: a Vercel function answers 4.5 MB at most, and a card is not that big. */
export const MAX_PICTURE_BYTES = 4 * 1024 * 1024
/** For the whole download, redirects included. */
export const PICTURE_TIMEOUT_MS = 8000
export const MAX_REDIRECTS = 3

// Names that stay inside a network, whatever they are called there: a link to one is a link to the server's own side of the fence
const LOCAL_SUFFIXES = [".localhost", ".local", ".internal", ".localdomain", ".home.arpa"]

/**
 * The link as a URL if the server may fetch it, else null: https, no credentials, the default port, and a public-looking host name.
 * Not an address (an IPv4 whatever the way it is written, an IPv6), not a name without a dot (`localhost`, `intranet`) and not one
 * that a network keeps for itself (`.local`, `.internal`…). `base` resolves a relative link, for a redirect.
 * The server does not resolve names, so a public name that points at a private address passes: the websites come from the Studio, which
 * is trusted as far as whoever can edit it (docs/catalog.md).
 */
export function allowedUrl(raw: string, base?: URL): URL | null {
  let url: URL
  try {
    url = new URL(raw, base)
  } catch {
    return null
  }
  if (url.protocol !== "https:" || url.username || url.password || url.port) return null
  // The parser keeps every trailing dot (`localhost..`) and turns `2130706433`, `0x7f.1` or `127.1` into dotted decimal
  const host = url.hostname.toLowerCase().replace(/\.+$/, "")
  if (!host.includes(".") || host.startsWith("[") || host.includes(":") || /^[0-9.]+$/.test(host)) return null
  if (host.split(".").some((label) => label === "")) return null
  if (host === "home.arpa" || LOCAL_SUFFIXES.some((suffix) => host.endsWith(suffix))) return null
  return url
}

const startsWith = (bytes: Uint8Array, signature: readonly number[], offset = 0) => signature.every((byte, index) => bytes[offset + index] === byte)
const ascii = (text: string) => [...text].map((char) => char.charCodeAt(0))

const PNG = [0x89, ...ascii("PNG"), 0x0d, 0x0a, 0x1a, 0x0a]
const JPEG = [0xff, 0xd8, 0xff]
const GIF = [ascii("GIF87a"), ascii("GIF89a")]
const RIFF = ascii("RIFF")
const WEBP = ascii("WEBP")
const FTYP = ascii("ftyp")
const AVIF = [ascii("avif"), ascii("avis")]
// An icon file (a favicon): a zero, an image type of 1 and the count of the images it holds, which is not zero
const ICO = [0, 0, 1, 0]
// An SVG is text: a prologue (declaration, comments, doctype) and then `<svg`, within the first bytes. The decoder drops a BOM, and
// `\s` would take it anyway. A doctype with an internal subset (`<!DOCTYPE svg [ … ]>`) is refused on purpose: no entities.
const SVG_SNIFF_BYTES = 2048
const SVG = /^\s*(?:(?:<\?xml[^>]*\?>|<!--[\s\S]*?-->|<!DOCTYPE[^>]*>)\s*)*<svg[\s>/]/

/**
 * What the bytes are, as a content type, or null when they are not a picture: PNG, JPEG, GIF, WebP, AVIF, SVG or an icon file
 * (ICO, which only an icon is). Decided by the file's own first bytes, never by what the host said it sent: a host that calls a
 * web page `image/png` is not obeyed.
 */
export function sniff(bytes: Uint8Array): string | null {
  if (startsWith(bytes, PNG)) return "image/png"
  if (startsWith(bytes, JPEG)) return "image/jpeg"
  if (GIF.some((signature) => startsWith(bytes, signature))) return "image/gif"
  if (startsWith(bytes, RIFF) && startsWith(bytes, WEBP, 8)) return "image/webp"
  if (startsWith(bytes, FTYP, 4) && AVIF.some((brand) => startsWith(bytes, brand, 8))) return "image/avif"
  if (startsWith(bytes, ICO) && ((bytes[4] ?? 0) | ((bytes[5] ?? 0) << 8)) > 0) return "image/x-icon"
  if (SVG.test(new TextDecoder().decode(bytes.subarray(0, SVG_SNIFF_BYTES)))) return "image/svg+xml"
  return null
}

/**
 * A picture that could not be had. The message names the host and never the link (a link of Notion's carries a signature). `retryable`:
 * asking again later may work (the host is down or slow, or asks to wait), as opposed to the link being refused or not a picture.
 */
export class PictureError extends Error {
  readonly retryable: boolean
  constructor(message: string, retryable: boolean) {
    super(message)
    this.name = "PictureError"
    this.retryable = retryable
  }
}

export type PictureOptions = {
  /** Defaults to the global `fetch`. */
  fetch?: typeof fetch
  /** `PICTURE_TIMEOUT_MS` by default. */
  timeoutMs?: number
  /** One limit for several downloads (a page and the icons it names), in place of `timeoutMs` for each. */
  signal?: AbortSignal
  /** `MAX_PICTURE_BYTES` by default. */
  maxBytes?: number
  /** Sent as `User-Agent` when given, the only header besides `Accept`: a site that turns a nameless client away is told who asks. */
  userAgent?: string
}

export type Picture = { bytes: Uint8Array<ArrayBuffer>; type: string }

/** What a download is: what it asks for (`Accept`), what its messages call it, and whether a body that is too long is cut (a page, of which the head is all that is wanted) or refused (a picture). */
type Kind = { accept: string; noun: string; truncate?: boolean }
const PICTURE: Kind = { accept: "image/*", noun: "picture" }
/** The page of a site: the links to its icons are in its head, so it is read as far as `maxBytes` and no further. */
export const PAGE: Kind = { accept: "text/html,application/xhtml+xml", noun: "page", truncate: true }

const REDIRECTS = new Set([301, 302, 303, 307, 308])

const failure = (error: unknown) => (error instanceof Error ? error.name : "unknown error")

/**
 * Downloads what is at a link, a picture or a page (`kind`). The link is checked with `allowedUrl`, and so is every redirect it leads
 * to (followed by hand, `MAX_REDIRECTS` at most, so that a host cannot send the server somewhere `allowedUrl` refuses). One time limit
 * covers the whole download, the size is capped while the body streams, and no header of the caller's goes along but `Accept` and,
 * when it is given, `User-Agent` (no token ever reaches a picture host). `url` is where the redirects ended, which is what a
 * relative link of a page is relative to. Fails with a `PictureError`, and only with one.
 */
export async function download(link: string, kind: Kind, options: PictureOptions = {}): Promise<{ bytes: Uint8Array<ArrayBuffer>; url: URL }> {
  const doFetch = options.fetch ?? fetch
  const signal = options.signal ?? AbortSignal.timeout(options.timeoutMs ?? PICTURE_TIMEOUT_MS)
  const headers = { Accept: kind.accept, ...(options.userAgent ? { "User-Agent": options.userAgent } : {}) }
  let url = allowedUrl(link)
  if (!url) throw new PictureError(`The link of the ${kind.noun} is not one the server follows`, false)
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    let response: Response
    try {
      response = await doFetch(url.href, { redirect: "manual", cache: "no-store", signal, headers })
    } catch (error) {
      throw new PictureError(`${url.host} could not be reached (${failure(error)})`, true)
    }
    if (REDIRECTS.has(response.status)) {
      void response.body?.cancel()
      const location = response.headers.get("location")
      if (!location) throw new PictureError(`${url.host} redirected without saying where`, false)
      const next = allowedUrl(location, url)
      if (!next) throw new PictureError(`${url.host} redirected to a place the server does not follow`, false)
      url = next
      continue
    }
    if (!response.ok) {
      void response.body?.cancel()
      throw new PictureError(`${url.host} answered ${response.status}`, response.status === 408 || response.status === 429 || response.status >= 500)
    }
    return { bytes: await readBody(response, url, kind, options.maxBytes ?? MAX_PICTURE_BYTES), url }
  }
  throw new PictureError(`${url.host} redirected more than ${MAX_REDIRECTS} times`, false)
}

/** Downloads the picture at a link: what `download` does, and what comes must be a picture (`sniff`). */
export async function fetchPicture(link: string, options: PictureOptions = {}): Promise<Picture> {
  const { bytes, url } = await download(link, PICTURE, options)
  const type = sniff(bytes)
  if (!type) throw new PictureError(`${url.host} sent something that is not a picture`, false)
  return { bytes, type }
}

async function readBody(response: Response, url: URL, { noun, truncate }: Kind, maxBytes: number): Promise<Uint8Array<ArrayBuffer>> {
  const tooBig = () => new PictureError(`${url.host} sent a ${noun} over ${maxBytes} bytes`, false)
  const declared = Number(response.headers.get("content-length"))
  if (!truncate && Number.isFinite(declared) && declared > maxBytes) {
    void response.body?.cancel()
    throw tooBig()
  }
  const reader = response.body?.getReader()
  if (!reader) throw new PictureError(`${url.host} sent no ${noun}`, false)
  const chunks: Uint8Array[] = []
  let size = 0
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > maxBytes) {
        void reader.cancel()
        if (!truncate) throw tooBig()
        // A page is read as far as it is wanted: what is over is not kept
        chunks.push(value.subarray(0, value.byteLength - (size - maxBytes)))
        size = maxBytes
        break
      }
      chunks.push(value)
    }
  } catch (error) {
    if (error instanceof PictureError) throw error
    throw new PictureError(`${url.host} stopped sending the ${noun} (${failure(error)})`, true)
  }
  if (size === 0) throw new PictureError(`${url.host} sent an empty file`, false)
  const bytes = new Uint8Array(size)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  }
  return bytes
}
