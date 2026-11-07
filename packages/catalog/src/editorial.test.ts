import { describe, expect, it } from "vitest"
import {
  BANNERS_MAX,
  EDITORIAL_QUERY,
  NEWS_MAX,
  TEXT_MAX,
  WHATS_NEW_HREF,
  activeAnnouncements,
  bannersOf,
  entryHref,
  excerptOf,
  newsOf,
  parseEditorial,
  readEditorial,
  type Announcement,
  type ChangelogEntry,
} from "./editorial"
import { PLATFORM_DATASET, PLATFORM_PROJECT_ID, SANITY_API_VERSION, SanityError } from "./sanity"
import { cdn, groqSanity, imageAsset, imageOf, sanityFailure } from "./testing"

const entry = (overrides: Partial<ChangelogEntry> = {}): ChangelogEntry => ({ id: "e", title: "A title", date: "2026-11-01", kind: "feature", text: "", image: null, games: [], ...overrides })
const announcement = (overrides: Partial<Announcement> = {}): Announcement => ({
  id: "a",
  title: "A title",
  message: "A message",
  tone: "info",
  link: null,
  game: null,
  dismissible: true,
  startsAt: null,
  endsAt: null,
  ...overrides,
})

/** A fake `fetch` that answers with `body` (or with a failure), and remembers what it was asked. */
function fakeFetch(answer: { status?: number; body: unknown }) {
  const calls: Array<{ url: URL; init: RequestInit }> = []
  const fetcher = (async (input: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: new URL(String(input)), init: init ?? {} })
    return new Response(JSON.stringify(answer.body), { status: answer.status ?? 200, headers: { "content-type": "application/json" } })
  }) as typeof fetch
  return { fetch: fetcher, calls }
}

describe("the request", () => {
  it("is one GET of the public API of the platform's project, through its CDN, on the published documents, with the query", async () => {
    const sanity = fakeFetch({ body: { result: { announcements: [], entries: [] } } })
    await readEditorial({ fetch: sanity.fetch })
    expect(sanity.calls).toHaveLength(1)
    const [call] = sanity.calls
    expect(call?.url.origin).toBe(`https://${PLATFORM_PROJECT_ID}.apicdn.sanity.io`)
    expect(call?.url.pathname).toBe(`/v${SANITY_API_VERSION}/data/query/${PLATFORM_DATASET}`)
    expect(call?.url.searchParams.get("perspective")).toBe("published")
    expect(call?.url.searchParams.get("query")).toBe(EDITORIAL_QUERY)
    expect(call?.init.method).toBe("GET")
    expect(call?.init.headers).toEqual({ Accept: "application/json" })
    expect(call?.init.signal).toBeInstanceOf(AbortSignal)
  })

  it("carries the options of the caller (Next's cache) without letting them change the method", async () => {
    const sanity = fakeFetch({ body: { result: { announcements: [], entries: [] } } })
    await readEditorial({ fetch: sanity.fetch, init: { method: "POST", next: { revalidate: 600, tags: ["editorial"] } } as RequestInit })
    expect(sanity.calls[0]?.init).toMatchObject({ method: "GET", next: { revalidate: 600, tags: ["editorial"] } })
  })

  it("throws a SanityError, with no address in it, when Sanity cannot be reached", async () => {
    const error = await readEditorial({
      fetch: (async () => {
        throw new TypeError("fetch failed https://secret.example/x")
      }) as typeof fetch,
    }).catch((e: unknown) => e)
    expect(error).toBeInstanceOf(SanityError)
    expect(error).toMatchObject({ status: 0, message: "The platform's Sanity project could not be reached (TypeError)" })
    expect(String((error as Error).message)).not.toContain("secret.example")
  })

  it("throws what Sanity says when it refuses, and when it answers with something else", async () => {
    const refused = await readEditorial({ fetch: fakeFetch(sanityFailure(400, "query parse error")).fetch }).catch((e: unknown) => e)
    expect(refused).toMatchObject({ status: 400, message: "Sanity answered 400: query parse error" })
    for (const body of [{ result: null }, { result: { announcements: [] } }, { result: { announcements: {}, entries: [] } }, "text"]) {
      const odd = await readEditorial({ fetch: fakeFetch({ body }).fetch }).catch((e: unknown) => e)
      expect(odd, JSON.stringify(body)).toBeInstanceOf(SanityError)
    }
  })
})

