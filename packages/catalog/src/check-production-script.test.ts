import { execFile } from "node:child_process"
import { existsSync, readFileSync } from "node:fs"
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http"
import type { AddressInfo } from "node:net"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import { promisify } from "node:util"
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest"
import { GAMES } from "@pbgo/games/registry"
import { apiPath, gameFiles } from "./production-check"
import { html, seo, sitemapXml, type Body } from "./production-testing"
import { catalogEntry } from "./testing"

// `packages/catalog/scripts/check-production.ts` is run by Node itself (type stripping, no bundler), where the package's tsc and vitest cannot see what breaks: a value import without a `.ts` extension, a
// syntax Node does not strip. This runs it as `pnpm check:production` does, against a stand-in of the site that listens on a port of its own, and a stand-in of the game's Sanity project and its CDN (a preloaded
// `fetch` that answers for `*.api.sanity.io` and refuses every host but the stand-in's, so that no test reaches production).
const PACKAGE_DIR = fileURLToPath(new URL("..", import.meta.url))
const REPO = join(PACKAGE_DIR, "../..")
const NODE = ["--disable-warning=ExperimentalWarning"]
const STUB = `
const real = globalThis.fetch
globalThis.fetch = async (input, init) => {
  const host = new URL(String(input)).hostname
  if (host.endsWith(".api.sanity.io")) return new Response(process.env.SANITY_ANSWER, { status: Number(process.env.SANITY_STATUS ?? 200), headers: { "content-type": "application/json" } })
  if (host !== "127.0.0.1") throw new Error("a test talks to its stand-in only, not to " + host)
  return real(input, init)
}
`

const live = GAMES.find((game) => game.live && game.indexable)
const waiting = GAMES.find((game) => !game.live)
if (live === undefined || waiting === undefined) throw new Error("the registry needs a live and indexable game and one that is not live")

/** What the stand-in serves: the page of a live game, or the one of a game to come (its description, its badge, its table space and its disabled buttons). */
let mode: "live" | "soon" = "live"
const SOON: Body = { badge: true, tablesComing: true, disabled: true }

let server: Server
let origin = ""
const seen: { method: string; path: string }[] = []

function handle(request: IncomingMessage, response: ServerResponse) {
  const path = request.url ?? "/"
  seen.push({ method: request.method ?? "", path })
  const send = (status: number, type: string, body = "", headers: Record<string, string> = {}) => {
    response.writeHead(status, { "content-type": type, ...headers })
    response.end(request.method === "HEAD" ? undefined : body)
  }
  const game = seo({ slug: live?.slug ?? "", name: live?.name ?? "", live: mode === "live" })
  if (path === `/${live?.slug}` || path === `/game/${live?.slug}`) return send(200, "text/html; charset=utf-8", html(game, mode === "live" ? undefined : SOON, origin), { "x-matched-path": "/game/[slug]" })
  if (path === "/sitemap.xml") return send(200, "application/xml", sitemapXml([catalogEntry(live?.slug ?? "", { live: true, indexable: true })], origin))
  if (path === apiPath(live?.slug ?? "")) return send(400, "application/json", '{"error":"INVALID_CODE"}')
  const file = gameFiles(live?.slug ?? "").find((each) => each.path === path)
  if (file) return send(200, file.type === "image/" ? "image/png" : file.type, "file")
  if (path.startsWith("/cdn/")) return send(200, "image/webp", "file")
  return send(404, "text/plain", "not found")
}

beforeAll(async () => {
  server = createServer(handle)
  await new Promise<void>((done) => server.listen(0, "127.0.0.1", done))
  origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
})
afterAll(async () => {
  await new Promise<void>((done) => server.close(() => done()))
})
beforeEach(() => {
  mode = "live"
  seen.length = 0
})

type Run = { status: number; stdout: string; stderr: string }

