import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"
import { gamePath, shareImagePath as siteShareImagePath } from "@pbgo/core/lib/site-url"
import {
  LIVE_SITEMAP,
  USER_AGENT,
  apiCheck,
  apiPath,
  checkProduction,
  decodeEntities,
  describeChecks,
  fileCheck,
  filesOf,
  gameFiles,
  gamePagePath,
  pageChecks,
  pictureChecks,
  publishedFilesUrl,
  reader,
  shareImagePath,
  sitemapChecks,
  tablesComingText,
  visibleText,
  type Answer,
  type Check,
  type ProductionGame,
} from "./production-check"
import { playLead as phraseLead, playTitle as phraseTitle } from "./play-phrase"
import { SITE_URL, html, seo, sitemapXml, type Body } from "./production-testing"
import { gameJsonLd, playLead, playTitle, serializeJsonLd, sitemapItems, type GameSeo } from "./seo"
import { catalogEntry } from "./testing"

// The checks that `pnpm check:production` makes of a game in production. Every page here is built by the code that builds the real one (`gameMetadata`, `gameJsonLd`, `sitemapItems` of `seo.ts`), so a change of
// the SEO that the checks do not follow fails in this file, and what the page's own components say (the Play button, the Create a table link, the sentence of a game that is not live) is read from their source.

const REPO = fileURLToPath(new URL("../../..", import.meta.url))
const source = (path: string) => readFileSync(join(REPO, path), "utf8")

const SITE = SITE_URL
const GAME: ProductionGame = { slug: "skyjo", name: "Skyjo", indexable: true }

const answer = (body = "", { status = 200, headers = {} }: { status?: number; headers?: Record<string, string> } = {}): Answer => ({ status, headers, body })
const pageAnswer = (game: GameSeo, parts?: Body, headers: Record<string, string> = {}) => answer(html(game, parts), { headers: { "x-matched-path": "/game/[slug]", "content-type": "text/html; charset=utf-8", ...headers } })

/** The checks of a page that passes, and the ones that fail, by their label. */
const failing = (checks: Check[]) => checks.filter((check) => !check.ok).map((check) => check.label)
const labelled = (checks: Check[], start: string) => checks.find((check) => check.label.includes(start))

describe("what the checks expect", () => {
  it("is what the page says: the title and the lead are the ones of the SEO code, and the paths are the site's", () => {
    // one definition: seo.ts exports what play-phrase.ts writes, which the command (run by Node, which cannot load seo.ts) reads
    expect(playTitle).toBe(phraseTitle)
    expect(playLead).toBe(phraseLead)
    expect(gamePagePath("skyjo")).toBe(gamePath("skyjo"))
    expect(shareImagePath("skyjo")).toBe(siteShareImagePath("skyjo"))
  })

  it("is the line of the sitemap that sitemapItems writes for a live game's page", () => {
    const items = sitemapItems(SITE, [catalogEntry("skyjo", { live: true, indexable: true })])
    expect(items.find((item) => item.url === `${SITE}/game/skyjo`)).toMatchObject({ changeFrequency: LIVE_SITEMAP.changeFrequency, priority: LIVE_SITEMAP.priority })
  })

  it("is served by the routes that exist: the game's own files, and the API's refusal of a code", () => {
    // `[game]` of the app serves the manifest, the two icons and the share image (`/<slug>/opengraph-image/<id>`, the id being the one that `shareImagePath` names)
    const app = "apps/web/src/app/[game]"
    expect(gameFiles("skyjo").map(({ path }) => path)).toEqual(["/skyjo/opengraph-image/share", "/skyjo/manifest.webmanifest", "/skyjo/icons/favicon", "/skyjo/icons/apple"])
    for (const route of ["manifest.webmanifest/route.ts", "icons/favicon/route.ts", "icons/apple/route.ts", "opengraph-image.tsx"]) expect(existsSync(join(REPO, app, route)), route).toBe(true)
    expect(apiPath("skyjo")).toBe("/api/skyjo/games/%21")
    expect(source("packages/core/server/games.ts")).toMatch(/validCode\(code\)\) throw new ApiError\("INVALID_CODE"\)/)
    expect(source("packages/core/server/games.ts")).toMatch(/throw new ApiError\("GAME_NOT_FOUND", 404\)/)
  })

  it("is what the page's own components say", () => {
    const head = source("apps/web/src/components/game-head.tsx")
    // the Back link, the badge of a game that is not live, the Create a table link and the button that a game that is not live disables
    expect(head).toMatch(/^\s*Back\s*$/m)
    expect(head).toContain('<Badge variant="outline">Coming soon</Badge>')
    expect(head).toContain('Create<span className="sr-only"> a table</span>')
    expect(head).toContain('data-cta="create_table"')
    expect(head).toContain("disabled={!live}")
    expect(source("apps/web/src/components/play-button.tsx")).toMatch(/^\s*Play\s*$/m)
    expect(source("apps/web/src/components/game-play.tsx")).toContain(tablesComingText("${name}"))
  })
})

