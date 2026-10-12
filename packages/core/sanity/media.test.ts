import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { mediaRoute } from "../routes/api/media/route"
import { sanityAssetUrl } from "./media"

const PROJECTS = ["2lo2f5sv", "3t296gee"]
const FONT = "https://cdn.sanity.io/files/2lo2f5sv/production/0f1e2d3c4b5a69788796a5b4c3d2e1f001122334.woff2"
const IMAGE = "https://cdn.sanity.io/images/3t296gee/production/0f1e2d3c4b5a69788796a5b4c3d2e1f001122334-64x64.svg"

describe("sanityAssetUrl", () => {
  it("accepts the files and images of the given projects, query string included", () => {
    expect(sanityAssetUrl(FONT, PROJECTS)?.href).toBe(FONT)
    expect(sanityAssetUrl(IMAGE, PROJECTS)?.href).toBe(IMAGE)
    expect(sanityAssetUrl(`${IMAGE}?w=32&fm=webp`, PROJECTS)?.search).toBe("?w=32&fm=webp")
  })

  it("refuses the assets of any other Sanity project", () => {
    expect(sanityAssetUrl(FONT, ["3t296gee"])).toBeNull()
    expect(sanityAssetUrl(FONT, [])).toBeNull()
    for (const path of ["files/other123/production/a.woff2", "files/2lo2f5sv-evil/production/a.woff2", "files/2lo2f5s/production/a.woff2", "images/production/2lo2f5sv/a.svg"]) {
      expect(sanityAssetUrl(`https://cdn.sanity.io/${path}`, PROJECTS), path).toBeNull()
    }
  })

  it("refuses what is not an image or a file of a project, whatever the project", () => {
    for (const path of ["", "2lo2f5sv", "data/query/2lo2f5sv/production", "media-libraries/2lo2f5sv/a", "files", "files/", "images//production/a.svg"]) {
      expect(sanityAssetUrl(`https://cdn.sanity.io/${path}`, PROJECTS), path).toBeNull()
    }
  })

  it("refuses any host, scheme, port or credentials other than https://cdn.sanity.io", () => {
    const path = "files/2lo2f5sv/production/a.woff2"
    for (const origin of [
      "http://cdn.sanity.io",
      "https://cdn.sanity.io.evil.com",
      "https://evil.com/https://cdn.sanity.io",
      "https://cdn-sanity.io",
      "https://api.sanity.io",
      "https://cdn.sanity.io:8443",
      "https://user:secret@cdn.sanity.io",
      "https://cdn.sanity.io@evil.com",
      "https://evil.com\\@cdn.sanity.io",
      "//cdn.sanity.io",
      "ftp://cdn.sanity.io",
    ]) {
      expect(sanityAssetUrl(`${origin}/${path}`, PROJECTS), origin).toBeNull()
    }
    expect(sanityAssetUrl(`javascript:alert(1)//cdn.sanity.io/${path}`, PROJECTS)).toBeNull()
    expect(sanityAssetUrl(`data:text/html,https://cdn.sanity.io/${path}`, PROJECTS)).toBeNull()
  })

  it("checks the normalized path, so dot segments cannot reach another project", () => {
    expect(sanityAssetUrl("https://cdn.sanity.io/files/2lo2f5sv/../other123/production/a.woff2", PROJECTS)).toBeNull()
    expect(sanityAssetUrl("https://cdn.sanity.io/files/2lo2f5sv/%2e%2e/other123/production/a.woff2", PROJECTS)).toBeNull()
    expect(sanityAssetUrl("https://cdn.sanity.io/files/2lo2f5sv/%2E%2E/other123/production/a.woff2", PROJECTS)).toBeNull()
    // a backslash is a slash for the URL parser
    expect(sanityAssetUrl("https://cdn.sanity.io/files/2lo2f5sv\\..\\other123/production/a.woff2", PROJECTS)).toBeNull()
    // and what comes back is the normalized URL: it is what gets fetched
    expect(sanityAssetUrl("https://CDN.sanity.io/files/other123/../2lo2f5sv/production/a.woff2", PROJECTS)?.href).toBe("https://cdn.sanity.io/files/2lo2f5sv/production/a.woff2")
    expect(sanityAssetUrl("https://cdn.sanity.io/files/2lo2f5sv/production/x\\..\\a.woff2", PROJECTS)?.href).toBe("https://cdn.sanity.io/files/2lo2f5sv/production/a.woff2")
  })

  it("refuses encoded slashes and dots in the path, which the CDN could read differently from the check", () => {
    for (const path of ["files/2lo2f5sv%2F..%2Fother123/production/a.woff2", "files/2lo2f5sv/..%2fother123/production/a.woff2", "files/2lo2f5sv/production/a%2ewoff2", "files/2lo2f5sv/production/a%5C..%5Cb"]) {
      expect(sanityAssetUrl(`https://cdn.sanity.io/${path}`, PROJECTS), path).toBeNull()
    }
  })

  it("refuses what is not a URL", () => {
    for (const value of [null, undefined, "", "   ", "files/2lo2f5sv/production/a.woff2", "/api/media?url=x", "not a url"]) {
      expect(sanityAssetUrl(value, PROJECTS), String(value)).toBeNull()
    }
  })

  it("ignores empty and placeholder project ids: a game without a Sanity project allows nothing", () => {
    expect(sanityAssetUrl("https://cdn.sanity.io/files/__SANITY_PROJECT_ID__/production/a.woff2", ["__SANITY_PROJECT_ID__"])).toBeNull()
    expect(sanityAssetUrl("https://cdn.sanity.io/files//production/a.woff2", [""])).toBeNull()
    expect(sanityAssetUrl("https://cdn.sanity.io/files/undefined/production/a.woff2", [undefined, null])).toBeNull()
  })
})

describe("GET /api/media", () => {
  const fetchMock = vi.fn<typeof fetch>()
  const GET = mediaRoute(PROJECTS)
  const call = (url?: string) => GET(new Request(`http://localhost/api/media${url === undefined ? "" : `?url=${encodeURIComponent(url)}`}`))

  beforeEach(() => {
    fetchMock.mockReset()
    vi.stubGlobal("fetch", fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("proxies an asset of a game's project with the hardening headers", async () => {
    fetchMock.mockResolvedValue(new Response("font bytes", { headers: { "content-type": "font/woff2" } }))
    const res = await call(FONT)
    expect(res.status).toBe(200)
    expect(await res.text()).toBe("font bytes")
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock.mock.calls[0]![0]).toBe(FONT)
    expect(res.headers.get("content-type")).toBe("font/woff2")
    expect(res.headers.get("x-content-type-options")).toBe("nosniff")
    expect(res.headers.get("content-security-policy")).toContain("sandbox")
  })

  it("answers 400 to anything else without fetching it", async () => {
    for (const url of [undefined, "", "https://cdn.sanity.io/files/other123/production/a.woff2", "https://evil.com/a.svg", "https://cdn.sanity.io/files/2lo2f5sv/../other123/production/a.woff2"]) {
      const res = await call(url)
      expect(res.status, String(url)).toBe(400)
      expect(await res.text()).toBe("URL not allowed")
    }
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("answers 404 when the CDN has no such asset", async () => {
    fetchMock.mockResolvedValue(new Response("nope", { status: 404 }))
    expect((await call(FONT)).status).toBe(404)
  })

  it("serves nothing for a game whose Sanity project is not set up yet", async () => {
    const res = await mediaRoute(["__SANITY_PROJECT_ID__"])(new Request(`http://localhost/api/media?url=${encodeURIComponent(FONT)}`))
    expect(res.status).toBe(400)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
