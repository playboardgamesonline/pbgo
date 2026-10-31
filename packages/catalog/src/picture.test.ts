import { describe, expect, it, vi } from "vitest"
import { MAX_PICTURE_BYTES, MAX_REDIRECTS, PAGE, PICTURE_TIMEOUT_MS, PictureError, allowedUrl, download, fetchPicture, sniff } from "./picture"
import { type PictureKind, pictureBytes, pictureResponse, webPage } from "./testing"

const text = (value: string) => new TextEncoder().encode(value)

describe("allowedUrl", () => {
  it.each([
    ["a public https host", "https://example.com/picture.png"],
    ["Notion's own host, with its signature", "https://prod-files-secure.s3.us-west-2.amazonaws.com/a/b.png?X-Amz-Expires=3600&X-Amz-Signature=abc"],
    ["a host in capitals", "https://CDN.Example.COM/a.png"],
    ["a host with a trailing dot", "https://example.com./a.png"],
    ["an international host", "https://bücher.example/a.png"],
    ["its punycode form", "https://xn--bcher-kva.example/a.png"],
    ["the default port, written out", "https://example.com:443/a.png"],
    ["a name that only contains a forbidden one", "https://notlocalhost.example/a.png"],
    ["a name that ends like a local one", "https://my-local.example/a.png"],
  ])("follows %s", (_name, link) => {
    expect(allowedUrl(link)).not.toBeNull()
  })

  it.each([
    ["http", "http://example.com/a.png"],
    ["ftp", "ftp://example.com/a.png"],
    ["javascript:", "javascript:alert(1)"],
    ["data:", "data:image/png;base64,iVBORw0KGgo="],
    ["file:", "file:///etc/passwd"],
    ["a relative link", "/a.png"],
    ["an empty link", ""],
    ["text", "not a link"],
  ])("refuses %s", (_name, link) => {
    expect(allowedUrl(link)).toBeNull()
  })

  it.each([
    ["a user and a password", "https://user:pass@example.com/a.png"],
    ["a user alone", "https://user@example.com/a.png"],
    ["a password alone", "https://:pass@example.com/a.png"],
    ["port 8443", "https://example.com:8443/a.png"],
    ["port 444", "https://example.com:444/a.png"],
    ["port 80", "https://example.com:80/a.png"],
  ])("refuses a link with %s", (_name, link) => {
    expect(allowedUrl(link)).toBeNull()
  })

  it.each([
    "https://127.0.0.1/a.png",
    "https://10.0.0.5/a.png",
    "https://192.168.1.1/a.png",
    "https://169.254.169.254/latest/meta-data/",
    "https://8.8.8.8/a.png",
    "https://0.0.0.0/a.png",
    "https://[::1]/a.png",
    "https://[::ffff:127.0.0.1]/a.png",
    "https://[2001:db8::1]/a.png",
    "https://2130706433/a.png",
    "https://0x7f.1/a.png",
    "https://0x7f000001/a.png",
    "https://0177.0.0.1/a.png",
    "https://127.1/a.png",
  ])("refuses the address %s, however it is written", (link) => {
    expect(allowedUrl(link)).toBeNull()
  })

  it.each([
    "https://localhost/a.png",
    "https://LOCALHOST/a.png",
    "https://localhost./a.png",
    "https://localhost../a.png",
    "https://foo.localhost/a.png",
    "https://printer.local/a.png",
    "https://metadata.internal/a.png",
    "https://box.localdomain/a.png",
    "https://router.home.arpa/a.png",
    "https://home.arpa/a.png",
    "https://intranet/a.png",
  ])("refuses the name %s: it stays inside a network", (link) => {
    expect(allowedUrl(link)).toBeNull()
  })

  it.each([
    ["an empty label in the middle", "https://a..b.com/a.png"],
    ["an empty first label", "https://.example.com/a.png"],
    ["a name the parser rejects", "https://example.123/a.png"],
    ["a space in the name", "https://exa mple.com/a.png"],
  ])("refuses %s", (_name, link) => {
    expect(allowedUrl(link)).toBeNull()
  })

  describe("for a redirect", () => {
    const base = new URL("https://example.com/a/b.png")

    it("resolves a relative link against the page it came from", () => {
      expect(allowedUrl("/c.png", base)?.href).toBe("https://example.com/c.png")
      expect(allowedUrl("c.png", base)?.href).toBe("https://example.com/a/c.png")
      expect(allowedUrl("//cdn.example.net/c.png", base)?.href).toBe("https://cdn.example.net/c.png")
      expect(allowedUrl("https://cdn.example.net/c.png", base)?.href).toBe("https://cdn.example.net/c.png")
    })

    it("refuses the same targets as a link of its own: a downgrade, an address, a name that stays inside", () => {
      for (const target of ["http://example.com/c.png", "//127.0.0.1/c.png", "https://169.254.169.254/", "//localhost/c.png", "https://user:pass@example.com/c.png"]) {
        expect(allowedUrl(target, base), target).toBeNull()
      }
    })
  })
})