describe("pageChecks", () => {
  it("passes a page of a live, indexable game, at both of its addresses", () => {
    for (const path of ["/skyjo", "/game/skyjo"]) {
      const checks = pageChecks(GAME, SITE, path, pageAnswer(seo()))
      expect(failing(checks), path).toEqual([])
      expect(checks.length).toBeGreaterThan(12)
    }
  })

  it("is not troubled by the other games' badges, nor by the page's own data: they say Coming soon far from the head", () => {
    // the similar games and the page's script both carry the words; the head does not
    expect(html(seo())).toContain("Coming soon")
    expect(failing(pageChecks(GAME, SITE, "/game/skyjo", pageAnswer(seo())))).toEqual([])
  })

  it("passes the page of a name that needs escaping", () => {
    const game: ProductionGame = { slug: "six-nimmt", name: "6 nimmt! & Co's <game>", indexable: true }
    const checks = pageChecks(game, SITE, "/game/six-nimmt", pageAnswer(seo({ slug: "six-nimmt", name: game.name })))
    expect(failing(checks)).toEqual([])
  })

  it("says that a page that was not read has not been: nothing else is asked of it", () => {
    const missing = pageChecks(GAME, SITE, "/skyjo", answer("<h1>Not found</h1>", { status: 404 }))
    expect(missing).toHaveLength(1)
    expect(missing[0]).toMatchObject({ ok: false, detail: "HTTP 404" })
    const silent = pageChecks(GAME, SITE, "/skyjo", { status: 0, headers: {}, body: "", error: "TimeoutError" })
    expect(silent[0]).toMatchObject({ ok: false, detail: "no answer (TimeoutError)" })
  })

  it("fails a page that another route answered", () => {
    const checks = pageChecks(GAME, SITE, "/skyjo", pageAnswer(seo(), undefined, { "x-matched-path": "/[game]" }))
    expect(failing(checks)).toEqual(["/skyjo: 200 and the hub page of the game"])
  })

  it("fails a page that search engines are told to leave out, by its header or its meta, and wants them kept out for a game that is not indexable", () => {
    expect(failing(pageChecks(GAME, SITE, "/skyjo", pageAnswer(seo(), undefined, { "x-robots-tag": "noindex, nofollow" })))).toEqual(["/skyjo: no X-Robots-Tag noindex"])
    const hidden = pageChecks(GAME, SITE, "/skyjo", pageAnswer(seo({ indexable: false })))
    expect(failing(hidden)).toEqual(["/skyjo: robots meta lets search engines in"])
    // a game that the registry does not index: its page says noindex, and there is no header to look for
    const notIndexable: ProductionGame = { ...GAME, indexable: false }
    const kept = pageChecks(notIndexable, SITE, "/skyjo", pageAnswer(seo({ indexable: false })))
    expect(failing(kept)).toEqual([])
    expect(labelled(kept, "X-Robots-Tag")).toBeUndefined()
    expect(failing(pageChecks(notIndexable, SITE, "/skyjo", pageAnswer(seo())))).toEqual(["/skyjo: robots meta keeps search engines out (the game is not indexable)"])
  })

  it("fails the page of a game that is not live: its description, its badge, its table space and its disabled buttons say so", () => {
    const soon = pageChecks(GAME, SITE, "/game/skyjo", pageAnswer(seo({ live: false }), { badge: true, tablesComing: true, disabled: true }))
    expect(failing(soon)).toEqual([
      `/game/skyjo: description starts with the lead of a live game ("${playLead({ name: "Skyjo", live: true })}")`,
      "/game/skyjo: description is not the coming-soon one",
      '/game/skyjo: the head has no "Coming soon" badge',
      "/game/skyjo: the table space does not say that tables are coming",
      "/game/skyjo: a table can be opened (a Play button that is not disabled, a Create a table link)",
    ])
    expect(labelled(soon, "a table can be opened")?.detail).toBe("Play is disabled, no Create a table link")
    expect(labelled(soon, "no \"Coming soon\" badge")?.detail).toMatch(/^Back .*Coming soon$/)
    expect(labelled(soon, "does not say that tables are coming")?.detail).toBe('the page says "You will be able to open a table of Skyjo…": it is the page of a game that is not live')
  })

  it("sees each of those signs by itself", () => {
    expect(failing(pageChecks(GAME, SITE, "/skyjo", pageAnswer(seo(), { badge: true })))).toEqual(['/skyjo: the head has no "Coming soon" badge'])
    expect(failing(pageChecks(GAME, SITE, "/skyjo", pageAnswer(seo(), { tablesComing: true })))).toEqual(["/skyjo: the table space does not say that tables are coming"])
    const open = "/skyjo: a table can be opened (a Play button that is not disabled, a Create a table link)"
    expect(failing(pageChecks(GAME, SITE, "/skyjo", pageAnswer(seo(), { disabled: true })))).toEqual([open])
    const playOff = pageChecks(GAME, SITE, "/skyjo", pageAnswer(seo(), { playDisabled: true }))
    expect(failing(playOff)).toEqual([open])
    expect(labelled(playOff, "a table can be opened")?.detail).toBe("Play is disabled, Create a table")
    const noLink = pageChecks(GAME, SITE, "/skyjo", pageAnswer(seo(), { noCreateLink: true }))
    expect(failing(noLink)).toEqual([open])
    expect(labelled(noLink, "a table can be opened")?.detail).toBe("Play, no Create a table link")
    // the description alone: a stale cache of the page of a game to come
    const stale = pageChecks(GAME, SITE, "/skyjo", pageAnswer(seo({ live: false })))
    expect(failing(stale)).toEqual([`/skyjo: description starts with the lead of a live game ("${playLead({ name: "Skyjo", live: true })}")`, "/skyjo: description is not the coming-soon one"])
  })

  it("fails a title, a canonical address, an Open Graph card and a JSON-LD that are not the game's", () => {
    const page = html(seo())
    const wrongTitle = page.replace("<title>Play Skyjo Online", "<title>Home")
    expect(failing(pageChecks(GAME, SITE, "/skyjo", answer(wrongTitle)))).toEqual([`/skyjo: title starts with "Play Skyjo Online"`])
    const preview = page.replace(`href="${SITE}/game/skyjo"`, 'href="https://pbgo-git-x.vercel.app/game/skyjo"')
    expect(failing(pageChecks(GAME, SITE, "/skyjo", answer(preview)))).toEqual(["/skyjo: canonical is /game/skyjo"])
    const noImage = page.replace(/<meta property="og:image"[^>]*>/, "")
    expect(failing(pageChecks(GAME, SITE, "/skyjo", answer(noImage)))).toEqual(["/skyjo: Open Graph title and image"])
    const ogUrl = page.replace(`property="og:url" content="${SITE}/game/skyjo"`, `property="og:url" content="${SITE}/skyjo"`)
    expect(failing(pageChecks(GAME, SITE, "/skyjo", answer(ogUrl)))).toEqual(["/skyjo: Open Graph address is the canonical one"])
    const otherGame = page.replace(/<script type="application\/ld\+json">.*?<\/script>/, `<script type="application/ld+json">${serializeJsonLd(gameJsonLd(seo({ name: "Hanabi", slug: "hanabi" }), SITE))}</script>`)
    expect(failing(pageChecks(GAME, SITE, "/skyjo", answer(otherGame)))).toEqual(["/skyjo: JSON-LD is the game's (a Game named Skyjo, at /game/skyjo)"])
    expect(labelled(pageChecks(GAME, SITE, "/skyjo", answer(otherGame)), "JSON-LD")?.detail).toBe(`Hanabi, ${SITE}/game/hanabi`)
    const noJsonLd = page.replace(/<script type="application\/ld\+json">.*?<\/script>/, "")
    expect(labelled(pageChecks(GAME, SITE, "/skyjo", answer(noJsonLd)), "JSON-LD")).toMatchObject({ ok: false, detail: "no JSON-LD block" })
    const broken = page.replace(/<script type="application\/ld\+json">.*?<\/script>/, '<script type="application/ld+json">{ not json</script>')
    expect(labelled(pageChecks(GAME, SITE, "/skyjo", answer(broken)), "JSON-LD")?.detail).toBe("0 block(s), none a Game, 1 that do not parse")
  })

  it("says the address of the site it was given: a page that names another is not the site's", () => {
    const checks = pageChecks(GAME, "http://127.0.0.1:4000", "/skyjo", pageAnswer(seo()))
    expect(failing(checks)).toEqual(["/skyjo: canonical is /game/skyjo", "/skyjo: Open Graph address is the canonical one", "/skyjo: JSON-LD is the game's (a Game named Skyjo, at /game/skyjo)"])
  })
})

