import { describe, expect, it, vi } from "vitest"
import { FAVICON_TIMEOUT_MS, MAX_ICON_BYTES, MAX_PAGE_BYTES, MAX_TRIES, USER_AGENT, fetchFavicon, iconLinks, rank, type IconLink } from "./favicon"
import { PictureError } from "./picture"
import { fakeWeb, htmlResponse, pictureBytes, pictureResponse, type HostHandler } from "./testing"

const BASE = new URL("https://libellud.example/")
const hrefs = (html: string, base = BASE) => iconLinks(html, base).map((link) => link.url.href)

describe("iconLinks", () => {
  it.each([
    ["an icon", '<link rel="icon" href="/a.png">'],
    ["a shortcut icon", '<link rel="shortcut icon" href="/a.png">'],
    ["an icon in capitals", '<LINK REL="ICON" HREF="/a.png">'],
    ["an alternate icon", '<link rel="alternate icon" href="/a.png">'],
    ["an apple-touch-icon", '<link rel="apple-touch-icon" href="/a.png">'],
    ["an apple-touch-icon-precomposed", '<link rel="apple-touch-icon-precomposed" href="/a.png">'],
    ["single quotes", "<link rel='icon' href='/a.png'>"],
    ["no quotes", "<link rel=icon href=/a.png>"],
    ["a tag over several lines", '<link\n  rel="icon"\n  type="image/png"\n  href="/a.png"\n/>'],
    ["the attributes the other way round", '<link href="/a.png" rel="icon">'],
  ])("finds %s", (_name, html) => {
    expect(hrefs(html)).toEqual(["https://libellud.example/a.png"])
  })

  it.each([
    ["a style sheet", '<link rel="stylesheet" href="/a.css">'],
    ["a mask icon, which is a Safari pinned tab and not an icon", '<link rel="mask-icon" href="/a.svg">'],
    ["a preload", '<link rel="preload" as="image" href="/a.png">'],
    ["a canonical link", '<link rel="canonical" href="https://libellud.example/">'],
    ["an attribute that only ends with rel", '<link data-rel="icon" href="/a.png">'],
    ["an icon with no address", '<link rel="icon">'],
    ["an icon that is only in a comment", '<!-- <link rel="icon" href="/a.png"> -->'],
  ])("does not take %s for an icon", (_name, html) => {
    expect(hrefs(html)).toEqual([])
  })

  it("resolves a link against the address of the page, a relative one, a protocol-relative one or a whole one", () => {
    const html = '<link rel="icon" href="icon.png"><link rel="icon" href="//cdn.libellud.example/b.png"><link rel="icon" href="https://static.example.org/c.png">'
    expect(hrefs(html, new URL("https://libellud.example/fr/games/"))).toEqual([
      "https://libellud.example/fr/games/icon.png",
      "https://cdn.libellud.example/b.png",
      "https://static.example.org/c.png",
    ])
  })

  it.each([
    ["an icon written in the page (data:)", '<link rel="icon" href="data:image/svg+xml,<svg/>">'],
    ["a plain http one", '<link rel="icon" href="http://libellud.example/a.png">'],
    ["an address", '<link rel="icon" href="https://192.168.1.10/a.png">'],
    ["the address of a cloud's metadata", '<link rel="icon" href="https://169.254.169.254/a.png">'],
    ["localhost", '<link rel="icon" href="https://localhost/a.png">'],
    ["a name of a local network", '<link rel="icon" href="https://nas.local/a.png">'],
    ["a port of its own", '<link rel="icon" href="https://libellud.example:8443/a.png">'],
    ["a script", '<link rel="icon" href="javascript:alert(1)">'],
  ])("leaves out %s: the server does not follow it", (_name, html) => {
    expect(hrefs(html)).toEqual([])
  })

  it("reads the entities of an address", () => {
    expect(hrefs('<link rel="icon" href="/a.png?v=1&amp;w=2">')).toEqual(["https://libellud.example/a.png?v=1&w=2"])
  })

  it("lists the icons in the order of the page", () => {
    expect(hrefs('<link rel="icon" href="/1.png"><link rel="apple-touch-icon" href="/2.png"><link rel="icon" href="/3.png">')).toEqual([
      "https://libellud.example/1.png",
      "https://libellud.example/2.png",
      "https://libellud.example/3.png",
    ])
  })

  it.each([
    ['sizes="32x32"', 32],
    ['sizes="16x16 32x32 48x48"', 48],
    ['sizes="192X192"', 192],
    ['sizes="16x32"', 16],
    ["", null],
    ['sizes=""', null],
    ['sizes="small"', null],
  ])("reads %s as a size of %s", (sizes, size) => {
    expect(iconLinks(`<link rel="icon" href="/a.png" ${sizes}>`, BASE)[0]?.size).toBe(size)
  })

  it.each([
    ["sizes any", '<link rel="icon" href="/a" sizes="any">'],
    ["an SVG type", '<link rel="icon" href="/a" type="image/svg+xml">'],
    ["an SVG address", '<link rel="icon" href="/a.SVG">'],
  ])("knows a scalable icon by %s", (_name, html) => {
    expect(iconLinks(html, BASE)[0]?.scalable).toBe(true)
  })

  it("knows an apple-touch-icon", () => {
    expect(iconLinks('<link rel="apple-touch-icon" href="/a.png">', BASE)[0]).toMatchObject({ apple: true, scalable: false })
    expect(iconLinks('<link rel="icon" href="/a.png">', BASE)[0]?.apple).toBe(false)
  })
})

