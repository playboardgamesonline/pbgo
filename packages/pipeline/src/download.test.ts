import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { DownloadError, downloadPdf, fetchableUrl, isPublicAddress, pinned, type Reply, type Resolved, type Resolver, type Transport } from "./download.ts"

// The fetch of the rulebook, with no network: the names are resolved and the replies come from tables of the test. What it must hold to is what a command that is given an address
// must hold to: the address, the host it resolves to, the redirects, the size, the time, and a file that is a whole PDF.
const pdf = (size = 200): Buffer => Buffer.concat([Buffer.from("%PDF-1.4\n"), Buffer.alloc(size, "a"), Buffer.from("\n%%EOF\n")])

function reply(status: number, body: Buffer | string = "", headers: Reply["headers"] = {}): Reply {
  const chunks = [Buffer.from(body)]
  return { status, headers, body: (async function* () { yield* chunks })(), destroy: vi.fn() }
}

/** A transport answering from a table of `https://host/path` to a reply, and remembering what it was asked. */
function network(routes: Record<string, () => Reply>) {
  const asked: { url: string; target: Resolved }[] = []
  const transport: Transport = async (url, target) => {
    asked.push({ url: url.href, target })
    const route = routes[url.href]
    if (!route) throw new Error(`no route for ${url.href}`)
    return route()
  }
  return { transport, asked }
}

const PUBLIC: Resolver = async () => [{ address: "93.184.216.34", family: 4 }]
const table = (hosts: Record<string, string[]>): Resolver => async (host) => (hosts[host] ?? []).map((address) => ({ address, family: address.includes(":") ? 6 : 4 }))

let folder = ""
let dest = ""
beforeEach(() => {
  folder = mkdtempSync(join(tmpdir(), "download-"))
  dest = join(folder, "game", "rules.pdf")
})
afterEach(() => {
  rmSync(folder, { recursive: true, force: true })
})