describe("sitemapChecks", () => {
  const sitemap = (entries: Parameters<typeof sitemapItems>[1]) => answer(sitemapXml(entries))

  it("passes a sitemap that lists the page of the game as a live game's", () => {
    const checks = sitemapChecks(GAME, SITE, sitemap([catalogEntry("skyjo", { live: true, indexable: true }), catalogEntry("hanabi", { live: true, indexable: true })]))
    expect(failing(checks)).toEqual([])
    expect(checks.map((check) => check.label)).toEqual(["/sitemap.xml lists /game/skyjo", "/sitemap.xml: the entry is a live game's (weekly, 0.8)"])
  })

  it("fails a sitemap without the game, with the line of a game to come, or that was not read", () => {
    expect(failing(sitemapChecks(GAME, SITE, sitemap([catalogEntry("hanabi", { live: true, indexable: true })])))).toEqual(["/sitemap.xml lists /game/skyjo"])
    const soon = sitemap([catalogEntry("skyjo", { game: { descriptions: { en: "A game." } } })])
    expect(failing(sitemapChecks(GAME, SITE, soon))).toEqual(["/sitemap.xml: the entry is a live game's (weekly, 0.8)"])
    expect(labelled(sitemapChecks(GAME, SITE, soon), "the entry")?.detail).toBe("monthly, 0.6")
    expect(sitemapChecks(GAME, SITE, answer("", { status: 503 }))).toEqual([{ label: "/sitemap.xml answers", ok: false, detail: "HTTP 503" }])
  })

  it("wants a game that is not indexable to be left out of the sitemap", () => {
    const notIndexable: ProductionGame = { ...GAME, indexable: false }
    expect(failing(sitemapChecks(notIndexable, SITE, sitemap([catalogEntry("hanabi", { live: true, indexable: true })])))).toEqual([])
    expect(failing(sitemapChecks(notIndexable, SITE, sitemap([catalogEntry("skyjo", { live: true, indexable: true })])))).toEqual(["/sitemap.xml does not list /game/skyjo (the game is not indexable)"])
  })
})