describe("sniff", () => {
  it.each<[PictureKind, string]>([
    ["png", "image/png"],
    ["jpeg", "image/jpeg"],
    ["gif", "image/gif"],
    ["webp", "image/webp"],
    ["avif", "image/avif"],
    ["svg", "image/svg+xml"],
    ["ico", "image/x-icon"],
  ])("knows a %s by its first bytes", (kind, type) => {
    expect(sniff(pictureBytes(kind))).toBe(type)
  })

  it("knows the other signatures of a GIF and an AVIF", () => {
    expect(sniff(text("GIF87a"))).toBe("image/gif")
    expect(sniff(Uint8Array.of(0, 0, 0, 0x20, ...text("ftypavis")))).toBe("image/avif")
  })

  describe("an SVG", () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg"></svg>'
    const doctype = '<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd">'

    it.each([
      ["bare", svg],
      ["after white space", `\n \t${svg}`],
      ["with its attributes on the next line", '<svg\n  xmlns="http://www.w3.org/2000/svg">'],
      ["with a self-closing tag", "<svg/>"],
      ["after an XML declaration", `<?xml version="1.0" encoding="UTF-8"?>\n${svg}`],
      ["after a comment", `<!-- made with a tool -->${svg}`],
      ["after a doctype", `${doctype}\n${svg}`],
      ["after all of it", `<?xml version="1.0"?>\n<!-- a -->\n${doctype}\n<!-- b -->\n${svg}`],
      ["after a BOM", `${String.fromCharCode(0xfeff)}${svg}`],
    ])("is known %s", (_name, source) => {
      expect(sniff(text(source))).toBe("image/svg+xml")
    })

    it.each([
      ["a web page with an svg in it", "<html><body><svg></svg></body></html>"],
      ["a comment that holds an svg", "<!-- <svg> -->"],
      ["an element that only starts like one", "<svgx></svgx>"],
      ["a doctype with an internal subset, on purpose: no entities", '<!DOCTYPE svg [ <!ENTITY a "b"> ]><svg></svg>'],
      ["a script before the svg", `<script>1</script>${svg}`],
      ["a closing tag", "</svg>"],
    ])("is not known in %s", (_name, source) => {
      expect(sniff(text(source))).toBeNull()
    })

    it("is only looked for in the first bytes", () => {
      expect(sniff(text(`<!-- ${"a".repeat(1000)} -->${svg}`))).toBe("image/svg+xml")
      expect(sniff(text(`<!-- ${"a".repeat(3000)} -->${svg}`))).toBeNull()
    })
  })

  it.each([
    ["a web page", webPage()],
    ["a text", text("not a picture")],
    ["nothing", new Uint8Array()],
    ["a PDF", text("%PDF-1.7\n")],
    ["a ZIP", Uint8Array.of(0x50, 0x4b, 0x03, 0x04)],
    ["a PNG cut after four bytes", pictureBytes("png").subarray(0, 4)],
    ["a JPEG cut after two bytes", pictureBytes("jpeg").subarray(0, 2)],
    ["a GIF that is cut short", text("GIF8")],
    ["a RIFF file that is not a WebP (a WAV)", Uint8Array.of(...text("RIFF"), 0, 0, 0, 0, ...text("WAVE"))],
    ["an ISO media file that is not an AVIF (an MP4)", Uint8Array.of(0, 0, 0, 0x20, ...text("ftypmp42"))],
    ["an icon header that holds no image", Uint8Array.of(0, 0, 1, 0, 0, 0)],
    ["a cursor file, which looks like an icon file and is not one", Uint8Array.of(0, 0, 2, 0, 1, 0)],
    ["four zeros", new Uint8Array(4)],
  ])("does not take %s for a picture", (_name, bytes) => {
    expect(sniff(bytes)).toBeNull()
  })
})

