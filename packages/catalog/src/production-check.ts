// The read-only checks of a game that went live (`pnpm check:production <slug>`, section 5 of the skill `game-go-live`): what production says of the game once the pull request that turned its `live` and
// `indexable` flags on is merged and deployed. GET and HEAD only: no account, no cookie, no table, nothing is written. The checks are pure functions of answers that were read already, so that a test hands
// them fixtures; `checkProduction` reads the answers. Run by Node itself (type stripping, like `scout-state.ts`), hence the `.ts` extensions of the value imports below.
//
// What is expected comes from the code that makes it, not from a copy of its words. The title and the lead of the description are `playTitle` and `playLead` (`play-phrase.ts`, which `seo.ts` builds the page
// from), and the rest (the canonical address, the robots meta, Open Graph, the JSON-LD, the line of the sitemap) is the shape that `seo.ts` makes: `production-check.test.ts` builds its pages with `gameMetadata`,
// `gameJsonLd` and `sitemapItems`, so a change of the SEO that this file does not follow fails there. What the page's own components say (the Play button, the Create a table link, the sentence of a game that is
// not live) is read from their source by the same test.
import { playLead, playTitle } from "./play-phrase.ts"
import { SANITY_API_VERSION } from "./sanity.ts"

/** Who asks, so that a site's logs can tell these requests from a visitor's. */
export const USER_AGENT = "pbgo-check-production/1.0 (read only)"

/** What the checks need to know of a game: its row of the registry. The game is live. */
export type ProductionGame = { slug: string; name: string; indexable: boolean }

/** One check: what it looks at, whether it passes, and what was found. */
export type Check = { label: string; ok: boolean; detail: string }

/** An answer that was read: the status (0 when the host did not answer, and `error` says what happened), the headers with lower-case names, and the body ("" for a HEAD and for a file). */
export type Answer = { status: number; headers: Record<string, string>; body: string; error?: string }

// ---------- what the site says, as it makes it ----------

/** The hub page of a game, `gamePath` of `@pbgo/core/lib/site-url`: the one that the canonical address, the JSON-LD and the sitemap name. `/<slug>` shows the same page. */
export const gamePagePath = (slug: string) => `/game/${slug}`

/** A game's share image, `shareImagePath` of `@pbgo/core/lib/site-url`. */
export const shareImagePath = (slug: string) => `/${slug}/opengraph-image/share`

/** The line of the sitemap of a live game's page, as `sitemapItems` of `seo.ts` writes it. */
export const LIVE_SITEMAP = { changeFrequency: "weekly", priority: 0.8 } as const

/** The route that answers a table code of the game: a code that cannot be one is `INVALID_CODE` (400) when the game is known, and a game the router does not know answers `GAME_NOT_FOUND` (404) to any code. */
export const apiPath = (slug: string) => `/api/${slug}/games/%21`

/** The files that every game serves for its own pages (`apps/web/src/app/[game]`), each with the kind of content it must come as. */
export const gameFiles = (slug: string): { path: string; type: string }[] => [
  { path: shareImagePath(slug), type: "image/" },
  { path: `/${slug}/manifest.webmanifest`, type: "application/manifest+json" },
  { path: `/${slug}/icons/favicon`, type: "image/" },
  { path: `/${slug}/icons/apple`, type: "image/" },
]

/** What the page of a game that is not live says where a table could be opened (`game-play.tsx`): its text is the start of the sentence. */
export const tablesComingText = (name: string) => `You will be able to open a table of ${name}`

// ---------- reading HTML ----------

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " }

/** A text as a reader gets it: the entities that the page writes (`&amp;`, `&#x27;`, `&#8217;`) decoded. */
export function decodeEntities(text: string): string {
  return text.replace(/&(?:#(\d+)|#x([0-9a-f]+)|([a-z]+));/gi, (whole, decimal: string | undefined, hexadecimal: string | undefined, name: string | undefined) => {
    if (name !== undefined) return ENTITIES[name.toLowerCase()] ?? whole
    const code = decimal !== undefined ? Number(decimal) : parseInt(hexadecimal ?? "", 16)
    return Number.isInteger(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : whole
  })
}

type Attributes = Record<string, string>

/** The attributes of one start tag: names in lower case, values decoded, a boolean attribute (`disabled`) as "". */
function attributesOf(tag: string): Attributes {
  const attributes: Attributes = {}
  for (const found of tag.replace(/^<[a-z][a-z0-9-]*/i, "").matchAll(/([^\s"'<>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'<>]+)))?/g)) {
    attributes[(found[1] ?? "").toLowerCase()] = decodeEntities(found[2] ?? found[3] ?? found[4] ?? "")
  }
  return attributes
}

/** The page without its scripts and styles: their text is code, and an attribute of a tag never holds a raw `>` (the page writes `&gt;`), so a tag ends at the first one. */
const withoutCode = (page: string) => page.replace(/<script\b[\s\S]*?<\/script>/gi, " ").replace(/<style\b[\s\S]*?<\/style>/gi, " ")

/** The text of a piece of HTML, on one line: its tags gone (each is a space, so two words never run together), its entities decoded. */
const textOf = (html: string) => decodeEntities(html.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim()

/** What a visitor reads on the page, on one line. */
export const visibleText = (page: string) => textOf(withoutCode(page))

/** Every start tag with this name, with its attributes. */
const tagsNamed = (markup: string, name: string): Attributes[] => [...markup.matchAll(new RegExp(`<${name}\\b[^>]*>`, "gi"))].map((found) => attributesOf(found[0]))

/** The contents of the `<meta>` tags with this `name` or `property`. */
const metaContents = (markup: string, key: "name" | "property", value: string): string[] =>
  tagsNamed(markup, "meta")
    .filter((attributes) => attributes[key]?.toLowerCase() === value)
    .map((attributes) => attributes.content ?? "")

/** The elements with this name that have text, with their attributes and their text: the buttons and the links of the page. */
function elementsNamed(markup: string, name: string): { attributes: Attributes; text: string }[] {
  return [...markup.matchAll(new RegExp(`<${name}\\b([^>]*)>([\\s\\S]*?)</${name}>`, "gi"))].map((found) => ({ attributes: attributesOf(`<${name}${found[1] ?? ""}>`), text: textOf(found[2] ?? "") }))
}

/** The JSON-LD blocks of the page: the ones that parse, and how many did not. */
function jsonLdOf(page: string): { blocks: unknown[]; broken: number } {
  const blocks: unknown[] = []
  let broken = 0
  for (const found of page.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      blocks.push(JSON.parse(found[1] ?? ""))
    } catch {
      broken += 1
    }
  }
  return { blocks, broken }
}

const short = (text: string, max = 90) => (text.length > max ? `${text.slice(0, max - 1)}…` : text)
const said = (answer: Answer) => (answer.status === 0 ? `no answer (${answer.error ?? "unknown error"})` : `HTTP ${answer.status}`)

// ---------- the pages of the game ----------

/**
 * What a page of the game says, `/<slug>` and `/game/<slug>` alike (the first is the second shown under another address, whose canonical address is the second): that it is the hub page of the game, found by its
 * phrase and described by its lead, that search engines may come in (or stay out, when the registry says the game is not indexable), the canonical address, Open Graph, the JSON-LD, and what the page itself says of
 * a game that is live: no "Coming soon", a Play button that is not disabled, a link that creates a table.
 */
export function pageChecks(game: ProductionGame, site: string, path: string, answer: Answer): Check[] {
  const { name, slug } = game
  const matched = answer.headers["x-matched-path"] ?? ""
  const reached: Check = {
    label: `${path}: 200 and the hub page of the game`,
    ok: answer.status === 200 && (matched === "" || matched === "/game/[slug]"),
    detail: `${said(answer)}${matched ? `, ${matched}` : ""}`,
  }
  // Nothing else can be said of a page that was not read
  if (answer.status !== 200) return [reached]

  const markup = withoutCode(answer.body)
  const text = textOf(markup)
  const canonicalUrl = `${site}${gamePagePath(slug)}`
  const phrase = playTitle(name)
  const title = /<title\b[^>]*>([\s\S]*?)<\/title>/i.exec(markup)?.[1]
  const description = metaContents(markup, "name", "description")[0]
  const robots = (metaContents(markup, "name", "robots")[0] ?? "").toLowerCase().split(",").map((token) => token.trim())
  const canonical = tagsNamed(markup, "link").find((attributes) => attributes.rel?.toLowerCase() === "canonical")?.href
  const ogTitle = metaContents(markup, "property", "og:title")[0]
  const ogImage = metaContents(markup, "property", "og:image")[0]
  const ogUrl = metaContents(markup, "property", "og:url")[0]
  const ld = jsonLdOf(answer.body)
  const gameLd = ld.blocks.find((block): block is Record<string, unknown> => typeof block === "object" && block !== null && (block as { "@type"?: unknown })["@type"] === "Game")
  const xRobots = answer.headers["x-robots-tag"] ?? ""
  const buttons = elementsNamed(markup, "button")
  const links = elementsNamed(markup, "a")

  const checks: Check[] = [reached]
  // Search engines: a header that says noindex would override every meta of the page
  if (game.indexable) checks.push({ label: `${path}: no X-Robots-Tag noindex`, ok: !/noindex/i.test(xRobots), detail: xRobots || "none" })
  checks.push({ label: `${path}: title starts with "${phrase}"`, ok: title !== undefined && decodeEntities(title).trim().startsWith(phrase), detail: title === undefined ? "no title" : decodeEntities(title).trim() })
  const lead = playLead({ name, live: true })
  checks.push({ label: `${path}: description starts with the lead of a live game ("${lead}")`, ok: description?.startsWith(lead) ?? false, detail: description === undefined ? "no description" : short(description) })
  checks.push({ label: `${path}: description is not the coming-soon one`, ok: description === undefined || !description.startsWith(playLead({ name, live: false })), detail: description === undefined ? "no description" : short(description, 60) })
  checks.push(
    game.indexable
      ? { label: `${path}: robots meta lets search engines in`, ok: robots.includes("index") && !robots.includes("noindex"), detail: robots.join(", ") || "no robots meta" }
      : { label: `${path}: robots meta keeps search engines out (the game is not indexable)`, ok: robots.includes("noindex"), detail: robots.join(", ") || "no robots meta" },
  )
  checks.push({ label: `${path}: canonical is ${gamePagePath(slug)}`, ok: canonical === canonicalUrl, detail: canonical ?? "none" })
  checks.push({ label: `${path}: Open Graph title and image`, ok: (ogTitle?.startsWith(phrase) ?? false) && !!ogImage, detail: ogImage ? short(ogImage, 100) : "no og:image" })
  checks.push({ label: `${path}: Open Graph address is the canonical one`, ok: ogUrl === canonicalUrl, detail: ogUrl ?? "no og:url" })
  checks.push({
    label: `${path}: JSON-LD is the game's (a Game named ${name}, at ${gamePagePath(slug)})`,
    ok: gameLd !== undefined && gameLd.name === name && gameLd.url === canonicalUrl,
    detail:
      gameLd !== undefined
        ? `${String(gameLd.name)}, ${String(gameLd.url)}`
        : ld.blocks.length + ld.broken === 0
          ? "no JSON-LD block"
          : `${ld.blocks.length} block(s), none a Game${ld.broken ? `, ${ld.broken} that do not parse` : ""}`,
  })
  // What the page says of a live game. The head's badge sits right after the Back link, before the figures: "Back Coming soon 2–10 players", or after the heading when the name is text
  const badge = /\bBack\b.{0,100}?\bComing soon\b/.exec(text)
  checks.push({ label: `${path}: the head has no "Coming soon" badge`, ok: badge === null, detail: badge === null ? "nothing after the Back link says it" : short(badge[0], 80) })
  const coming = tablesComingText(name)
  checks.push({ label: `${path}: the table space does not say that tables are coming`, ok: !text.includes(coming), detail: text.includes(coming) ? `the page says "${coming}…": it is the page of a game that is not live` : `no "${coming}…"` })
  const play = buttons.find((button) => button.text === "Play")
  const create = links.find((link) => link.text === "Create a table")
  checks.push({
    label: `${path}: a table can be opened (a Play button that is not disabled, a Create a table link)`,
    ok: play !== undefined && !("disabled" in play.attributes) && create !== undefined,
    detail: `${play === undefined ? "no Play button" : "disabled" in play.attributes ? "Play is disabled" : "Play"}, ${create === undefined ? "no Create a table link" : "Create a table"}`,
  })
  return checks
}

// ---------- the sitemap, the API, the files ----------

/** The lines of a sitemap: the address of each page, with how often it changes and its priority, as the page's text says them. */
function sitemapEntries(xml: string): { loc: string; changefreq: string | null; priority: string | null }[] {
  return [...xml.matchAll(/<url>([\s\S]*?)<\/url>/gi)].map((found) => {
    const block = found[1] ?? ""
    const field = (tag: string) => {
      const value = new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, "i").exec(block)?.[1]
      return value === undefined ? null : decodeEntities(value).trim()
    }
    return { loc: field("loc") ?? "", changefreq: field("changefreq"), priority: field("priority") }
  })
}

/** The sitemap lists the game's hub page as a live game's (weekly, 0.8), or does not list it when the game is not indexable. */
export function sitemapChecks(game: ProductionGame, site: string, answer: Answer): Check[] {
  const path = gamePagePath(game.slug)
  if (answer.status !== 200) return [{ label: "/sitemap.xml answers", ok: false, detail: said(answer) }]
  const entry = sitemapEntries(answer.body).find((each) => each.loc === `${site}${path}`)
  if (!game.indexable) return [{ label: `/sitemap.xml does not list ${path} (the game is not indexable)`, ok: entry === undefined, detail: entry === undefined ? "not listed" : "listed" }]
  const listed: Check = { label: `/sitemap.xml lists ${path}`, ok: entry !== undefined, detail: said(answer) }
  if (entry === undefined) return [listed]
  return [
    listed,
    {
      label: `/sitemap.xml: the entry is a live game's (${LIVE_SITEMAP.changeFrequency}, ${LIVE_SITEMAP.priority})`,
      ok: entry.changefreq === LIVE_SITEMAP.changeFrequency && Number(entry.priority) === LIVE_SITEMAP.priority,
      detail: `${entry.changefreq ?? "no changefreq"}, ${entry.priority ?? "no priority"}`,
    },
  ]
}

/** The API answers for the game: a table code that cannot be one is refused as such (400 `INVALID_CODE`), which only a game that the router knows does. */
export function apiCheck(answer: Answer): Check {
  return { label: "API: an invalid table code is INVALID_CODE (the game is known), not GAME_NOT_FOUND", ok: answer.status === 400 && answer.body.includes("INVALID_CODE"), detail: `${said(answer)} ${short(answer.body, 60)}`.trim() }
}

/** One of the game's own files (share image, manifest, icons) is served, as the kind of file it is. */
export function fileCheck(path: string, type: string, answer: Answer): Check {
  const contentType = answer.headers["content-type"] ?? ""
  return { label: `${path}: 200 and ${type}`, ok: answer.status === 200 && contentType.startsWith(type), detail: `${said(answer)}${contentType ? `, ${contentType}` : ""}` }
}

// ---------- the pictures and files of the game's own Sanity project ----------

/** The URL of every picture and file that a published document of the project points at (cards, card back, logo, fonts, sounds, rulebooks…): the assets themselves, so that no field of any game has to be named. */
export const PUBLISHED_FILES_QUERY = `*[_type in ["sanity.imageAsset", "sanity.fileAsset"] && count(*[references(^._id)]) > 0].url`

/** The address of the query, on the project's API itself (not its CDN: what was published a minute ago counts). */
export const publishedFilesUrl = (projectId: string, apiBase = `https://${projectId}.api.sanity.io`) =>
  `${apiBase}/v${SANITY_API_VERSION}/data/query/production?perspective=published&query=${encodeURIComponent(PUBLISHED_FILES_QUERY)}`

/** The addresses that the answer of the query lists: public http(s) ones, once each. `null` when the answer is not a list. */
export function filesOf(answer: Answer): string[] | null {
  let parsed: unknown
  try {
    parsed = JSON.parse(answer.body)
  } catch {
    return null
  }
  const result = typeof parsed === "object" && parsed !== null ? (parsed as { result?: unknown }).result : undefined
  if (!Array.isArray(result)) return null
  return [...new Set(result.filter((url): url is string => typeof url === "string" && /^https?:\/\//.test(url)))]
}

/** The published pictures and files of the game's project all load. How many there are is said, not asserted: a game has what its content holds. */
export function pictureChecks(projectId: string, query: Answer, heads: { url: string; answer: Answer }[] | null): Check[] {
  if (query.status !== 200) return [{ label: `the game's Sanity project (${projectId}) answers`, ok: false, detail: `${said(query)}: the project or its production dataset is not there, or is private` }]
  if (heads === null) return [{ label: `the game's Sanity project (${projectId}) lists its published files`, ok: false, detail: "its answer is not a list of addresses" }]
  if (heads.length === 0) return [{ label: `the published pictures and files of the game's Sanity project (${projectId}) load`, ok: false, detail: "no picture or file is used by a published document: the game would show stand-ins" }]
  const failing = heads.filter(({ answer }) => answer.status !== 200)
  return [
    {
      label: `published pictures and files load (${heads.length} files of the project ${projectId})`,
      ok: failing.length === 0,
      detail: failing.length === 0 ? "all 200" : `${failing.length} failing: ${failing.slice(0, 3).map(({ url, answer }) => `${said(answer)} ${short(url, 80)}`).join(", ")}`,
    },
  ]
}

// ---------- reading, and the whole run ----------

/** Reads one address with GET or HEAD, never throwing: a host that does not answer is `status` 0 and says why. `body: false` leaves the body of a file unread. */
export function reader(doFetch: typeof fetch, timeoutMs: number) {
  return async (url: string, { method = "GET", body = true }: { method?: "GET" | "HEAD"; body?: boolean } = {}): Promise<Answer> => {
    try {
      const response = await doFetch(url, { method, headers: { "User-Agent": USER_AGENT, Accept: "*/*" }, redirect: "follow", signal: AbortSignal.timeout(timeoutMs) })
      const headers = Object.fromEntries([...response.headers].map(([name, value]) => [name.toLowerCase(), value]))
      if (method === "HEAD" || !body) {
        await response.body?.cancel()
        return { status: response.status, headers, body: "" }
      }
      return { status: response.status, headers, body: await response.text() }
    } catch (error) {
      return { status: 0, headers: {}, body: "", error: error instanceof Error ? error.name : "unknown error" }
    }
  }
}

/** Runs `run` on each item, `size` at a time, and gives the results in the order of the items. */
async function pool<T, R>(items: readonly T[], size: number, run: (item: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length)
  let next = 0
  await Promise.all(
    Array.from({ length: Math.min(size, items.length) }, async () => {
      for (;;) {
        const at = next
        next += 1
        if (at >= items.length) return
        results[at] = await run(items[at] as T)
      }
    }),
  )
  return results
}

export type RunOptions = {
  /** The site to read, with no path: the address that its pages must name as their own. */
  site: string
  /** The game's own Sanity project. */
  sanityProjectId: string
  /** Defaults to the global `fetch`. */
  fetch?: typeof fetch
  /** 30 seconds by default, for each request. */
  timeoutMs?: number
  /** How many files of the project are asked for at once (8 by default). */
  concurrency?: number
  /** Where the project's API is (`https://<project>.api.sanity.io` by default). */
  sanityApi?: string
}

/** Every check, in the order they are told: the two pages, the sitemap, the API, the game's files, the project's pictures. */
export async function checkProduction(game: ProductionGame, options: RunOptions): Promise<Check[]> {
  const site = options.site.replace(/\/+$/, "")
  const read = reader(options.fetch ?? fetch, options.timeoutMs ?? 30_000)
  const paths = [`/${game.slug}`, gamePagePath(game.slug)]
  const files = gameFiles(game.slug)
  const sanity = async (): Promise<Check[]> => {
    if (!/^[a-z0-9-]+$/.test(options.sanityProjectId)) return [{ label: "the game has a Sanity project", ok: false, detail: "its id is not one (the registry still holds the placeholder?)" }]
    const query = await read(publishedFilesUrl(options.sanityProjectId, options.sanityApi))
    const urls = query.status === 200 ? filesOf(query) : []
    const heads = urls === null ? null : await pool(urls, options.concurrency ?? 8, async (url) => ({ url, answer: await read(url, { method: "HEAD" }) }))
    return pictureChecks(options.sanityProjectId, query, heads)
  }
  const [pages, sitemap, api, served, pictures] = await Promise.all([
    Promise.all(paths.map((path) => read(`${site}${path}`))),
    read(`${site}/sitemap.xml`),
    read(`${site}${apiPath(game.slug)}`),
    Promise.all(files.map(({ path }) => read(`${site}${path}`, { body: false }))),
    sanity(),
  ])
  return [
    ...paths.flatMap((path, at) => pageChecks(game, site, path, pages[at] as Answer)),
    ...sitemapChecks(game, site, sitemap),
    apiCheck(api),
    ...files.map(({ path, type }, at) => fileCheck(path, type, served[at] as Answer)),
    ...pictures,
  ]
}

/** The report, one line a check and a last line that counts them. */
export function describeChecks(slug: string, site: string, checks: readonly Check[]): string[] {
  const passed = checks.filter((check) => check.ok).length
  return [...checks.map((check) => `${check.ok ? "✓" : "✗"} ${check.label}${check.detail ? `  [${check.detail}]` : ""}`), "", `${passed} of ${checks.length} checks pass for ${slug} on ${site}`]
}