describe("the API and the game's files", () => {
  it("wants a table code that cannot be one to be refused as such, which only a game that is known does", () => {
    expect(apiCheck(answer('{"error":"INVALID_CODE"}', { status: 400 })).ok).toBe(true)
    expect(apiCheck(answer('{"error":"GAME_NOT_FOUND"}', { status: 404 })).ok).toBe(false)
    expect(apiCheck(answer("", { status: 0 }))).toMatchObject({ ok: false, detail: "no answer (unknown error)" })
  })

  it("wants each file served as the kind of file it is", () => {
    expect(fileCheck("/skyjo/manifest.webmanifest", "application/manifest+json", answer("", { headers: { "content-type": "application/manifest+json" } }))).toMatchObject({ ok: true, detail: "HTTP 200, application/manifest+json" })
    expect(fileCheck("/skyjo/icons/apple", "image/", answer("", { headers: { "content-type": "text/html" } })).ok).toBe(false)
    expect(fileCheck("/skyjo/icons/apple", "image/", answer("", { status: 404, headers: { "content-type": "image/png" } })).ok).toBe(false)
  })
})

describe("the pictures and files of the game's Sanity project", () => {
  const head = (url: string, status = 200) => ({ url, answer: answer("", { status }) })

  it("asks the project's API itself for the assets that a published document uses", () => {
    const url = new URL(publishedFilesUrl("0kx7tx6t"))
    expect(url.host).toBe("0kx7tx6t.api.sanity.io")
    expect(url.pathname).toMatch(/^\/v\d{4}-\d{2}-\d{2}\/data\/query\/production$/)
    expect(url.searchParams.get("perspective")).toBe("published")
    expect(url.searchParams.get("query")).toContain("sanity.imageAsset")
  })

  it("reads the addresses of an answer once each, and nothing but addresses", () => {
    expect(filesOf(answer(JSON.stringify({ result: ["https://cdn.sanity.io/a.png", "https://cdn.sanity.io/a.png", "http://127.0.0.1/b.png", "ftp://x/c", null, 3, "/relative"] })))).toEqual(["https://cdn.sanity.io/a.png", "http://127.0.0.1/b.png"])
    expect(filesOf(answer("{ not json"))).toBeNull()
    expect(filesOf(answer('{"result":{"a":1}}'))).toBeNull()
    expect(filesOf(answer('{"result":[]}'))).toEqual([])
  })

  it("says how many files there are, and that none fails", () => {
    expect(pictureChecks("0kx7tx6t", answer(), [head("https://cdn/a"), head("https://cdn/b"), head("https://cdn/c")])).toEqual([{ label: "published pictures and files load (3 files of the project 0kx7tx6t)", ok: true, detail: "all 200" }])
  })

  it("fails a file that does not load, a project that is not there, a project with nothing published, an answer that is not a list", () => {
    const some = pictureChecks("0kx7tx6t", answer(), [head("https://cdn/a"), head("https://cdn/b", 404), head("https://cdn/c", 403)])
    expect(some[0]).toMatchObject({ ok: false, detail: "2 failing: HTTP 404 https://cdn/b, HTTP 403 https://cdn/c" })
    expect(pictureChecks("0kx7tx6t", answer("", { status: 404 }), [])[0]).toMatchObject({ ok: false, label: "the game's Sanity project (0kx7tx6t) answers" })
    expect(pictureChecks("0kx7tx6t", answer(), [])[0]?.detail).toContain("no picture or file is used by a published document")
    expect(pictureChecks("0kx7tx6t", answer(), null)[0]?.ok).toBe(false)
  })
})