describe("fetchPicture", () => {
  const LINK = "https://files.example.com/secret/picture.png?X-Amz-Signature=topsecret"

  const ok = (kind: PictureKind = "png") => pictureResponse(kind, { headers: { "content-type": "image/png" } })
  const redirect = (location: string | null, status = 302) => new Response(null, { status, headers: location === null ? {} : { location } })
  const web = () => vi.fn<typeof fetch>()

  /** The error a download ends with, and only that: it is what a caller has to handle. */
  async function failure(download: Promise<unknown>): Promise<PictureError> {
    try {
      await download
    } catch (error) {
      expect(error).toBeInstanceOf(PictureError)
      return error as PictureError
    }
    throw new Error("the download was expected to fail")
  }

  it("gives the bytes and what they are", async () => {
    const fetcher = web().mockResolvedValueOnce(ok("jpeg"))
    const picture = await fetchPicture(LINK, { fetch: fetcher })
    expect(picture).toEqual({ bytes: pictureBytes("jpeg"), type: "image/jpeg" })
  })

  it("asks for the picture and nothing else: no redirect followed for it, no cache, no header of Notion's", async () => {
    const fetcher = web().mockResolvedValueOnce(ok())
    await fetchPicture(LINK, { fetch: fetcher })
    expect(fetcher).toHaveBeenCalledTimes(1)
    const [url, init] = fetcher.mock.calls[0] ?? []
    expect(url).toBe(LINK)
    expect(init).toMatchObject({ redirect: "manual", cache: "no-store" })
    expect(init?.signal).toBeInstanceOf(AbortSignal)
    expect(init?.headers).toEqual({ Accept: "image/*" })
  })

  it("goes by the bytes, not by what the host says it sent", async () => {
    const fetcher = web().mockResolvedValueOnce(pictureResponse("gif", { headers: { "content-type": "text/html" } }))
    expect((await fetchPicture(LINK, { fetch: fetcher })).type).toBe("image/gif")
  })

  it("refuses a web page that is called an image", async () => {
    const fetcher = web().mockResolvedValueOnce(new Response(webPage(), { headers: { "content-type": "image/png" } }))
    const error = await failure(fetchPicture(LINK, { fetch: fetcher }))
    expect(error.message).toBe("files.example.com sent something that is not a picture")
    expect(error.retryable).toBe(false)
  })

  it.each(["http://files.example.com/a.png", "https://127.0.0.1/a.png", "https://localhost/a.png", "https://user:pass@example.com/a.png", "/a.png", ""])(
    "does not even ask for %j",
    async (link) => {
      const fetcher = web()
      const error = await failure(fetchPicture(link, { fetch: fetcher }))
      expect(error.retryable).toBe(false)
      expect(fetcher).not.toHaveBeenCalled()
    },
  )

  describe("a redirect", () => {
    it("is followed, with a relative link or a link to another host, to the picture", async () => {
      const fetcher = web()
        .mockResolvedValueOnce(redirect("/moved/a.png"))
        .mockResolvedValueOnce(redirect("https://cdn.example.net/a.png", 301))
        .mockResolvedValueOnce(ok("webp"))
      expect((await fetchPicture("https://example.com/a.png", { fetch: fetcher })).type).toBe("image/webp")
      expect(fetcher.mock.calls.map(([url]) => url)).toEqual(["https://example.com/a.png", "https://example.com/moved/a.png", "https://cdn.example.net/a.png"])
    })

    it.each([301, 302, 303, 307, 308])("is followed when it is a %i", async (status) => {
      const fetcher = web().mockResolvedValueOnce(redirect("/b.png", status)).mockResolvedValueOnce(ok())
      expect((await fetchPicture("https://example.com/a.png", { fetch: fetcher })).type).toBe("image/png")
    })

    it(`is followed ${MAX_REDIRECTS} times at most`, async () => {
      const within = web()
      for (let hop = 0; hop < MAX_REDIRECTS; hop++) within.mockResolvedValueOnce(redirect(`/${hop}.png`))
      within.mockResolvedValueOnce(ok())
      await expect(fetchPicture("https://example.com/a.png", { fetch: within })).resolves.toMatchObject({ type: "image/png" })

      const beyond = web()
      for (let hop = 0; hop <= MAX_REDIRECTS; hop++) beyond.mockResolvedValueOnce(redirect(`/${hop}.png`))
      const error = await failure(fetchPicture("https://example.com/a.png", { fetch: beyond }))
      expect(error.message).toBe(`example.com redirected more than ${MAX_REDIRECTS} times`)
      expect(error.retryable).toBe(false)
      expect(beyond).toHaveBeenCalledTimes(MAX_REDIRECTS + 1)
    })

    it.each([
      ["a downgrade to http", "http://cdn.example.net/a.png"],
      ["a private address", "https://127.0.0.1/a.png"],
      ["the metadata address of a cloud", "https://169.254.169.254/latest/meta-data/"],
      ["a name that stays inside a network", "https://localhost/a.png"],
      ["a link with credentials", "https://user:pass@cdn.example.net/a.png"],
      ["another port", "https://cdn.example.net:8443/a.png"],
      ["a relative link that leads to an address", "//10.0.0.5/a.png"],
    ])("is refused when it leads to %s, and that place is never asked", async (_name, target) => {
      const fetcher = web().mockResolvedValueOnce(redirect(target)).mockResolvedValue(ok())
      const error = await failure(fetchPicture("https://example.com/a.png", { fetch: fetcher }))
      expect(error.message).toBe("example.com redirected to a place the server does not follow")
      expect(error.retryable).toBe(false)
      expect(fetcher).toHaveBeenCalledTimes(1)
    })

    it("is refused when it does not say where", async () => {
      const fetcher = web().mockResolvedValueOnce(redirect(null))
      const error = await failure(fetchPicture("https://example.com/a.png", { fetch: fetcher }))
      expect(error.message).toBe("example.com redirected without saying where")
      expect(error.retryable).toBe(false)
    })

    it("is checked again at every hop, not only the first", async () => {
      const fetcher = web().mockResolvedValueOnce(redirect("https://cdn.example.net/a.png")).mockResolvedValueOnce(redirect("https://169.254.169.254/")).mockResolvedValue(ok())
      const error = await failure(fetchPicture("https://example.com/a.png", { fetch: fetcher }))
      expect(error.message).toBe("cdn.example.net redirected to a place the server does not follow")
      expect(fetcher).toHaveBeenCalledTimes(2)
    })
  })

  describe("a host that answers with an error", () => {
    it.each([
      [400, false],
      [401, false],
      [403, false],
      [404, false],
      [410, false],
      [304, false],
      [408, true],
      [429, true],
      [500, true],
      [502, true],
      [503, true],
      [504, true],
    ])("is a %i: asking again later %s", async (status, retryable) => {
      // No body: a 304 may not have one
      const fetcher = web().mockResolvedValueOnce(new Response(null, { status }))
      const error = await failure(fetchPicture(LINK, { fetch: fetcher }))
      expect(error.message).toBe(`files.example.com answered ${status}`)
      expect(error.retryable).toBe(retryable)
    })

    it("is a network failure: asking again later may work", async () => {
      const fetcher = web().mockRejectedValueOnce(new TypeError("fetch failed"))
      const error = await failure(fetchPicture(LINK, { fetch: fetcher }))
      expect(error.message).toBe("files.example.com could not be reached (TypeError)")
      expect(error.retryable).toBe(true)
    })

    it("is still a PictureError when what was thrown is not an error", async () => {
      const fetcher = web().mockRejectedValueOnce("boom")
      const error = await failure(fetchPicture(LINK, { fetch: fetcher }))
      expect(error.message).toBe("files.example.com could not be reached (unknown error)")
      expect(error.retryable).toBe(true)
    })

    it("is a PictureError of its own kind, with a name", async () => {
      const error = await failure(fetchPicture(LINK, { fetch: web().mockResolvedValueOnce(new Response("no", { status: 404 })) }))
      expect(error).toBeInstanceOf(Error)
      expect(error.name).toBe("PictureError")
    })
  })

  describe("the time", () => {
    it("is limited, and a host that does not answer in time is a retryable failure", async () => {
      const silent = vi.fn<typeof fetch>(
        (_input, init) => new Promise<Response>((_resolve, reject) => init?.signal?.addEventListener("abort", () => reject(init.signal?.reason))),
      )
      const error = await failure(fetchPicture(LINK, { fetch: silent, timeoutMs: 20 }))
      expect(error.message).toBe("files.example.com could not be reached (TimeoutError)")
      expect(error.retryable).toBe(true)
    })

    it("is limited while the body comes in as well, not only until the first byte", async () => {
      const stalled = vi.fn<typeof fetch>(
        async (_input, init) =>
          new Response(
            new ReadableStream({
              start(controller) {
                controller.enqueue(pictureBytes("png", 16))
                init?.signal?.addEventListener("abort", () => controller.error(init.signal?.reason))
              },
            }),
          ),
      )
      const error = await failure(fetchPicture(LINK, { fetch: stalled, timeoutMs: 20 }))
      expect(error.message).toBe("files.example.com stopped sending the picture (TimeoutError)")
      expect(error.retryable).toBe(true)
    })

    it("is one limit for the whole download, redirects included", async () => {
      const signals: (AbortSignal | null | undefined)[] = []
      const fetcher = web().mockImplementationOnce(async (_input, init) => (signals.push(init?.signal), redirect("/b.png"))).mockImplementationOnce(async (_input, init) => (signals.push(init?.signal), ok()))
      await fetchPicture("https://example.com/a.png", { fetch: fetcher })
      expect(signals).toHaveLength(2)
      expect(signals[0]).toBe(signals[1])
    })

    it("is a few seconds by default, and shorter than what a function may run", () => {
      expect(PICTURE_TIMEOUT_MS).toBeGreaterThanOrEqual(1000)
      expect(PICTURE_TIMEOUT_MS).toBeLessThanOrEqual(10_000)
    })
  })

  describe("the size", () => {
    const small = { maxBytes: 100 }

    /** A body that never ends: `chunk` bytes of a picture, then zeros, as long as it is read. `state` says how far it was read and whether it was given up. */
    function endless(chunk: number) {
      const state = { pulls: 0, cancelled: false }
      const body = new ReadableStream<Uint8Array>({
        pull(controller) {
          controller.enqueue(pictureBytes("png", chunk))
          state.pulls += 1
        },
        cancel() {
          state.cancelled = true
        },
      })
      return { state, response: new Response(body) }
    }

    it("is capped under what a Vercel function may answer", () => {
      expect(MAX_PICTURE_BYTES).toBeLessThan(4.5 * 1024 * 1024)
    })

    it("lets a picture of exactly that size through", async () => {
      const fetcher = web().mockResolvedValueOnce(pictureResponse("png", {}))
      await expect(fetchPicture(LINK, { fetch: fetcher, ...small })).resolves.toMatchObject({ type: "image/png" })

      const exact = web().mockResolvedValueOnce(new Response(pictureBytes("png", 100)))
      expect((await fetchPicture(LINK, { fetch: exact, ...small })).bytes).toHaveLength(100)
    })

    it("refuses a picture one byte over, in one piece", async () => {
      const fetcher = web().mockResolvedValueOnce(new Response(pictureBytes("png", 101)))
      const error = await failure(fetchPicture(LINK, { fetch: fetcher, ...small }))
      expect(error.message).toBe("files.example.com sent a picture over 100 bytes")
      expect(error.retryable).toBe(false)
    })

    it("refuses what its Content-Length announces without reading the body", async () => {
      const { state, response } = endless(40)
      response.headers.set("content-length", "5000")
      const error = await failure(fetchPicture(LINK, { fetch: web().mockResolvedValueOnce(response), ...small }))
      expect(error.message).toBe("files.example.com sent a picture over 100 bytes")
      expect(state.cancelled).toBe(true)
      expect(state.pulls).toBeLessThanOrEqual(1)
    })

    it("stops reading a body that never ends, and gives it up", async () => {
      const { state, response } = endless(40)
      const error = await failure(fetchPicture(LINK, { fetch: web().mockResolvedValueOnce(response), ...small }))
      expect(error.message).toBe("files.example.com sent a picture over 100 bytes")
      expect(error.retryable).toBe(false)
      expect(state.cancelled).toBe(true)
      expect(state.pulls).toBeLessThanOrEqual(5)
    })

    it("does not believe a Content-Length that is smaller than the body", async () => {
      const lying = new Response(pictureBytes("png", 150), { headers: { "content-length": "10" } })
      const error = await failure(fetchPicture(LINK, { fetch: web().mockResolvedValueOnce(lying), ...small }))
      expect(error.message).toBe("files.example.com sent a picture over 100 bytes")
    })

    it("ignores a Content-Length that is not a number", async () => {
      const odd = new Response(pictureBytes("png"), { headers: { "content-length": "many" } })
      await expect(fetchPicture(LINK, { fetch: web().mockResolvedValueOnce(odd), ...small })).resolves.toMatchObject({ type: "image/png" })
    })

    it("puts together a body that comes in pieces", async () => {
      const bytes = pictureBytes("jpeg", 90)
      const pieces = new ReadableStream<Uint8Array>({
        start(controller) {
          for (let start = 0; start < bytes.length; start += 7) controller.enqueue(bytes.slice(start, start + 7))
          controller.close()
        },
      })
      const picture = await fetchPicture(LINK, { fetch: web().mockResolvedValueOnce(new Response(pieces)), ...small })
      expect(picture).toEqual({ bytes, type: "image/jpeg" })
    })

    it.each([
      ["an empty body", () => new Response(new Uint8Array())],
      ["an empty text", () => new Response("")],
      ["no body at all", () => new Response(null)],
    ])("refuses %s", async (_name, answer) => {
      const error = await failure(fetchPicture(LINK, { fetch: web().mockResolvedValueOnce(answer()) }))
      expect(error.retryable).toBe(false)
      expect(error.message).toMatch(/^files\.example\.com sent (an empty file|no picture)$/)
    })
  })

  it.each([
    ["a refused link", () => web()],
    ["a refused redirect", () => web().mockResolvedValueOnce(redirect("https://127.0.0.1/a.png?sig=topsecret"))],
    ["an error", () => web().mockResolvedValueOnce(new Response("no", { status: 403 }))],
    ["a network failure", () => web().mockRejectedValueOnce(new TypeError("fetch failed: https://files.example.com/secret/picture.png?X-Amz-Signature=topsecret"))],
    ["something that is not a picture", () => web().mockResolvedValueOnce(new Response(webPage()))],
    ["a picture that is too big", () => web().mockResolvedValueOnce(new Response(pictureBytes("png", 200)))],
  ])("names the host and never the link when it fails on %s", async (_name, fetcher) => {
    const link = _name === "a refused link" ? "http://files.example.com/secret/picture.png?X-Amz-Signature=topsecret" : LINK
    const error = await failure(fetchPicture(link, { fetch: fetcher(), maxBytes: 100 }))
    expect(error.message).not.toMatch(/topsecret|secret\/|picture\.png|X-Amz/i)
  })
})