/** Runs the command and waits for it: the stand-in answers in this process, which a synchronous wait would block. */
async function run(args: string[], env: Record<string, string> = {}): Promise<Run> {
  const answer = JSON.stringify({ result: [`${origin}/cdn/a.webp`, `${origin}/cdn/b.woff2`] })
  try {
    const { stdout, stderr } = await promisify(execFile)(process.execPath, [...NODE, "--import", `data:text/javascript,${encodeURIComponent(STUB)}`, "scripts/check-production.ts", ...args], {
      cwd: PACKAGE_DIR,
      env: { ...process.env, SANITY_ANSWER: answer, SANITY_STATUS: "200", ...env },
      timeout: 30_000,
    })
    return { status: 0, stdout, stderr }
  } catch (error) {
    const failed = error as { code?: unknown; stdout?: string; stderr?: string }
    return { status: typeof failed.code === "number" ? failed.code : -1, stdout: failed.stdout ?? "", stderr: failed.stderr ?? "" }
  }
}

const slug = live.slug
const TIMEOUT = 30_000

describe("pnpm check:production", () => {
  it("passes a game that the site serves as a live game, and says how many checks there are", { timeout: TIMEOUT }, async () => {
    const result = await run([slug, "--site", origin])
    expect(result.status, result.stdout + result.stderr).toBe(0)
    expect(result.stdout).toMatch(new RegExp(`\\n(\\d+) of \\1 checks pass for ${slug} on ${origin}\\n?$`))
    expect(result.stdout).not.toContain("✗")
    expect(result.stdout).toContain("✓ published pictures and files load (2 files of the project")
    // it only reads: GET and HEAD, nothing else, and it asked for the two addresses of the game, the sitemap, the API, the files and the pictures
    expect(new Set(seen.map((call) => call.method))).toEqual(new Set(["GET", "HEAD"]))
    expect(seen.map((call) => call.path)).toEqual(expect.arrayContaining([`/${slug}`, `/game/${slug}`, "/sitemap.xml", apiPath(slug), "/cdn/a.webp", "/cdn/b.woff2", ...gameFiles(slug).map((file) => file.path)]))
  })

  it("prints one line of JSON with --json: the checks, each with its label, its result and what was found", { timeout: TIMEOUT }, async () => {
    const result = await run([slug, "--json", "--site", `${origin}/`])
    expect(result.status, result.stdout + result.stderr).toBe(0)
    expect(result.stdout.trim().split("\n")).toHaveLength(1)
    const report = JSON.parse(result.stdout) as { slug: string; site: string; ok: boolean; passed: number; total: number; checks: { label: string; ok: boolean; detail: string }[] }
    expect(report).toMatchObject({ slug, site: origin, ok: true })
    expect(report.total).toBe(report.checks.length)
    expect(report.passed).toBe(report.total)
    expect(report.checks[0]).toEqual({ label: `/${slug}: 200 and the hub page of the game`, ok: true, detail: "HTTP 200, /game/[slug]" })
  })

  it("exits 1 and says what production does not say when the page is the one of a game to come", { timeout: TIMEOUT }, async () => {
    mode = "soon"
    const result = await run([slug, "--site", origin])
    expect(result.status).toBe(1)
    expect(result.stdout).toContain("✗ ")
    expect(result.stdout).toContain(`/game/${slug}: description starts with the lead of a live game`)
    expect(result.stdout).toContain('the head has no "Coming soon" badge')
    expect(result.stdout).toMatch(/\n(\d+) of (\d+) checks pass for/)
    // the report is the whole list, not the first failure
    expect(result.stdout).toContain(`✓ /sitemap.xml lists /game/${slug}`)
  })

  it("exits 1 when the game's Sanity project does not answer, and takes the project of --sanity over the registry's", { timeout: TIMEOUT }, async () => {
    const down = await run([slug, "--site", origin, "--sanity", "abcd1234"], { SANITY_STATUS: "404", SANITY_ANSWER: '{"error":"Dataset not found"}' })
    expect(down.status).toBe(1)
    expect(down.stdout).toContain("✗ the game's Sanity project (abcd1234) answers  [HTTP 404")
    const other = await run([slug, "--site", origin, "--sanity", "abcd1234"])
    expect(other.status, other.stdout + other.stderr).toBe(0)
    expect(other.stdout).toContain("(2 files of the project abcd1234)")
  })

  it("checks the page against the name that --name gives, when the page prints another than the registry's", { timeout: TIMEOUT }, async () => {
    const other = await run([slug, "--site", origin, "--name", "  Another   Name "])
    expect(other.status).toBe(1)
    expect(other.stdout).toContain(`✗ /${slug}: title starts with "Play Another Name Online"`)
    // the stand-in's pages are the registry's game: its own name passes
    const same = await run([slug, "--site", origin, "--name", live.name])
    expect(same.status, same.stdout + same.stderr).toBe(0)
  })

  it("exits 1 when the site does not answer at all, without throwing", { timeout: TIMEOUT }, async () => {
    // nothing listens on this port of the stand-in's host
    const result = await run([slug, "--site", "http://127.0.0.1:9"])
    expect(result.status).toBe(1)
    expect(result.stdout).toContain(`✗ /${slug}: 200 and the hub page of the game  [no answer (`)
    expect(result.stderr).toBe("")
  })

  it("exits 2 with the usage for a command line that is wrong, a game that is not in the registry and one that is not live", { timeout: TIMEOUT }, async () => {
    const cases: [string[], string][] = [
      [[], "Give the slug of a live game"],
      [["no-such-game"], '"no-such-game" is not a game of the registry'],
      [["Not A Slug"], '"Not A Slug" is not a slug'],
      [[waiting.slug], `${waiting.name} is not live`],
      [[slug, "extra"], `One game only, got "${slug}" and "extra"`],
      [[slug, "--bogus"], "Unknown option --bogus"],
      [[slug, "--site"], "--site takes a value"],
      [[slug, "--site", "https://example.test/path"], "--site is the address of the site, with no path"],
      [[slug, "--site", "https://user:secret@example.test"], "--site takes no credentials"],
      [[slug, "--site", "ftp://example.test"], "--site is an http or https address"],
      [[slug, "--site", "not an address"], "--site is not an address"],
      [[slug, "--sanity", "NOT AN ID"], "--sanity is the id of a Sanity project"],
      [[slug, "--name", ""], "--name: The name is empty"],
      [[slug, "--name", "A\u0007B"], "--name: The name has a control character"],
    ]
    for (const [args, message] of cases) {
      const result = await run(args)
      expect(result.status, args.join(" ")).toBe(2)
      expect(result.stderr, args.join(" ")).toContain(message)
      expect(result.stderr).toContain("Usage: pnpm check:production <slug>")
    }
    // none of them reached the stand-in
    expect(seen).toEqual([])
  })

  it("prints its usage with --help and exits 0", { timeout: TIMEOUT }, async () => {
    const result = await run(["--help"])
    expect(result.status).toBe(0)
    expect(result.stdout).toContain("Usage: pnpm check:production <slug> [--site <url>] [--sanity <project id>] [--name <name>] [--json]")
    expect(result.stdout).toContain("GET and HEAD alone")
  })

  it("is the command that the root package runs and that the skill game-go-live names", () => {
    const root = JSON.parse(readFileSync(join(REPO, "package.json"), "utf8")) as { scripts: Record<string, string> }
    expect(root.scripts["check:production"]).toBe("node --disable-warning=ExperimentalWarning packages/catalog/scripts/check-production.ts")
    expect(existsSync(join(REPO, "packages/catalog/scripts/check-production.ts"))).toBe(true)
    expect(readFileSync(join(REPO, ".claude/skills/game-go-live/SKILL.md"), "utf8")).toContain("pnpm check:production <slug>")
    expect(readFileSync(join(REPO, "docs/scripts.md"), "utf8")).toContain("`pnpm check:production <slug> [--site <url>] [--sanity <project id>] [--name <name>] [--json]`")
  })
})