describe("rank", () => {
  const link = (overrides: Partial<IconLink>): IconLink => ({ url: BASE, size: null, scalable: false, apple: false, ...overrides })

  it("prefers a picture that is a little bigger than the icon is drawn, the nearest to 64 pixels first, then a scalable one, an apple-touch-icon, a bigger picture, one with no size, and the smallest last", () => {
    const ordered = [
      link({ size: 64 }),
      link({ size: 48 }),
      link({ size: 32 }),
      link({ size: 128 }),
      link({ scalable: true }),
      link({ apple: true }),
      link({ size: 512 }),
      link({ size: null }),
      link({ size: 16 }),
    ]
    const ranks = ordered.map(rank)
    expect(ranks).toEqual([...ranks].sort((a, b) => a - b))
    expect(new Set(ranks).size).toBe(ranks.length)
  })
})

describe("fetchFavicon", () => {
  const SITE = "libellud.example"
  const notFound = () => new Response("Not found", { status: 404 })

  /** A web where the site of the publisher is `site` and nobody else is. */
  const web = (site: HostHandler, hosts: Record<string, HostHandler> = {}) => fakeWeb({ [SITE]: site, ...hosts })
  const icons = (...entries: [string, () => Response][]): HostHandler => {
    const table = new Map(entries)
    return (url) => table.get(url.pathname)?.() ?? notFound()
  }
  const paths = (w: ReturnType<typeof web>) => w.requests.map((request) => new URL(request.url).pathname)

  it("takes the best icon the page links to, and stops there", async () => {
    const w = web(
      icons(
        ["/", () => htmlResponse('<link rel="icon" href="/16.png" sizes="16x16"><link rel="icon" href="/64.png" sizes="64x64"><link rel="apple-touch-icon" href="/180.png">')],
        ["/64.png", () => pictureResponse("png")],
        ["/16.png", () => pictureResponse("jpeg")],
      ),
    )
    const icon = await fetchFavicon(`https://${SITE}/`, { fetch: w.fetch })
    expect(icon).toEqual({ bytes: pictureBytes("png"), type: "image/png" })
    expect(paths(w)).toEqual(["/", "/64.png"])
  })

  it("goes on with the next icon when one cannot be had, or is not a picture", async () => {
    const w = web(
      icons(
        ["/", () => htmlResponse('<link rel="icon" href="/gone.png" sizes="64x64"><link rel="icon" href="/page.png" sizes="48x48"><link rel="icon" href="/ok.png" sizes="32x32">')],
        ["/page.png", () => new Response(new TextEncoder().encode("<html>Sign in</html>"), { headers: { "content-type": "image/png" } })],
        ["/ok.png", () => pictureResponse("gif")],
      ),
    )
    expect((await fetchFavicon(`https://${SITE}/`, { fetch: w.fetch })).type).toBe("image/gif")
    expect(paths(w)).toEqual(["/", "/gone.png", "/page.png", "/ok.png"])
  })

  it("falls back on /favicon.ico when the page names no icon, and knows an ICO", async () => {
    const w = web(icons(["/", () => htmlResponse("")], ["/favicon.ico", () => pictureResponse("ico")]))
    expect(await fetchFavicon(`https://${SITE}/`, { fetch: w.fetch })).toEqual({ bytes: pictureBytes("ico"), type: "image/x-icon" })
    expect(paths(w)).toEqual(["/", "/favicon.ico"])
  })

  it("falls back on /favicon.ico when the page cannot be had at all", async () => {
    const w = web(icons(["/favicon.ico", () => pictureResponse("png")]))
    expect((await fetchFavicon(`https://${SITE}/deep/page`, { fetch: w.fetch })).type).toBe("image/png")
    expect(paths(w)).toEqual(["/deep/page", "/favicon.ico"])
  })

  it("asks for /favicon.ico last, once, even when the page names it too", async () => {
    const w = web(icons(["/", () => htmlResponse('<link rel="icon" href="/favicon.ico">')], ["/favicon.ico", notFound]))
    await expect(fetchFavicon(`https://${SITE}/`, { fetch: w.fetch })).rejects.toBeInstanceOf(PictureError)
    expect(paths(w)).toEqual(["/", "/favicon.ico"])
  })

  it(`tries ${MAX_TRIES} icons at most`, async () => {
    const links = Array.from({ length: 8 }, (_, index) => `<link rel="icon" href="/${index}.png" sizes="${32 + index}x${32 + index}">`).join("")
    const w = web(icons(["/", () => htmlResponse(links)]))
    await expect(fetchFavicon(`https://${SITE}/`, { fetch: w.fetch })).rejects.toBeInstanceOf(PictureError)
    expect(paths(w)).toHaveLength(1 + MAX_TRIES)
  })

  it("follows a redirect of the page, and a relative icon is relative to where it ended", async () => {
    const w = web(
      (url) => (url.pathname === "/" ? new Response(null, { status: 301, headers: { location: "https://www.libellud.example/fr/" } }) : notFound()),
      {
        "www.libellud.example": icons(["/fr/", () => htmlResponse('<link rel="icon" href="icon.png">')], ["/fr/icon.png", () => pictureResponse("png")]),
      },
    )
    expect((await fetchFavicon(`https://${SITE}/`, { fetch: w.fetch })).type).toBe("image/png")
    expect(w.requests.map((request) => new URL(request.url).href)).toEqual(["https://libellud.example/", "https://www.libellud.example/fr/", "https://www.libellud.example/fr/icon.png"])
  })

  it("asks for a page that the row writes with http over https", async () => {
    const w = web(icons(["/", () => htmlResponse('<link rel="icon" href="/a.png">')], ["/a.png", () => pictureResponse("png")]))
    await fetchFavicon(`http://${SITE}/`, { fetch: w.fetch })
    expect(w.requests.every((request) => request.url.startsWith("https://"))).toBe(true)
  })

  it("sends a name and what it accepts, and nothing else", async () => {
    const w = web(icons(["/", () => htmlResponse('<link rel="icon" href="/a.png">')], ["/a.png", () => pictureResponse("png")]))
    await fetchFavicon(`https://${SITE}/`, { fetch: w.fetch })
    const sent = w.requests.map((request) => request.init.headers as Record<string, string>)
    expect(sent.map((headers) => Object.keys(headers).sort())).toEqual([["Accept", "User-Agent"], ["Accept", "User-Agent"]])
    expect(sent.map((headers) => headers["User-Agent"])).toEqual([USER_AGENT, USER_AGENT])
    expect(sent.map((headers) => headers.Accept)).toEqual(["text/html,application/xhtml+xml", "image/*"])
  })

  it("leaves out an icon the server does not follow: only the places it may go to are asked", async () => {
    const w = web(
      icons(
        ["/", () => htmlResponse('<link rel="icon" href="https://169.254.169.254/latest/meta-data/"><link rel="icon" href="https://localhost/a.png"><link rel="icon" href="http://libellud.example/b.png">')],
        ["/favicon.ico", () => pictureResponse("ico")],
      ),
    )
    expect((await fetchFavicon(`https://${SITE}/`, { fetch: w.fetch })).type).toBe("image/x-icon")
    expect(paths(w)).toEqual(["/", "/favicon.ico"])
  })

  it("follows no redirect of an icon to a place the server does not follow", async () => {
    const w = web(
      icons(
        ["/", () => htmlResponse('<link rel="icon" href="/a.png">')],
        ["/a.png", () => new Response(null, { status: 302, headers: { location: "https://192.168.1.10/secret.png" } })],
      ),
    )
    await expect(fetchFavicon(`https://${SITE}/`, { fetch: w.fetch })).rejects.toBeInstanceOf(PictureError)
    expect(w.requests.map((request) => new URL(request.url).host)).not.toContain("192.168.1.10")
  })

  it.each(["https://127.0.0.1/", "https://localhost/", "https://nas.local/", "https://libellud.example:8443/", "not a website", ""])("does not even ask for the website %j", async (site) => {
    const w = web(icons())
    const error = await fetchFavicon(site, { fetch: w.fetch }).catch((reason: unknown) => reason)
    expect(error).toBeInstanceOf(PictureError)
    expect((error as PictureError).retryable).toBe(false)
    expect(w.requests).toEqual([])
  })

  describe("when there is no icon", () => {
    it("says so for good when the site answered and has nothing the server can use", async () => {
      const w = web(icons(["/", () => htmlResponse("")]))
      const error = await fetchFavicon(`https://${SITE}/`, { fetch: w.fetch }).catch((reason: unknown) => reason)
      expect(error).toBeInstanceOf(PictureError)
      expect((error as PictureError).retryable).toBe(false)
      expect((error as PictureError).message).toBe(`${SITE} has no icon the server can use (${SITE} answered 404)`)
    })

    it("says it may be there another time when nobody could be reached", async () => {
      const error = await fetchFavicon(`https://${SITE}/`, { fetch: fakeWeb().fetch }).catch((reason: unknown) => reason)
      expect((error as PictureError).retryable).toBe(true)
      expect((error as PictureError).message).toContain(`${SITE} could not be reached`)
    })

    it("says it may be there another time when the site is slow, within one limit for all it was asked", async () => {
      // A host that never answers, and a fetch that fails at once on a signal that has gone off already, as the real one does
      const silent = vi.fn<typeof fetch>(
        (_input, init) =>
          new Promise<Response>((_resolve, reject) => {
            const signal = init?.signal
            if (signal?.aborted) return reject(signal.reason)
            signal?.addEventListener("abort", () => reject(signal.reason))
          }),
      )
      const started = Date.now()
      const error = await fetchFavicon(`https://${SITE}/`, { fetch: silent, timeoutMs: 30 }).catch((reason: unknown) => reason)
      expect((error as PictureError).retryable).toBe(true)
      expect(Date.now() - started).toBeLessThan(1000)
    })

    it("is not retried for a page that answers 404 while its icon does not exist either", async () => {
      const w = web(() => notFound())
      const error = await fetchFavicon(`https://${SITE}/`, { fetch: w.fetch }).catch((reason: unknown) => reason)
      expect((error as PictureError).retryable).toBe(false)
    })
  })

  describe("the size", () => {
    it("reads a page as far as its limit and no further: an icon named after that is not seen", async () => {
      const filler = `<!-- ${"x".repeat(MAX_PAGE_BYTES)} -->`
      const w = web(icons(["/", () => htmlResponse(`<link rel="icon" href="/before.png">${filler}<link rel="icon" href="/after.png">`)], ["/before.png", () => pictureResponse("png")]))
      expect((await fetchFavicon(`https://${SITE}/`, { fetch: w.fetch })).type).toBe("image/png")
      expect(paths(w)).toEqual(["/", "/before.png"])
    })

    it("does not fail on a page that is longer than that: the head is all that is wanted", async () => {
      const w = web(icons(["/", () => htmlResponse(`<link rel="icon" href="/a.png"><body>${"x".repeat(MAX_PAGE_BYTES * 2)}</body>`)], ["/a.png", () => pictureResponse("png")]))
      await expect(fetchFavicon(`https://${SITE}/`, { fetch: w.fetch })).resolves.toMatchObject({ type: "image/png" })
    })

    it("refuses an icon that is over its limit", async () => {
      const w = web(icons(["/", () => htmlResponse('<link rel="icon" href="/big.png">')], ["/big.png", () => new Response(pictureBytes("png", MAX_ICON_BYTES + 1))]))
      await expect(fetchFavicon(`https://${SITE}/`, { fetch: w.fetch })).rejects.toBeInstanceOf(PictureError)
    })

    it("has limits that fit a favicon, and a time shorter than what a function may run", () => {
      expect(MAX_ICON_BYTES).toBeLessThanOrEqual(1024 * 1024)
      expect(MAX_PAGE_BYTES).toBeLessThanOrEqual(1024 * 1024)
      expect(FAVICON_TIMEOUT_MS).toBeLessThanOrEqual(10_000)
    })
  })
})