describe("download", () => {
  const LINK = "https://example.com/"
  const web = () => vi.fn<typeof fetch>()
  const page = (body: string, init: ResponseInit = {}) => new Response(body, { headers: { "content-type": "text/html" }, ...init })

  /** The error a download ends with, and only that. */
  async function failure(started: Promise<unknown>): Promise<PictureError> {
    try {
      await started
    } catch (error) {
      expect(error).toBeInstanceOf(PictureError)
      return error as PictureError
    }
    throw new Error("the download was expected to fail")
  }

  it("asks for what it is told it accepts, and says who asks only when it is told to", async () => {
    const plain = web().mockResolvedValueOnce(page("<html></html>"))
    await download(LINK, PAGE, { fetch: plain })
    expect(plain.mock.calls[0]?.[1]?.headers).toEqual({ Accept: "text/html,application/xhtml+xml" })

    const named = web().mockResolvedValueOnce(page("<html></html>"))
    await download(LINK, PAGE, { fetch: named, userAgent: "Somebody/1.0" })
    expect(named.mock.calls[0]?.[1]?.headers).toEqual({ Accept: "text/html,application/xhtml+xml", "User-Agent": "Somebody/1.0" })
  })

  it("gives where the redirects ended, which is what a link of a page is relative to", async () => {
    const fetcher = web()
      .mockResolvedValueOnce(new Response(null, { status: 301, headers: { location: "https://www.example.com/fr/" } }))
      .mockResolvedValueOnce(page("<html></html>"))
    const { url } = await download(LINK, PAGE, { fetch: fetcher })
    expect(url.href).toBe("https://www.example.com/fr/")
  })

  it("is held to a limit that the caller shares between several downloads, in place of its own", async () => {
    const signals: (AbortSignal | null | undefined)[] = []
    const fetcher = web().mockImplementation(async (_input, init) => (signals.push(init?.signal), page("<html></html>")))
    const shared = AbortSignal.timeout(5000)
    await download(LINK, PAGE, { fetch: fetcher, signal: shared })
    await download(LINK, PAGE, { fetch: fetcher, signal: shared })
    expect(signals).toEqual([shared, shared])
  })

  it("keeps the first bytes of a page that is longer than the limit, and does not fail on it", async () => {
    const fetcher = web().mockResolvedValueOnce(page(`<html>${"a".repeat(300)}</html>`))
    const { bytes } = await download(LINK, PAGE, { fetch: fetcher, maxBytes: 100 })
    expect(bytes.byteLength).toBe(100)
    expect(new TextDecoder().decode(bytes)).toBe(`<html>${"a".repeat(94)}`)
  })

  it("keeps the first bytes of a page that comes in pieces, whichever piece crosses the limit", async () => {
    const pieces = new ReadableStream<Uint8Array>({
      start(controller) {
        for (const piece of ["a".repeat(60), "b".repeat(60), "c".repeat(60)]) controller.enqueue(new TextEncoder().encode(piece))
        controller.close()
      },
    })
    const fetcher = web().mockResolvedValueOnce(new Response(pieces))
    const { bytes } = await download(LINK, PAGE, { fetch: fetcher, maxBytes: 100 })
    expect(new TextDecoder().decode(bytes)).toBe(`${"a".repeat(60)}${"b".repeat(40)}`)
  })

  it("does not read the body of a page whose Content-Length is over the limit before it has to: it is cut like the others", async () => {
    const fetcher = web().mockResolvedValueOnce(page(`<html>${"a".repeat(300)}</html>`, { headers: { "content-type": "text/html", "content-length": "9999" } }))
    await expect(download(LINK, PAGE, { fetch: fetcher, maxBytes: 100 })).resolves.toMatchObject({ bytes: expect.objectContaining({ byteLength: 100 }) })
  })

  it("calls what it downloads a page in what it says, and a picture when it is one", async () => {
    expect((await failure(download("http://example.com/", PAGE, { fetch: web() }))).message).toBe("The link of the page is not one the server follows")
    expect((await failure(download(LINK, PAGE, { fetch: web().mockResolvedValueOnce(page("")) }))).message).toBe("example.com sent an empty file")
    expect((await failure(fetchPicture("http://example.com/a.png", { fetch: web() }))).message).toBe("The link of the picture is not one the server follows")
  })

  it("still follows only the places that a picture may come from: the same rules for a page", async () => {
    const fetcher = web().mockResolvedValueOnce(new Response(null, { status: 302, headers: { location: "https://192.168.1.10/" } }))
    const error = await failure(download(LINK, PAGE, { fetch: fetcher }))
    expect(error.message).toBe("example.com redirected to a place the server does not follow")
  })
})