describe("reading HTML", () => {
  it("decodes the entities that a page writes", () => {
    expect(decodeEntities("Play &amp; win &#x27;now&#39; &quot;ok&quot; &lt;b&gt; &#8217; &nbsp;x &unknown; &#99999999; &#x0;")).toBe("Play & win 'now' \"ok\" <b> ’  x &unknown; &#99999999; &#x0;")
  })

  it("reads what a visitor reads: no script, no style, no tag, one line", () => {
    const text = visibleText('<style>a{}</style><p>Hello<br>world</p><script>var x = "<p>no</p>"</script><button class="[&amp;&gt;svg]:x">Play<svg><path d=""/></svg></button>')
    expect(text).toBe("Hello world Play")
  })
})

describe("reader", () => {
  it("asks with GET or HEAD alone, says who asks, sends no cookie and no credential, and leaves a HEAD and a file unread", async () => {
    const seen: { method: string; headers: Record<string, string>; body: unknown }[] = []
    const stub = (async (_url: string | URL | Request, init: RequestInit = {}) => {
      seen.push({ method: String(init.method), headers: init.headers as Record<string, string>, body: init.body })
      return new Response("the page", { status: 200, headers: { "Content-Type": "text/html", "X-Matched-Path": "/game/[slug]" } })
    }) as typeof fetch
    const read = reader(stub, 1000)
    const page = await read("https://example.test/a")
    const head = await read("https://example.test/b", { method: "HEAD" })
    const file = await read("https://example.test/c", { body: false })
    expect(page).toEqual({ status: 200, headers: { "content-type": "text/html", "x-matched-path": "/game/[slug]" }, body: "the page" })
    expect(head.body).toBe("")
    expect(file.body).toBe("")
    expect(seen.map((call) => call.method)).toEqual(["GET", "HEAD", "GET"])
    for (const call of seen) {
      expect(call.headers["User-Agent"]).toBe(USER_AGENT)
      expect(Object.keys(call.headers).map((name) => name.toLowerCase())).not.toContain("cookie")
      expect(Object.keys(call.headers).map((name) => name.toLowerCase())).not.toContain("authorization")
      expect(call.body).toBeUndefined()
    }
  })

  it("does not throw when a host does not answer: the status is 0 and the error says what happened", async () => {
    const hang = ((_url: string | URL | Request, init: RequestInit = {}) =>
      new Promise((_resolve, reject) => init.signal?.addEventListener("abort", () => reject(init.signal?.reason)))) as typeof fetch
    expect(await reader(hang, 20)("https://example.test/slow")).toEqual({ status: 0, headers: {}, body: "", error: "TimeoutError" })
    const refused = (async () => {
      throw new TypeError("fetch failed")
    }) as typeof fetch
    expect(await reader(refused, 1000)("https://example.test/down")).toMatchObject({ status: 0, error: "TypeError" })
  })
})