const fails = async (promise: Promise<unknown>, sentence: string | RegExp) => {
  const error = await promise.then(
    () => null,
    (caught: unknown) => caught,
  )
  expect(error).toBeInstanceOf(DownloadError)
  expect((error as Error).message).toMatch(typeof sentence === "string" ? new RegExp(sentence.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")) : sentence)
}
const leftovers = () => (existsSync(join(folder, "game")) ? readdirSync(join(folder, "game")) : [])

describe("the rulebook that is fetched", () => {
  it("is kept whole, under the name it is given, with its folder made, and nothing else left", async () => {
    const file = pdf()
    const { transport } = network({ "https://example.com/rules.pdf": () => reply(200, file, { "content-length": String(file.length) }) })
    expect(await downloadPdf("https://example.com/rules.pdf", dest, { resolve: PUBLIC, transport })).toBe(file.length)
    expect(readFileSync(dest).equals(file)).toBe(true)
    expect(leftovers()).toEqual(["rules.pdf"])
  })

  it("is fetched from the address that was judged, not from what the name resolves to when the socket is made", async () => {
    const { transport, asked } = network({ "https://example.com/rules.pdf": () => reply(200, pdf()) })
    await downloadPdf("https://example.com/rules.pdf", dest, { resolve: table({ "example.com": ["93.184.216.34", "2606:2800:220:1::1"] }), transport })
    expect(asked).toEqual([{ url: "https://example.com/rules.pdf", target: { address: "93.184.216.34", family: 4 } }])
  })

  it("is never put over a file that is there: it is the owner's, or an earlier fetch", async () => {
    writeFileSync(join(folder, "own.pdf"), "mine")
    const { transport, asked } = network({ "https://example.com/rules.pdf": () => reply(200, pdf()) })
    await fails(downloadPdf("https://example.com/rules.pdf", join(folder, "own.pdf"), { resolve: PUBLIC, transport }), "is there already")
    expect(readFileSync(join(folder, "own.pdf"), "utf8")).toBe("mine")
    expect(asked).toEqual([])
  })
})

describe("the address", () => {
  it.each([
    ["http://example.com/rules.pdf", "is not https"],
    ["ftp://example.com/rules.pdf", "is not https"],
    ["file:///etc/passwd", "is not https"],
    ["https://example.com:8443/rules.pdf", "port 8443"],
    ["https://user:secret@example.com/rules.pdf", "a user and a password"],
    ["https://localhost/rules.pdf", "is not the name of a host"],
    ["https://intranet/rules.pdf", "is not the name of a host"],
    ["https://127.0.0.1/rules.pdf", "is not the name of a host"],
    ["https://169.254.169.254/latest/meta-data", "is not the name of a host"],
    ["https://[::1]/rules.pdf", "is not the name of a host"],
    ["https://[fe80::1]/rules.pdf", "is not the name of a host"],
    ["https://2130706433/rules.pdf", "is not the name of a host"],
    ["rules.pdf", "is not an address"],
    ["", "is not an address"],
    [`https://example.com/${"a".repeat(2_100)}`, "too long"],
  ])("%j is refused: %s", async (address, sentence) => {
    const { transport, asked } = network({})
    await fails(downloadPdf(address, dest, { resolve: PUBLIC, transport }), sentence)
    expect(asked).toEqual([])
    expect(leftovers()).toEqual([])
  })

  it("is read as a URL: the https port, the path and the query are kept", () => {
    expect(fetchableUrl("https://example.com:443/a/b.pdf?x=1").href).toBe("https://example.com/a/b.pdf?x=1")
    expect(fetchableUrl("HTTPS://Example.COM/a").hostname).toBe("example.com")
  })
})

describe("the host", () => {
  it.each([
    ["127.0.0.1"],
    ["10.1.2.3"],
    ["172.16.0.5"],
    ["192.168.1.20"],
    ["169.254.169.254"],
    ["100.64.0.1"],
    ["0.0.0.0"],
    ["224.0.0.251"],
    ["::1"],
    ["fe80::1"],
    ["fd12:3456:789a::1"],
    ["::ffff:127.0.0.1"],
    ["::ffff:10.0.0.1"],
  ])("is not fetched when it resolves to %s", async (address) => {
    const { transport, asked } = network({})
    await fails(downloadPdf("https://example.com/rules.pdf", dest, { resolve: table({ "example.com": [address] }), transport }), "does not resolve to a public address only")
    expect(asked).toEqual([])
  })

  it("is not fetched when one of its addresses is not public, whichever comes first (a name that answers with a mix)", async () => {
    for (const mix of [["93.184.216.34", "10.0.0.1"], ["10.0.0.1", "93.184.216.34"]]) {
      const { transport, asked } = network({})
      await fails(downloadPdf("https://example.com/rules.pdf", dest, { resolve: table({ "example.com": mix }), transport }), "public address only")
      expect(asked).toEqual([])
    }
  })

  it("is not fetched when it cannot be resolved, or resolves to nothing", async () => {
    const { transport } = network({})
    await fails(downloadPdf("https://example.com/rules.pdf", dest, { resolve: async () => Promise.reject(new Error("ENOTFOUND")), transport }), "cannot be resolved")
    await fails(downloadPdf("https://example.com/rules.pdf", dest, { resolve: table({}), transport }), "public address only")
  })
})

describe("the public addresses", () => {
  it.each(["8.8.8.8", "1.1.1.1", "93.184.216.34", "172.15.255.255", "172.32.0.1", "100.63.255.255", "2606:4700:4700::1111", "2a00:1450:4007:80b::200e", "::ffff:8.8.8.8"])("%s is public", (address) => {
    expect(isPublicAddress(address)).toBe(true)
  })

  it.each([
    "127.0.0.1", "127.255.255.254", "10.0.0.1", "10.255.255.255", "172.16.0.1", "172.31.255.255", "192.168.0.1", "169.254.169.254", "100.64.0.1", "100.127.255.255", "0.0.0.0", "0.1.2.3",
    "192.0.2.1", "198.51.100.7", "203.0.113.9", "198.18.0.1", "224.0.0.1", "239.255.255.250", "240.0.0.1", "255.255.255.255",
    "::", "::1", "fe80::1", "febf::1", "fc00::1", "fdff::1", "ff02::1", "2001:db8::1", "64:ff9b::7f00:1", "2002:7f00:1::", "2001:0:4136:e378::1", "::ffff:127.0.0.1", "::ffff:7f00:1", "::ffff:10.0.0.1", "::ffff:192.168.1.1",
    "", "not an ip", "127.1", "0x7f.0.0.1", "2130706433", "1.2.3", "::g",
  ])("%j is not", (address) => {
    expect(isPublicAddress(address)).toBe(false)
  })
})

describe("the redirects", () => {
  it("are followed, each host judged again and each address connected to as it was judged", async () => {
    const { transport, asked } = network({
      "https://short.example/r": () => reply(302, "", { location: "https://cdn.example.net/files/rules.pdf" }),
      "https://cdn.example.net/files/rules.pdf": () => reply(200, pdf()),
    })
    const resolve = table({ "short.example": ["93.184.216.34"], "cdn.example.net": ["151.101.1.69"] })
    await downloadPdf("https://short.example/r", dest, { resolve, transport })
    expect(asked.map((entry) => [entry.url, entry.target.address])).toEqual([
      ["https://short.example/r", "93.184.216.34"],
      ["https://cdn.example.net/files/rules.pdf", "151.101.1.69"],
    ])
  })

  it("may be relative to the address that sent them", async () => {
    const { transport, asked } = network({
      "https://example.com/a/old.pdf": () => reply(301, "", { location: "../new/rules.pdf" }),
      "https://example.com/new/rules.pdf": () => reply(200, pdf()),
    })
    await downloadPdf("https://example.com/a/old.pdf", dest, { resolve: PUBLIC, transport })
    expect(asked.map((entry) => entry.url)).toEqual(["https://example.com/a/old.pdf", "https://example.com/new/rules.pdf"])
  })

  it("never lead to a host that is not public, to http, to another port, to nowhere, or round and round", async () => {
    const resolve = table({ "example.com": ["93.184.216.34"], "internal.example": ["10.0.0.7"] })
    const go = (location: string | undefined) =>
      downloadPdf("https://example.com/r", dest, { resolve, transport: network({ "https://example.com/r": () => reply(302, "", location === undefined ? {} : { location }) }).transport })
    await fails(go("https://internal.example/rules.pdf"), "public address only")
    await fails(go("http://example.com/rules.pdf"), "is not https")
    await fails(go("https://example.com:8080/rules.pdf"), "port 8080")
    await fails(go("https://127.0.0.1/rules.pdf"), "is not the name of a host")
    await fails(go(undefined), "redirects to nowhere")
    await fails(go(""), "redirects to nowhere")
    await fails(go("https://example.com/r"), "more than 5 redirects")
    expect(leftovers()).toEqual([])
  })

  it("have a limit that can be moved", async () => {
    const hops = network({
      "https://example.com/1": () => reply(302, "", { location: "/2" }),
      "https://example.com/2": () => reply(302, "", { location: "/3" }),
      "https://example.com/3": () => reply(200, pdf()),
    })
    await fails(downloadPdf("https://example.com/1", dest, { resolve: PUBLIC, transport: hops.transport, maxRedirects: 1 }), "more than 1 redirects")
    await downloadPdf("https://example.com/1", dest, { resolve: PUBLIC, transport: hops.transport, maxRedirects: 2 })
    expect(existsSync(dest)).toBe(true)
  })
})

describe("what is kept", () => {
  const get = (response: () => Reply, options: { maxBytes?: number } = {}) => downloadPdf("https://example.com/rules.pdf", dest, { resolve: PUBLIC, transport: network({ "https://example.com/rules.pdf": response }).transport, ...options })

  it.each([404, 403, 410, 429, 500, 503, 204])("is nothing when the host answers %s", async (status) => {
    await fails(get(() => reply(status, "no")), `answered ${status}`)
    expect(leftovers()).toEqual([])
  })

  it("is nothing when it is a page, not a PDF: a rulebook that is a web page is read by the skill, not kept", async () => {
    await fails(get(() => reply(200, "<!doctype html><html><body>The rules</body></html>", { "content-type": "text/html" })), "is not a PDF")
    expect(leftovers()).toEqual([])
  })

  it("is nothing when it is cut short, or empty", async () => {
    await fails(get(() => reply(200, Buffer.concat([Buffer.from("%PDF-1.4\n"), Buffer.alloc(500, "a")]))), "looks cut short")
    await fails(get(() => reply(200, "")), "is not a PDF")
    await fails(get(() => reply(200, "%PDF")), "is not a PDF")
    expect(leftovers()).toEqual([])
  })

  it("is nothing when the length it was told is not the length it got", async () => {
    const file = pdf()
    await fails(get(() => reply(200, file, { "content-length": String(file.length + 10) })), "cut short")
    expect(leftovers()).toEqual([])
  })

  it("is nothing when it is bigger than it may be, by what the host says or by what comes", async () => {
    const big = pdf(5_000)
    await fails(get(() => reply(200, big, { "content-length": String(big.length) }), { maxBytes: 1_000 }), /MB at the most/)
    const response = reply(200, big)
    await fails(get(() => response, { maxBytes: 1_000 }), /more than \d+ MB/)
    expect(response.destroy).toHaveBeenCalled()
    expect(leftovers()).toEqual([])
  })

  it("is nothing when the host does not answer in time, and the time can be moved", async () => {
    const hang: Transport = (_url, _target, signal) => new Promise((_resolve, reject) => signal.addEventListener("abort", () => reject(new Error("aborted"))))
    await fails(downloadPdf("https://example.com/rules.pdf", dest, { resolve: PUBLIC, transport: hang, timeoutMs: 30 }), "no answer in")
    expect(leftovers()).toEqual([])
  })

  it("is nothing when the connection breaks", async () => {
    const broken: Transport = async () => ({ status: 200, headers: {}, destroy: () => undefined, body: (async function* () { yield Buffer.from("%PDF-1.4"); throw new Error("socket hang up") })() })
    await fails(downloadPdf("https://example.com/rules.pdf", dest, { resolve: PUBLIC, transport: broken }), "socket hang up")
    expect(leftovers()).toEqual([])
  })
})

describe("the connection", () => {
  it("goes to the address it is told, whether the lookup asks for one address or for all", () => {
    const lookup = pinned({ address: "93.184.216.34", family: 4 })
    const one = vi.fn()
    lookup("example.com", {}, one)
    expect(one).toHaveBeenCalledWith(null, "93.184.216.34", 4)
    const all = vi.fn()
    lookup("another-name.example", { all: true }, all)
    expect(all).toHaveBeenCalledWith(null, [{ address: "93.184.216.34", family: 4 }])
    const six = vi.fn()
    pinned({ address: "2606:4700:4700::1111", family: 6 })("example.com", { all: true }, six)
    expect(six).toHaveBeenCalledWith(null, [{ address: "2606:4700:4700::1111", family: 6 }])
  })
})
