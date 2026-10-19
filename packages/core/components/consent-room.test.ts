import { existsSync, readdirSync, readFileSync } from "node:fs"
import { join, relative } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"

/**
 * Guard of the consent banner's room. The banner is a bar docked to the bottom of the screen: `@pbgo/analytics` measures it, publishes
 * its height as `--consent-h` on <body> (0px without a banner) and pads the page by it. A screen as tall as the viewport would run under
 * the bar, and an element fixed against the bottom of the screen would sit under it: that is how a button of a game ends up hidden.
 * Subtract the variable (`h-[calc(100dvh-var(--consent-h,0px))]`) or offset by it (`bottom-[var(--consent-h,0px)]`).
 *
 * The check reads the classes of the screens a visitor opens with the banner up: the hub, the games and their template, one line at a
 * time (a class string split over two lines is not seen). The gamemaster, `/design` and the previews never show the banner, so they are
 * not scanned.
 */

const ROOT = fileURLToPath(new URL("../../../", import.meta.url))

const SKIPPED = new Set(["node_modules", ".next", "admin", "design"])
const SCANNED = [
  "packages/core/components",
  "packages/core/pages",
  "apps/web/src/app/(hub)",
  "apps/web/src/app/[game]",
  "apps/web/src/components",
  "template/src",
  ...readdirSync(join(ROOT, "games")).map((slug) => `games/${slug}/src`),
].filter((directory) => existsSync(join(ROOT, directory)))

function sources(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if (SKIPPED.has(entry.name)) return []
    const path = join(directory, entry.name)
    if (entry.isDirectory()) return sources(path)
    return /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [path] : []
  })
}

const FILES = SCANNED.flatMap((directory) => sources(join(ROOT, directory)).map((path) => relative(ROOT, path)))

// A class name starts after a space, a quote or the `:` of a variant (`md:`), never inside a longer name (`border-bottom-…`)
const START = String.raw`(?<![\w-])`
const VIEWPORT_TALL = new RegExp(`${START}(?:min-)?h-(?:screen|dvh|svh|lvh)(?![\\w-])|${START}(?:min-)?h-\\[[^\\]]*100[dsl]?vh`)
const PINNED = new RegExp(`${START}(?:fixed|sticky)(?![\\w-])`)
const AT_BOTTOM = new RegExp(`${START}-?bottom-`)
const WHOLE_SCREEN = new RegExp(`${START}-?inset-(?!x-|s-|e-|shadow|ring)`)

/** What a line of classes does that the bar would hide: the rules it breaks (none when it already offsets by `--consent-h`). */
function problems(line: string): string[] {
  if (line.includes("--consent-h")) return []
  const found: string[] = []
  if (VIEWPORT_TALL.test(line)) found.push("as tall as the viewport: subtract `var(--consent-h, 0px)`")
  if (PINNED.test(line) && (AT_BOTTOM.test(line) || WHOLE_SCREEN.test(line))) {
    found.push("fixed to the bottom or to the whole screen: offset by `var(--consent-h, 0px)`")
  }
  return found
}

const isComment = (line: string) => /^(?:\/\/|\/\*|\*|\{\/\*)/.test(line.trim())

/** Covers the whole screen on purpose. The key is the file and a fragment of the line. */
const ALLOWED: ReadonlyArray<{ file: string; line: string; why: string }> = [
  {
    file: "packages/core/components/desktop-only.tsx",
    line: "fixed inset-0 z-[100]",
    why: "the wall of narrow screens covers everything, over the banner too: it holds no button of a game",
  },
  {
    file: "packages/core/components/game/game-over.tsx",
    line: "fixed inset-0 z-40 bg-black/80",
    why: "the backdrop holds nothing and the banner (z-50) stays above it",
  },
]

describe("the room of the consent banner", () => {
  it("scans the screens of the hub, the games and the template", () => {
    expect(FILES.length).toBeGreaterThan(40)
    expect(FILES).toEqual(expect.arrayContaining(["packages/core/components/game/hud.tsx", "packages/core/components/home/screen.tsx"]))
    expect(FILES.some((file) => file.startsWith("games/courtisans/src/"))).toBe(true)
    expect(FILES.some((file) => file.includes("/admin/") || file.includes("/design/"))).toBe(false)
  })

  it("sees what would hide under the bar", () => {
    expect(problems('<main className="relative h-dvh w-full">')).toHaveLength(1)
    expect(problems('<div className="flex md:min-h-screen">')).toHaveLength(1)
    expect(problems('<div className="min-h-[100svh]">')).toHaveLength(1)
    expect(problems('<div className="fixed inset-x-0 bottom-0 z-50">')).toHaveLength(1)
    expect(problems('<div className="fixed right-5 -bottom-2">')).toHaveLength(1)
    expect(problems('<div className="fixed inset-0 z-40">')).toHaveLength(1)
    expect(problems('<div className="sticky bottom-4">')).toHaveLength(1)
  })

  it("lets through what keeps its distance", () => {
    expect(problems('<main className="h-[calc(100dvh-var(--consent-h,0px))]">')).toEqual([])
    expect(problems('<div className="fixed inset-x-0 bottom-[var(--consent-h,0px)]">')).toEqual([])
    expect(problems('<div className="fixed inset-x-0 top-6 z-50">')).toEqual([])
    expect(problems('<div className="fixed top-0 right-0 inset-shadow-sm">')).toEqual([])
    expect(problems('<div className="absolute inset-0 bottom-0">')).toEqual([])
    expect(problems('<div className="border-bottom-2 max-h-screen">')).toEqual([])
  })

  it("leaves no screen, and no element fixed to the bottom, under the bar", () => {
    const hits = FILES.flatMap((file) =>
      readFileSync(join(ROOT, file), "utf8")
        .split("\n")
        .flatMap((line, index) => {
          if (isComment(line) || ALLOWED.some((allowed) => allowed.file === file && line.includes(allowed.line))) return []
          return problems(line).map((rule) => `${file}:${index + 1}  ${rule}\n    ${line.trim()}`)
        }),
    )
    expect(hits, hits.join("\n")).toEqual([])
  })

  it("keeps every allowance in use", () => {
    for (const { file, line } of ALLOWED) {
      expect(FILES, file).toContain(file)
      expect(readFileSync(join(ROOT, file), "utf8"), `${file}: ${line}`).toContain(line)
    }
  })
})