describe("checkProduction", () => {
  const ASSETS = Array.from({ length: 12 }, (_, at) => `https://cdn.example.test/files/p/production/asset-${at}.webp`)

  /** A stand-in of the site, its sitemap, its API, the project and its CDN; `serve` overrides what one path answers. It records what was asked and how many HEADs were in flight at once. */
  function standIn(serve: Record<string, () => Response> = {}, game: GameSeo = seo()) {
    const asked: { method: string; url: URL }[] = []
    let inFlight = 0
    let most = 0
    const files: Record<string, string> = { "/skyjo/opengraph-image/share": "image/png", "/skyjo/manifest.webmanifest": "application/manifest+json", "/skyjo/icons/favicon": "image/png", "/skyjo/icons/apple": "image/png" }
    const fetcher = (async (input: string | URL | Request, init: RequestInit = {}) => {
      const url = new URL(String(input))
      asked.push({ method: String(init.method), url })
      const path = `${url.pathname}${url.search}`
      const custom = serve[url.pathname] ?? serve[url.host]
      if (custom) return custom()
      if (url.host === "0kx7tx6t.api.sanity.io") return Response.json({ result: ASSETS })
      if (url.host === "cdn.example.test") {
        inFlight += 1
        most = Math.max(most, inFlight)
        await new Promise((done) => setTimeout(done, 4))
        inFlight -= 1
        return new Response(null, { status: 200 })
      }
      if (url.pathname === "/skyjo" || url.pathname === "/game/skyjo") return new Response(html(game), { headers: { "x-matched-path": "/game/[slug]", "content-type": "text/html" } })
      if (url.pathname === "/sitemap.xml") return new Response(`<urlset><url><loc>${SITE}/game/skyjo</loc><changefreq>weekly</changefreq><priority>0.8</priority></url></urlset>`)
      if (path === "/api/skyjo/games/%21") return Response.json({ error: "INVALID_CODE" }, { status: 400 })
      if (files[url.pathname]) return new Response("file", { headers: { "content-type": files[url.pathname] ?? "" } })
      return new Response("not found", { status: 404 })
    }) as typeof fetch
    return { fetcher, asked, most: () => most }
  }

  it("passes a game whose pages, sitemap, API, files and pictures are the live game's, asking with GET and HEAD alone", async () => {
    const site = standIn()
    const checks = await checkProduction(GAME, { site: `${SITE}/`, sanityProjectId: "0kx7tx6t", fetch: site.fetcher, concurrency: 3 })
    expect(failing(checks)).toEqual([])
    expect(checks.at(-1)).toEqual({ label: "published pictures and files load (12 files of the project 0kx7tx6t)", ok: true, detail: "all 200" })
    // every request was a read, and the files of the CDN were asked for a few at a time
    expect(new Set(site.asked.map((call) => call.method))).toEqual(new Set(["GET", "HEAD"]))
    expect(site.asked.filter((call) => call.method === "HEAD").every((call) => call.url.host === "cdn.example.test")).toBe(true)
    expect(site.most()).toBeLessThanOrEqual(3)
    expect(site.most()).toBeGreaterThan(1)
  })

  it("tells the checks in order: the two addresses, the sitemap, the API, the files, the pictures", async () => {
    const checks = await checkProduction(GAME, { site: SITE, sanityProjectId: "0kx7tx6t", fetch: standIn().fetcher })
    const labels = checks.map((check) => check.label)
    expect(labels[0]).toBe("/skyjo: 200 and the hub page of the game")
    expect(labels.indexOf("/game/skyjo: 200 and the hub page of the game")).toBeGreaterThan(10)
    expect(labels.slice(-8)).toEqual([
      "/sitemap.xml lists /game/skyjo",
      "/sitemap.xml: the entry is a live game's (weekly, 0.8)",
      "API: an invalid table code is INVALID_CODE (the game is known), not GAME_NOT_FOUND",
      "/skyjo/opengraph-image/share: 200 and image/",
      "/skyjo/manifest.webmanifest: 200 and application/manifest+json",
      "/skyjo/icons/favicon: 200 and image/",
      "/skyjo/icons/apple: 200 and image/",
      "published pictures and files load (12 files of the project 0kx7tx6t)",
    ])
  })

  it("fails what production does not say: a page that is the game's to come, a file that is gone, a picture that does not load", async () => {
    const site = standIn({
      "/skyjo/manifest.webmanifest": () => new Response("", { status: 404 }),
      "cdn.example.test": () => new Response(null, { status: 404 }),
    })
    const checks = await checkProduction(GAME, { site: SITE, sanityProjectId: "0kx7tx6t", fetch: site.fetcher })
    expect(failing(checks)).toEqual(["/skyjo/manifest.webmanifest: 200 and application/manifest+json", "published pictures and files load (12 files of the project 0kx7tx6t)"])
    const soon = await checkProduction(GAME, { site: SITE, sanityProjectId: "0kx7tx6t", fetch: standIn({}, seo({ live: false })).fetcher })
    expect(failing(soon)).toContain(`/skyjo: description starts with the lead of a live game ("${playLead({ name: "Skyjo", live: true })}")`)
  })

  it("fails a game whose project id is not one, and a site that does not answer", async () => {
    const checks = await checkProduction(GAME, { site: SITE, sanityProjectId: "__SANITY_PROJECT_ID__", fetch: standIn().fetcher })
    expect(failing(checks)).toEqual(["the game has a Sanity project"])
    const down = (async () => {
      throw new TypeError("fetch failed")
    }) as typeof fetch
    const silent = await checkProduction(GAME, { site: SITE, sanityProjectId: "0kx7tx6t", fetch: down, timeoutMs: 50 })
    expect(silent.every((check) => !check.ok)).toBe(true)
    expect(silent[0]?.detail).toBe("no answer (TypeError)")
  })
})

describe("describeChecks", () => {
  it("tells each check on a line, with what was found, and counts them", () => {
    const lines = describeChecks("skyjo", SITE, [
      { label: "a passes", ok: true, detail: "HTTP 200" },
      { label: "b fails", ok: false, detail: "" },
    ])
    expect(lines).toEqual(["✓ a passes  [HTTP 200]", "✗ b fails", "", `1 of 2 checks pass for skyjo on ${SITE}`])
  })
})