describe("the query, run by a real GROQ engine over documents as the Studio stores them", () => {
  const picture = imageAsset("abc123", 1600, 900, "webp")
  const block = (text: string) => ({ _type: "block", _key: text.slice(0, 4), style: "normal", markDefs: [], children: [{ _type: "span", _key: "s", text, marks: [] }] })
  const dataset = [
    picture,
    { _id: "game-courtisans", _type: "game", slug: { _type: "slug", current: "courtisans" } },
    {
      _id: "entry-old",
      _type: "changelogEntry",
      title: "Old",
      date: "2026-09-01",
      kind: "fix",
    },
    {
      _id: "entry-new",
      _type: "changelogEntry",
      title: "Courtisans is live",
      date: "2026-11-01",
      kind: "newGame",
      body: [block("Play it now."), block("With friends.")],
      image: imageOf(picture),
      games: [{ _type: "reference", _ref: "game-courtisans", _key: "g1" }],
    },
    { _id: "entry-undated", _type: "changelogEntry", title: "No date", kind: "feature" },
    {
      _id: "announcement-1",
      _type: "announcement",
      title: "Maintenance",
      message: "A short break tonight.",
      tone: "alert",
      startsAt: "2026-11-07T10:00:00Z",
      endsAt: "2026-11-08T10:00:00Z",
      link: { url: "https://example.com/status", label: "Status" },
      dismissible: false,
      game: { _type: "reference", _ref: "game-courtisans" },
    },
    { _id: "drafts.announcement-2", _type: "announcement", title: "A draft", message: "Not published", tone: "info" },
  ]
  const fetcher = ((input: string | URL | Request, init?: RequestInit) => Promise.resolve(groqSanity(dataset)(new URL(String(input)), init ?? {}))) as typeof fetch

  it("reads the newest entries first, with the plain start of their text, their picture and the slugs of their games", async () => {
    const { entries } = await readEditorial({ fetch: fetcher })
    expect(entries.map((e) => e.id)).toEqual(["entry-new", "entry-old"])
    expect(entries[0]).toEqual({
      id: "entry-new",
      title: "Courtisans is live",
      date: "2026-11-01",
      kind: "newGame",
      text: "Play it now.\n\nWith friends.".replace(/\s+/g, " "),
      image: cdn("abc123-1600x900.webp"),
      games: ["courtisans"],
    })
    expect(entries[1]).toMatchObject({ id: "entry-old", text: "", image: null, games: [] })
  })

  it("reads the published announcements with their link and the slug of their game, and leaves a draft out", async () => {
    const { announcements } = await readEditorial({ fetch: fetcher })
    expect(announcements).toEqual([
      {
        id: "announcement-1",
        title: "Maintenance",
        message: "A short break tonight.",
        tone: "alert",
        link: { url: "https://example.com/status", label: "Status" },
        game: "courtisans",
        dismissible: false,
        startsAt: "2026-11-07T10:00:00Z",
        endsAt: "2026-11-08T10:00:00Z",
      },
    ])
  })
})

describe("parseEditorial", () => {
  const parse = (announcements: unknown[], entries: unknown[]) => parseEditorial({ announcements, entries })

  it("leaves out an announcement with no title or no message, or that is not a document", () => {
    const parsed = parse([{ _id: "1", title: "Ok", message: "Ok" }, { _id: "2", title: "", message: "x" }, { _id: "3", title: "x", message: "  " }, { title: "x", message: "x" }, null, "text"], [])
    expect(parsed.announcements.map((a) => a.id)).toEqual(["1"])
  })

  it("takes the tone info for a tone it does not know, and keeps a link only when it is http(s)", () => {
    const [a, b, c] = parse(
      [
        { _id: "1", title: "t", message: "m", tone: "bright", link: { url: "javascript:alert(1)", label: "x" } },
        { _id: "2", title: "t", message: "m", tone: "success", link: { url: "https://example.com", label: "  Go  there " } },
        { _id: "3", title: "t", message: "m", link: { url: "https://example.com" } },
      ],
      [],
    ).announcements
    expect(a).toMatchObject({ tone: "info", link: null })
    expect(b).toMatchObject({ tone: "success", link: { url: "https://example.com", label: "Go there" } })
    expect(c?.link).toEqual({ url: "https://example.com", label: "Read more" })
  })

  it("can be dismissed unless the Studio says it cannot, and keeps only dates that exist", () => {
    const [a, b] = parse(
      [
        { _id: "1", title: "t", message: "m" },
        { _id: "2", title: "t", message: "m", dismissible: false, startsAt: "2026-11-07T10:00:00Z", endsAt: "not a date" },
      ],
      [],
    ).announcements
    expect(a).toMatchObject({ dismissible: true, startsAt: null, endsAt: null })
    expect(b).toMatchObject({ dismissible: false, startsAt: "2026-11-07T10:00:00Z", endsAt: null })
  })

  it("leaves out an entry with no title, no real day or a kind the Studio does not have", () => {
    const parsed = parse(
      [],
      [
        { _id: "1", title: "Ok", date: "2026-11-01", kind: "feature" },
        { _id: "2", title: "", date: "2026-11-01", kind: "feature" },
        { _id: "3", title: "t", date: "2026-02-30", kind: "feature" },
        { _id: "4", title: "t", date: "2026-11-01", kind: "gossip" },
        { title: "t", date: "2026-11-01", kind: "feature" },
      ],
    )
    expect(parsed.entries.map((e) => e.id)).toEqual(["1"])
  })

  it("points an entry's picture only at the image CDN of the project it read", () => {
    const [a, b, c] = parse(
      [],
      [
        { _id: "1", title: "t", date: "2026-11-01", kind: "feature", image: cdn("a-800x600.webp") },
        { _id: "2", title: "t", date: "2026-11-01", kind: "feature", image: "https://evil.example/a.webp" },
        { _id: "3", title: "t", date: "2026-11-01", kind: "feature", image: cdn("a-800x600.webp", "other") },
      ],
    ).entries
    expect(a?.image).toBe(cdn("a-800x600.webp"))
    expect(b?.image).toBeNull()
    expect(c?.image).toBeNull()
  })

  it("keeps the slugs of the games, and nothing else", () => {
    expect(parse([], [{ _id: "1", title: "t", date: "2026-11-01", kind: "fix", games: ["courtisans", null, "", 4, "skyjo"] }]).entries[0]?.games).toEqual(["courtisans", "skyjo"])
    expect(parse([], [{ _id: "1", title: "t", date: "2026-11-01", kind: "fix", games: "courtisans" }]).entries[0]?.games).toEqual([])
  })
})

