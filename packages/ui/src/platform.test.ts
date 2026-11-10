import { readdirSync, readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

/**
 * Guard of the design system: the platform components (`platform/*.tsx`) read tokens and never name a colour, a weight,
 * a shadow or a duration of their own. A hard-coded value here would reach the hub, the admin and every account page,
 * and would not follow the next change of `styles/platform.css`. Add the token first, then use it.
 */

const DIRECTORY = new URL("./platform/", import.meta.url)
const FILES = readdirSync(DIRECTORY).filter((file) => file.endsWith(".tsx"))

const PALETTE =
  "slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose"

const FORBIDDEN: ReadonlyArray<{ rule: string; pattern: RegExp }> = [
  { rule: "dark only: no `dark:` or `not-dark:` variant", pattern: /\bdark:/ },
  {
    rule: "one weight, set on `.platform`: no `font-<weight>` class",
    pattern: /\bfont-(?:thin|extralight|light|normal|medium|bold|extrabold|black)\b/,
  },
  { rule: "the `admin` and `admin-portal` classes are gone: use `platform`", pattern: /\badmin\b/ },
  { rule: "shadows are `shadow-surface`, `shadow-float` and `shadow-overlay`", pattern: /\bshadow-(?:xs|sm|md|lg|xl|2xl)\b/ },
  { rule: "durations are `duration-fast`, `duration-base` and `duration-slow`", pattern: /\bduration-\d+\b/ },
  { rule: "radii come from `--radius` (`rounded-md`, `rounded-4xl`…), or `rounded-[inherit]`", pattern: /rounded-\[(?!inherit\])/ },
  { rule: "no arbitrary ring, text size, tracking or leading", pattern: /\b(?:ring|text|tracking|leading)-\[/ },
  { rule: "no colour literal: use a token (`bg-card`, `text-muted-foreground`…)", pattern: /#[0-9a-fA-F]{3,8}\b|\b(?:rgb|rgba|hsl|hsla|oklch|oklab|lab|lch)\(/ },
  { rule: "no pure black or white: use `background` / `foreground`", pattern: /\b(?:bg|text|border|ring|fill|stroke)-(?:black|white)\b/ },
  {
    rule: "no Tailwind palette colour: use a token",
    pattern: new RegExp(`\\b(?:bg|text|border|ring|fill|stroke|from|via|to|divide|outline|decoration|accent|caret)-(?:${PALETTE})-\\d{2,3}\\b`),
  },
  { rule: "a platform component does not know about games", pattern: /from\s+["'](?:\.\.\/game\/|@pbgo\/ui\/game\/)/ },
]

describe("platform components", () => {
  it("are found", () => {
    expect(FILES.length).toBeGreaterThan(20)
  })

  for (const { rule, pattern } of FORBIDDEN) {
    it(rule, () => {
      const hits = FILES.flatMap((file) =>
        readFileSync(new URL(file, DIRECTORY), "utf8")
          .split("\n")
          .flatMap((line, index) => (pattern.test(line) ? [`${file}:${index + 1}  ${line.trim()}`] : [])),
      )
      expect(hits, hits.join("\n")).toEqual([])
    })
  }
})

/**
 * A modal overlay (a menu, a select, a dialog, a sheet) locks the scroll of the page, and `react-remove-scroll` hides the scrollbar and adds a margin of its
 * width to the body, so whatever is fixed (the navbar) jumped by that width. The page keeps the place of its scrollbar instead (an empty, inactive track while
 * the lock is on, as on ui.shadcn.com) and the lock's margin is taken off: two rules of `platform.css`.
 */
/**
 * Rounded, never round: the largest step is the surfaces' (`rounded-4xl`) and nothing is a capsule. `rounded-full` stays where a shape is a circle by nature, the picture of a
 * person with its dot, the place of a seat nobody has taken (a circle like the picture it waits for, which its focus ring follows), the track and thumb of a switch, a slider and a progress bar, the mark of a radio (a choice among a few is drawn as a circle everywhere, and a square would read as a checkbox), the round background that comes
 * under the pointer behind the "+5" of the achievements, and the cross that takes a game out of a search, a black circle at the corner of its picture: the two places where a circle is asked for that is no picture.
 */
describe("radius", () => {
  const CIRCLES = new Set(["achievements-card.tsx", "avatar.tsx", "open-seat.tsx", "picked-game.tsx", "progress.tsx", "radio-group.tsx", "slider.tsx", "switch.tsx"])
  const hitsOf = (files: readonly string[], pattern: RegExp) =>
    files.flatMap((file) =>
      readFileSync(new URL(file, DIRECTORY), "utf8")
        .split("\n")
        .flatMap((line, index) => (pattern.test(line) ? [`${file}:${index + 1}  ${line.trim()}`] : [])),
    )

  it("nothing is a capsule but what is a circle by nature", () => {
    const hits = hitsOf(FILES.filter((file) => !CIRCLES.has(file)), /\brounded-full\b/)
    expect(hits, hits.join("\n")).toEqual([])
  })

  it("every corner is smoothed a little, and a circle keeps its arc", () => {
    const css = readFileSync(new URL("./styles/platform.css", import.meta.url), "utf8")
    expect(css).toMatch(/--corner-smoothing:\s*[\d.]+/)
    expect(css).toMatch(/\.platform \*\s*\{[^}]*corner-shape:\s*superellipse\(var\(--corner-smoothing\)\)/)
    expect(css).toMatch(/\[class~="rounded-full"\][^{]*\{[^}]*corner-shape:\s*round/)
  })
})

/** The presence of a friend is the one thing the platform paints in a hue besides the signal colours (`destructive`, `success`): four tokens, each with its utilities. */
describe("presence colours", () => {
  const css = readFileSync(new URL("./styles/platform.css", import.meta.url), "utf8")

  for (const name of ["online", "playing", "inactive", "dnd"]) {
    it(`presence-${name} is a token with its utilities`, () => {
      expect(css).toMatch(new RegExp(`--presence-${name}:\\s*oklch\\(`))
      expect(css).toContain(`--color-presence-${name}: var(--presence-${name})`)
    })
  }
})

/** `destructive` and `success` are the two signal colours, a loss or an error and a win: a token and its utilities each (`bg-success/20 text-success` is a win, `bg-destructive/20 text-destructive` a loss). */
describe("signal colours", () => {
  const css = readFileSync(new URL("./styles/platform.css", import.meta.url), "utf8")

  for (const name of ["destructive", "success"]) {
    it(`${name} is a token with its utilities`, () => {
      expect(css).toMatch(new RegExp(`--${name}:\\s*oklch\\(`))
      expect(css).toContain(`--color-${name}: var(--${name})`)
    })
  }
})

/**
 * The colours of the pieces that stand for letters of the home's title are theirs alone: the colours of what is played with (`--piece-*`, each with its utility, so a piece is drawn from a token and a platform
 * component never names one).
 */
describe("piece colours", () => {
  const css = readFileSync(new URL("./styles/platform.css", import.meta.url), "utf8")

  for (const name of ["red", "gold", "navy", "ivory", "ink"]) {
    it(`piece-${name} is a token with its utility`, () => {
      expect(css).toMatch(new RegExp(`--piece-${name}:\\s*oklch\\(`))
      expect(css).toContain(`--color-piece-${name}: var(--piece-${name})`)
    })
  }

  it("the pieces of the title are utilities of the stylesheet", () => {
    for (const utility of ["title-piece", "title-cards"]) expect(css).toContain(`@utility ${utility} {`)
  })
})

/**
 * A sign-in provider's button is its brand's colour where the brand has one to give: two tokens with their utilities, in the brand's own hex. The marks are in
 * `brands.tsx`, the one file with colour literals; Google's tile is `foreground`.
 */
describe("brand colours", () => {
  const css = readFileSync(new URL("./styles/platform.css", import.meta.url), "utf8")

  for (const name of ["twitch", "discord", "steam"]) {
    it(`brand-${name} is a token with its utilities`, () => {
      expect(css).toMatch(new RegExp(`--brand-${name}:\\s*#[0-9a-f]{6};`, "i"))
      expect(css).toContain(`--color-brand-${name}: var(--brand-${name})`)
    })
  }

  it("every brand has a mark and a tile", () => {
    const marks = readFileSync(new URL("./brands.tsx", import.meta.url), "utf8")
    const button = readFileSync(new URL("./platform/provider-button.tsx", import.meta.url), "utf8")
    for (const name of ["google", "twitch", "discord", "steam"]) {
      expect(marks, `the mark of ${name}`).toMatch(new RegExp(`\\b${name}\\b`))
      expect(button, `the tile of ${name}`).toMatch(new RegExp(`^  ${name}:`, "m"))
    }
  })
})

describe("text selection", () => {
  const css = readFileSync(new URL("./styles/platform.css", import.meta.url), "utf8")

  it("the texts of the platform cannot be selected", () => {
    expect(css).toMatch(/\.platform\s*\{[^}]*user-select:\s*none/)
  })

  it("a field, a code sample and whatever asks for it can", () => {
    expect(css).toMatch(/\.platform :is\(input, textarea.*data-selectable\]\)\s*\{[^}]*user-select:\s*text/)
  })
})

describe("modal overlays", () => {
  const css = readFileSync(new URL("./styles/platform.css", import.meta.url), "utf8")

  it("the page keeps the place of its scrollbar", () => {
    expect(css).toMatch(/html\.platform\s*\{[^}]*scrollbar-gutter:\s*stable/)
  })

  it("the margin of the scroll lock is taken off the body", () => {
    expect(css).toMatch(/html\.platform body\[data-scroll-locked\]\s*\{[^}]*margin-right:\s*0\s*!important/)
  })
})
