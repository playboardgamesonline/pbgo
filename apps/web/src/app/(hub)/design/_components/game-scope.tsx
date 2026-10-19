import type { CSSProperties, ReactNode } from "react"
import type { UiTheme } from "@pbgo/core/lib/binding"
import type { ThemeColors } from "@pbgo/core/lib/settings"
import type { UiTexts } from "@pbgo/core/lib/skin"
import { cn } from "@pbgo/ui/utils"

/**
 * "In-game UI" is the one place where this platform page draws a game's layer. The hub's `.platform` class sits on <html> and sets
 * values a game never has (Geist, a weight of 600 for everything, tight line-heights, a 0.625 rem radius), so a specimen is drawn
 * inside a `GameScope`: a wrapper that puts the game's tokens back (what `game.css` and the game's Sanity skin would have set on
 * <html>), then the game's fonts. Nothing is set on :root, so the platform around it is untouched.
 */

/** What a game's in-game UI needs from its binding, as plain data (the section computes it on the server) */
export type GameLook = {
  slug: string
  name: string
  /** `themeStyle(defaultSettings(binding))`: the custom properties a game writes on <html> */
  tokens: Record<string, string>
  colors: ThemeColors
  fonts: { body: string; title: string; accent: string | null }
  /** `UI_THEME` of the binding */
  ui: UiTheme | undefined
  playerColors: readonly string[]
  labels: Pick<UiTexts, "scoreboard" | "winnerTitle" | "shareResult" | "pointsShort" | "players" | "playersReady" | "seatDone" | "seatWaiting" | "seatAway" | "you">
}

/** The values of `game.css` and Tailwind's own scale that `.platform` replaces on <html>, set back for the subtree */
const SCOPE_RESET = {
  "--font-weight-normal": "400",
  "--font-weight-medium": "500",
  "--font-weight-semibold": "600",
  "--font-weight-bold": "700",
  "--radius": "0.75rem",
  "--tracking-tight": "-0.025em",
  "--text-xs--line-height": "calc(1 / 0.75)",
  "--text-sm--line-height": "calc(1.25 / 0.875)",
  "--text-base--line-height": "calc(1.5 / 1)",
  "--text-lg--line-height": "calc(1.75 / 1.125)",
  "--text-xl--line-height": "calc(1.75 / 1.25)",
  "--text-2xl--line-height": "calc(2 / 1.5)",
  "--text-3xl--line-height": "calc(2.25 / 1.875)",
  "--text-4xl--line-height": "calc(2.5 / 2.25)",
  "--text-5xl--line-height": "1",
  "--text-6xl--line-height": "1",
  "--default-transition-duration": "150ms",
  "--default-transition-timing-function": "cubic-bezier(0.4, 0, 0.2, 1)",
  // the tokens `themeStyle()` leaves to `game.css`
  "--card": "var(--surface)",
  "--card-foreground": "var(--foreground)",
  "--primary": "var(--accent-game)",
  "--muted-foreground": "#c9cfdc",
  "--accent-foreground": "var(--foreground)",
  "--destructive": "oklch(0.58 0.2 25)",
  "--border": "color-mix(in oklab, var(--accent-game) 35%, transparent)",
  "--input": "color-mix(in oklab, var(--foreground) 35%, transparent)",
  "--ring": "var(--accent-game)",
  fontWeight: 400,
  lineHeight: 1.5,
  letterSpacing: "normal",
  fontFamily: "var(--font-body)",
  color: "var(--foreground)",
  WebkitFontSmoothing: "auto",
  MozOsxFontSmoothing: "auto",
} as CSSProperties

/**
 * A game's tokens, then its fonts, around the specimens. `data-look`, never `data-game`: the analytics count the hub's links that
 * carry `data-game`. The headings opt out of the platform's `text-wrap: balance`, which a utility on the wrapper beats.
 */
export function GameScope({ look, className, children }: { look: GameLook; className?: string; children: ReactNode }) {
  const fonts: Record<string, string> = { "--font-body": look.fonts.body, "--font-title": look.fonts.title }
  if (look.fonts.accent) fonts["--font-accent"] = look.fonts.accent
  return (
    <div data-look={look.slug} className={cn("[&_:is(h1,h2,h3,h4)]:text-wrap", className)} style={{ ...SCOPE_RESET, ...look.tokens, ...fonts } as CSSProperties}>
      {children}
    </div>
  )
}

/** The table behind a specimen: the game's surface, darker towards the edges */
export const TABLE_BACKDROP = "radial-gradient(120% 90% at 50% 35%, var(--surface), var(--surface-dark))"

/** A solid crown, standing in for the table's crown icon (the icon sets of this page have no solid one) */
export function Crown({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" aria-hidden className={className}>
      <path d="M4 19 3 8l5 4 4-7 4 7 5-4-1 11z" />
    </svg>
  )
}