describe("excerptOf", () => {
  it("makes white space single spaces and keeps a short text whole", () => {
    expect(excerptOf("  Play\n\nit   now. ")).toBe("Play it now.")
    expect(excerptOf(undefined)).toBe("")
  })

  it("cuts a long text at a word, with an ellipsis, within the limit", () => {
    const text = "word ".repeat(80)
    const cut = excerptOf(text)
    expect(cut.endsWith("…")).toBe(true)
    expect(cut.length).toBeLessThanOrEqual(TEXT_MAX + 1)
    expect(cut.slice(0, -1).endsWith("word")).toBe(true)
  })

  it("cuts a text with no space at the limit", () => {
    expect(excerptOf("x".repeat(500))).toBe(`${"x".repeat(TEXT_MAX)}…`)
  })
})

describe("what the home shows", () => {
  const now = new Date("2026-11-07T12:00:00Z")

  it("shows an announcement whose time has come and not gone, and one with no time", () => {
    const list = [
      announcement({ id: "none" }),
      announcement({ id: "now", startsAt: "2026-11-07T10:00:00Z", endsAt: "2026-11-08T10:00:00Z" }),
      announcement({ id: "later", startsAt: "2026-11-07T13:00:00Z" }),
      announcement({ id: "gone", startsAt: "2026-11-01T00:00:00Z", endsAt: "2026-11-07T11:59:59Z" }),
      announcement({ id: "open-start", endsAt: "2026-11-07T12:00:00Z" }),
    ]
    expect(activeAnnouncements(list, now).map((a) => a.id)).toEqual(["none", "now", "open-start"])
  })

  it("makes banners of the newest entries that have a picture, three at most", () => {
    const entries = [entry({ id: "1" }), ...["2", "3", "4", "5"].map((id) => entry({ id, image: cdn(`${id}-800x600.webp`) }))]
    expect(bannersOf(entries).map((e) => e.id)).toEqual(["2", "3", "4"])
    expect(bannersOf(entries)).toHaveLength(BANNERS_MAX)
  })

  it("makes the news of the newest entries, with or without a picture, four at most", () => {
    const entries = ["1", "2", "3", "4", "5", "6"].map((id) => entry({ id }))
    expect(newsOf(entries).map((e) => e.id)).toEqual(["1", "2", "3", "4"])
    expect(newsOf(entries)).toHaveLength(NEWS_MAX)
  })

  it("leads an entry to the first game it is about that the hub lists, else to what's new", () => {
    const known = new Set(["courtisans", "skyjo"])
    expect(entryHref({ games: ["unlisted", "skyjo", "courtisans"] }, known)).toBe("/game/skyjo")
    expect(entryHref({ games: ["unlisted"] }, known)).toBe(WHATS_NEW_HREF)
    expect(entryHref({ games: [] }, known)).toBe(WHATS_NEW_HREF)
  })
})
