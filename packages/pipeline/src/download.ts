// The one file the command fetches itself: the rulebook of a game, from the address the scout found and the owner validated at its gate (`edition.rules.url`). The agent of a step
// downloads nothing (it reads web pages, so its calls are bounded to what its skill needs), and the command does it for the one address a person has approved, to a file that is data and
// nothing else: it is kept only if it is a PDF, it is never run, and it is never put over a file that is there already (the owner's own). The fetch is bounded the way a command that is
// given an address must be: https and its own port only, a host that resolves to public addresses only (each hop of a redirect judged again, the address that was judged is the one
// that is connected to), a size, a time, a PDF that is whole. Everything the network touches is passed in (`Transport`, `Resolver`), so that a test reaches no network.
import { lookup as dnsLookup } from "node:dns/promises"
import { existsSync, mkdirSync, renameSync, rmSync, writeFileSync } from "node:fs"
import { request } from "node:https"
import { BlockList, isIP } from "node:net"
import { dirname } from "node:path"

/** What a fetch said it could not do, in a sentence for the owner. */
export class DownloadError extends Error {}

export const MAX_BYTES = 60 * 1024 * 1024
export const MAX_REDIRECTS = 5
export const TIMEOUT_MS = 90_000
const MAX_URL = 2_000

// ---------- which addresses are public ----------

/** What a host must never resolve to: this network, private and shared ranges, loopback, link-local, multicast, reserved, documentation, and the IPv6 ranges that hold an IPv4 address. */
const NOT_PUBLIC = new BlockList()
for (const [network, prefix] of [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.88.99.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
] as const) {
  NOT_PUBLIC.addSubnet(network, prefix, "ipv4")
}
NOT_PUBLIC.addAddress("::", "ipv6")
NOT_PUBLIC.addAddress("::1", "ipv6")
for (const [network, prefix] of [
  ["64:ff9b::", 96],
  ["100::", 64],
  ["2001::", 32],
  ["2001:db8::", 32],
  ["2002::", 16],
  ["fc00::", 7],
  ["fe80::", 10],
  ["ff00::", 8],
] as const) {
  NOT_PUBLIC.addSubnet(network, prefix, "ipv6")
}

/** Whether an address is one of the public internet: an IP, and none of the ranges above (an IPv6 address that holds an IPv4 one is judged as that IPv4 address). */
export function isPublicAddress(address: string): boolean {
  const family = isIP(address)
  if (family === 0) return false
  return !NOT_PUBLIC.check(address, family === 4 ? "ipv4" : "ipv6")
}

// ---------- the network, passed in ----------

export type Resolved = { address: string; family: number }
/** The addresses of a host. */
export type Resolver = (hostname: string) => Promise<Resolved[]>
export type Reply = { status: number; headers: Record<string, string | string[] | undefined>; body: AsyncIterable<Uint8Array>; destroy: () => void }
/** One GET of an address, connecting to the address it is given (not to what the name resolves to now). */
export type Transport = (url: URL, target: Resolved, signal: AbortSignal) => Promise<Reply>

const resolveAll: Resolver = async (hostname) => (await dnsLookup(hostname, { all: true, verbatim: true })).map(({ address, family }) => ({ address, family }))

type Lookup = (hostname: string, options: { all?: boolean }, callback: (error: Error | null, address: string | { address: string; family: number }[], family?: number) => void) => void

/** The lookup of a connection that goes to the address that was judged, whatever the name says when the socket is made. */
export function pinned(target: Resolved): Lookup {
  return (_hostname, options, callback) => {
    if (options.all) callback(null, [{ address: target.address, family: target.family }])
    else callback(null, target.address, target.family)
  }
}

const httpsTransport: Transport = (url, target, signal) =>
  new Promise((resolve, reject) => {
    const req = request(url, { method: "GET", headers: { accept: "application/pdf,*/*;q=0.5", "user-agent": "pbgo-add-game" }, lookup: pinned(target), signal }, (res) => {
      resolve({ status: res.statusCode ?? 0, headers: res.headers, body: res, destroy: () => res.destroy() })
    })
    req.on("error", reject)
    req.end()
  })

// ---------- the address ----------

