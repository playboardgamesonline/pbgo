import { spawnSync } from "node:child_process"
import { fileURLToPath } from "node:url"
import { describe, expect, it, vi } from "vitest"
import { describePictures, PICTURE_NAMES, PICTURES_QUERY, readPictures, TRANSLATED_PICTURES, type PicturesRead } from "./pictures.ts"
import { SanityError } from "./sanity.ts"

// What the pictures step of `/add-game` asks the platform's Sanity project once the sub-agent of `platform-assets` has reported: which of the five pictures the published entry of a game has. The API is a stand-in.
const answer = (body: unknown, status = 200) => vi.fn(async (..._args: Parameters<typeof fetch>) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } })) as unknown as typeof fetch & ReturnType<typeof vi.fn>

const FULL = { id: "game-test-game", name: "Test Game", cover: true, logo: true, icon: false, background: true, boxFront: false }

describe("the pictures of a published game", () => {
  it("are the five of the Studio, in its order, three of them translated", () => {
    expect(PICTURE_NAMES).toEqual(["cover", "logo", "icon", "background", "boxFront"])
    expect(TRANSLATED_PICTURES).toEqual(["cover", "logo", "boxFront"])
  })

  it("are asked of the published game of the slug, the row of English of the translated ones, and nothing else", () => {
    for (const name of PICTURE_NAMES) expect(PICTURES_QUERY, name).toContain(`"${name}": defined(`)
    for (const name of TRANSLATED_PICTURES) expect(PICTURES_QUERY, name).toContain(`${name}[language == $language][0].value.asset`)
    expect(PICTURES_QUERY).toContain("icon.asset")
    expect(PICTURES_QUERY).toContain('_type == "game" && slug.current == $slug')
  })

  it("are read with the API's own address, the published perspective and the slug and the language as parameters", async () => {
    const fetchSpy = answer({ result: FULL })
    expect(await readPictures("test-game", { fetch: fetchSpy })).toEqual({ id: "game-test-game", name: "Test Game", pictures: { cover: true, logo: true, icon: false, background: true, boxFront: false } })
    const url = new URL(String(fetchSpy.mock.calls[0]?.[0]))
    expect(url.origin).toBe("https://mhgqs6fe.api.sanity.io")
    expect(url.pathname).toBe("/v2025-02-19/data/query/production")
    expect(url.searchParams.get("perspective")).toBe("published")
    expect(url.searchParams.get("query")).toBe(PICTURES_QUERY)
    expect(url.searchParams.get("$slug")).toBe('"test-game"')
    expect(url.searchParams.get("$language")).toBe('"en"')
    expect(fetchSpy.mock.calls[0]?.[1]).toMatchObject({ method: "GET", cache: "no-store" })
  })

  it("count a picture that is anything but true as missing", async () => {
    const read = await readPictures("test-game", { fetch: answer({ result: { id: "game-x", name: "X", cover: "yes", logo: 1, icon: null, background: undefined } }) })
    expect(read?.pictures).toEqual({ cover: false, logo: false, icon: false, background: false, boxFront: false })
  })

  it("are null for a slug no published game has", async () => {
    expect(await readPictures("nobody", { fetch: answer({ result: null }) })).toBeNull()
  })

  it("say what cannot be read, and never repeat the address", async () => {
    const down = vi.fn(async () => Promise.reject(new TypeError("fetch failed: https://mhgqs6fe.api.sanity.io/secret?token=abc"))) as unknown as typeof fetch
    const failure = await readPictures("test-game", { fetch: down }).catch((error: unknown) => error)
    expect(failure).toBeInstanceOf(SanityError)
    expect((failure as Error).message).toBe("The platform's Sanity project could not be reached (TypeError)")
    await expect(readPictures("test-game", { fetch: answer({ error: "no" }, 503) })).rejects.toThrow("Sanity answered 503")
    await expect(readPictures("test-game", { fetch: answer({ nothing: true }) })).rejects.toThrow("not a result")
    await expect(readPictures("test-game", { fetch: answer({ result: ["a game"] }) })).rejects.toThrow("no id or no name")
    await expect(readPictures("test-game", { fetch: answer({ result: { id: "game-x" } }) })).rejects.toThrow("no id or no name")
  })
})

describe("what is printed of them", () => {
  it("is the game, how many of the five it has, and a mark for each, in the order of the Studio", () => {
    const read: PicturesRead = { id: "game-test-game", name: "Test Game", pictures: { cover: true, logo: true, icon: false, background: true, boxFront: false } }
    expect(describePictures(read)).toEqual(["Test Game (game-test-game), published: 3 of 5 pictures", "  ✓ cover", "  ✓ logo", "  ✗ icon", "  ✓ background", "  ✗ boxFront"])
  })
})

// `scripts/pictures.ts` is run by Node itself (type stripping, no bundler), where the package's tsc and vitest cannot see what breaks: a value import without a `.ts` extension. This runs it as `pnpm catalog:pictures` does.
const PACKAGE_DIR = fileURLToPath(new URL("..", import.meta.url))
const STUB = `globalThis.fetch = async () => new Response(process.env.SANITY_ANSWER, { status: Number(process.env.SANITY_STATUS ?? 200), headers: { "content-type": "application/json" } })`

function pictures(args: string[], body: unknown = { result: FULL }, status = 200) {
  return spawnSync(process.execPath, ["--disable-warning=ExperimentalWarning", "--import", `data:text/javascript,${encodeURIComponent(STUB)}`, "scripts/pictures.ts", ...args], {
    cwd: PACKAGE_DIR,
    env: { ...process.env, SANITY_ANSWER: JSON.stringify(body), SANITY_STATUS: String(status) },
    encoding: "utf8",
    timeout: 20_000,
  })
}

describe("pnpm catalog:pictures", () => {
  it("prints the pictures of a published game, and exits 0 whichever it has", () => {
    const run = pictures(["test-game"])
    expect(run.status, run.stderr).toBe(0)
    expect(run.stdout).toBe("Test Game (game-test-game), published: 3 of 5 pictures\n  ✓ cover\n  ✓ logo\n  ✗ icon\n  ✓ background\n  ✗ boxFront\n")
    expect(pictures(["test-game"], { result: { id: "game-x", name: "X" } }).status).toBe(0)
  })

  it("exits 1 for a slug nobody published, and when the project cannot be read", () => {
    const none = pictures(["nobody"], { result: null })
    expect(none.status).toBe(1)
    expect(none.stdout).toContain("No published game has the slug nobody")
    const down = pictures(["test-game"], { error: "down" }, 500)
    expect(down.status).toBe(1)
    expect(down.stderr).toContain("The platform's Sanity project could not be read: Sanity answered 500")
  })

  it("exits 2 with its usage for a command line that is wrong", () => {
    for (const args of [[], ["a", "b"], ["Not A Slug"], ["--nope"]]) {
      const run = pictures(args)
      expect(run.status, args.join(" ")).toBe(2)
      expect(run.stderr, args.join(" ")).toContain("Usage: pnpm catalog:pictures <slug>")
    }
    expect(pictures(["--help"]).stdout).toContain("Usage: pnpm catalog:pictures <slug>")
  })
})