/** The address as a URL that may be fetched: https, its own port, no credentials, a name of a host (not an IP), not a wall of text. */
export function fetchableUrl(text: string): URL {
  if (text.length > MAX_URL) throw new DownloadError("the address is too long")
  let url: URL
  try {
    url = new URL(text)
  } catch {
    throw new DownloadError(`${text.slice(0, 80)} is not an address`)
  }
  if (url.protocol !== "https:") throw new DownloadError(`${url.protocol}// is not https`)
  if (url.port !== "" && url.port !== "443") throw new DownloadError(`port ${url.port} is not the port of https`)
  if (url.username !== "" || url.password !== "") throw new DownloadError("the address has a user and a password in it")
  if (!url.hostname.includes(".") || isIP(url.hostname) !== 0 || url.hostname.startsWith("[")) throw new DownloadError(`${url.hostname} is not the name of a host`)
  return url
}

// ---------- the file ----------

const concat = (chunks: Uint8Array[]): Buffer => Buffer.concat(chunks)

/** What a PDF starts and ends with: the file is kept if it has both (a connection that was cut leaves no end). */
function pdfProblem(bytes: Buffer): string | null {
  if (bytes.length < 8 || bytes.subarray(0, 5).toString("latin1") !== "%PDF-") return "is not a PDF (it does not start with %PDF-)"
  if (!bytes.subarray(Math.max(0, bytes.length - 4096)).toString("latin1").includes("%%EOF")) return "looks cut short (a PDF ends with %%EOF)"
  return null
}

export type DownloadOptions = { resolve?: Resolver; transport?: Transport; maxBytes?: number; maxRedirects?: number; timeoutMs?: number }

/**
 * Fetches a PDF into `dest`. The file is written whole under another name and renamed, so there is never half a file; an existing `dest` is never replaced (it is the owner's, or an earlier
 * fetch). Resolves to the number of bytes kept, or throws a `DownloadError` that says why nothing was kept.
 */
export async function downloadPdf(address: string, dest: string, options: DownloadOptions = {}): Promise<number> {
  const { resolve = resolveAll, transport = httpsTransport, maxBytes = MAX_BYTES, maxRedirects = MAX_REDIRECTS, timeoutMs = TIMEOUT_MS } = options
  if (existsSync(dest)) throw new DownloadError(`${dest} is there already: it is kept`)
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  const temporary = `${dest}.${process.pid}.part`
  try {
    let url = fetchableUrl(address)
    for (let hop = 0; ; hop += 1) {
      const resolved = await resolve(url.hostname).catch(() => {
        throw new DownloadError(`${url.hostname} cannot be resolved`)
      })
      if (resolved.length === 0 || resolved.some((entry) => !isPublicAddress(entry.address))) throw new DownloadError(`${url.hostname} does not resolve to a public address only: it is not fetched`)
      const target = resolved[0] as Resolved
      const reply = await transport(url, target, controller.signal)
      if (reply.status >= 300 && reply.status < 400) {
        reply.destroy()
        const location = reply.headers.location
        if (typeof location !== "string" || location === "") throw new DownloadError(`${url.hostname} redirects to nowhere`)
        if (hop >= maxRedirects) throw new DownloadError(`more than ${maxRedirects} redirects`)
        url = fetchableUrl(new URL(location, url).href)
        continue
      }
      if (reply.status !== 200) {
        reply.destroy()
        throw new DownloadError(`${url.hostname} answered ${reply.status}`)
      }
      const length = Number(reply.headers["content-length"])
      if (Number.isFinite(length) && length > maxBytes) {
        reply.destroy()
        throw new DownloadError(`the file is ${Math.round(length / 1024 / 1024)} MB, ${Math.round(maxBytes / 1024 / 1024)} MB at the most`)
      }
      const chunks: Uint8Array[] = []
      let bytes = 0
      for await (const chunk of reply.body) {
        bytes += chunk.length
        if (bytes > maxBytes) {
          reply.destroy()
          throw new DownloadError(`the file is more than ${Math.round(maxBytes / 1024 / 1024)} MB`)
        }
        chunks.push(chunk)
      }
      const file = concat(chunks)
      const problem = pdfProblem(file)
      if (problem) throw new DownloadError(`${url.hostname}${url.pathname.length > 40 ? "/…" : url.pathname} ${problem}`)
      if (Number.isFinite(length) && length !== file.length) throw new DownloadError(`the file is cut short (${file.length} bytes of ${length})`)
      mkdirSync(dirname(dest), { recursive: true })
      writeFileSync(temporary, file)
      renameSync(temporary, dest)
      return file.length
    }
  } catch (error) {
    if (error instanceof DownloadError) throw error
    if (controller.signal.aborted) throw new DownloadError(`no answer in ${Math.round(timeoutMs / 1000)} s`)
    throw new DownloadError(error instanceof Error ? error.message.slice(0, 160) : "the fetch failed")
  } finally {
    clearTimeout(timer)
    rmSync(temporary, { force: true })
  }
}
