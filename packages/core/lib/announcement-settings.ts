import type { CSSProperties } from "react"
import type { UiTheme } from "./binding"
import { fade, type Motion } from "./motion-preference"
import { announcementTheme } from "./ui-theme"

/**
 * Everything the full-screen announcements (start, round, your turn, victory) are made of, as plain data: the settings of a
 * preset, how a game's `UI_THEME.announcement` seeds them, and the timeline they play. Pure (no React, no leva), so the
 * component (`components/game/announcement-view.tsx`), the leva panel (`announcement.tsx`), the `/design` specimens and the tests
 * all read the same numbers.
 */

/** The seat of a player shown with the announcement: none, next to the title ("your turn") or above it (the winner's medallion) */
export type AnnouncementSeatMode = "none" | "inline" | "hero"

export type AnnouncementSettings = {
  /** Seconds on screen before it leaves (the exit takes `EXIT` more) */
  duration: number
  /** Plays the sound the game gives with the announcement */
  sound: boolean
  /** Opacity of the veil over the table (0 to 1) */
  overlay: number
  /** Seconds the veil takes to come in */
  fade: number
  /** Title size, rem (shrinks by itself on a short screen) */
  size: number
  subtitleSize: number
  /** Letter spacing, em */
  spacing: number
  /** CSS font-family of the title and the subtitle */
  font: string
  textColor: string
  /** Line around the letters, px (0: none) */
  outline: number
  outlineColor: string
  /** Offset of the hard shadow under the letters, px */
  shadow: number
  shadowColor: string
  /** Blur of the soft shadow, px */
  blur: number
  /** Colour of the veil */
  veil: string
  /** The title comes in from this scale */
  startScale: number
  /** The title comes up from this far below, px */
  rise: number
  /** The title comes in out of focus by this much, px */
  riseBlur: number
  /** Seconds the title takes to settle */
  riseDuration: number
  /** Seconds between the title and the subtitle */
  subtitleDelay: number
  /** The title lands with a spring instead of settling; lively games only */
  spring: boolean
  /** Damping of that spring */
  bounce: number
  /** The two hairlines that frame the title */
  lines: boolean
  /** Seconds the glint takes to cross a hairline */
  lineDuration: number
  lineThickness: number
  lineColor: string
  /** Space between a hairline and the title, px (kept in proportion on a short screen) */
  lineGap: number
  /** At the top of the screen instead of the middle */
  above: boolean
  /** Shifts the block up (negative) or down, % of the viewport height */
  offsetY: number
  /** The veil fades out downwards instead of covering the whole screen */
  fadeGradient: boolean
  gradientHeight: number
  seat: AnnouncementSeatMode
  /** Falling confetti, lively games only */
  confetti: boolean
  confettiCount: number
  confettiColor: string
  confettiShape: "star" | "dot"
  confettiSize: number
  confettiSpeed: number
  confettiGlow: number
}

/**
 * The announcements as every game that does not tune them gets them: white letters with a thin gold outline, gold hairlines and
 * stars, a black veil. The colours repeat `DEFAULT_ANNOUNCEMENT_THEME` (kept equal by a test).
 */
export const ANNOUNCEMENT_DEFAULTS: AnnouncementSettings = {
  duration: 2.4,
  sound: true,
  overlay: 0.64,
  fade: 0.3,
  size: 4.8,
  subtitleSize: 2,
  spacing: 0,
  font: "var(--font-accent, var(--font-title))",
  textColor: "#ffffff",
  outline: 0.5,
  outlineColor: "#f2b705",
  shadow: 4,
  shadowColor: "#000000",
  blur: 18,
  veil: "#000000",
  startScale: 0.92,
  rise: 14,
  riseBlur: 10,
  riseDuration: 0.8,
  subtitleDelay: 0.18,
  spring: false,
  bounce: 16,
  lines: true,
  lineDuration: 1.6,
  lineThickness: 2,
  lineColor: "#f5c542",
  lineGap: 80,
  above: false,
  offsetY: -10,
  fadeGradient: false,
  gradientHeight: 52,
  seat: "none",
  confetti: false,
  confettiCount: 70,
  confettiColor: "#ffd35c",
  confettiShape: "star",
  confettiSize: 1,
  confettiSpeed: 1,
  confettiGlow: 16,
}

/** The shared presets: what each kind of announcement changes over the defaults */
export const ANNOUNCEMENT_PRESETS = {
  /** The game starts: the big one */
  start: {},
  /** A new round: the same, quieter and shorter */
  round: { duration: 1.8, size: 3.4, subtitleSize: 1.6, overlay: 0.45, lineDuration: 1.2, lineGap: 56, offsetY: -6, rise: 10, riseBlur: 6, riseDuration: 0.65 },
  /** It is your turn: one light line at the top, with your seat */
  turn: {
    offsetY: 0,
    above: true,
    fadeGradient: true,
    overlay: 0.55,
    lines: false,
    size: 2.2,
    outline: 0,
    shadow: 2,
    blur: 12,
    startScale: 0.98,
    rise: 8,
    riseBlur: 3,
    riseDuration: 0.5,
    duration: 2,
    spacing: 0.06,
    gradientHeight: 45,
    seat: "inline",
  },
  /** Someone wins: the winner's medallion, a spring and the confetti */
  victory: { duration: 4.5, sound: false, size: 3.4, confetti: true, spring: true, seat: "hero" },
} satisfies Record<string, Partial<AnnouncementSettings>>

export type BaseAnnouncementType = keyof typeof ANNOUNCEMENT_PRESETS

/** Names of the presets in the debug panel (a game's own preset without a name there shows its key) */
export const ANNOUNCEMENT_LABELS: Record<string, string> = { start: "Start", round: "Round", turn: "Your Turn", victory: "Victory" }

/**
 * The settings of one announcement: the defaults, seeded by the game's `UI_THEME.announcement` (colours, font, veil), then the
 * preset on top. What the theme switches off with `null` (outline, hairlines, confetti) stays off whatever the preset asks.
 */
export function announcementSettings(preset: Partial<AnnouncementSettings> = {}, theme?: UiTheme["announcement"]): AnnouncementSettings {
  const look = announcementTheme(theme)
  const seeded: Partial<AnnouncementSettings> = { font: look.font, textColor: look.color, shadowColor: look.shadow, veil: look.veil }
  if (look.outline !== null) seeded.outlineColor = look.outline
  if (look.rule !== null) seeded.lineColor = look.rule
  if (look.confetti !== null) {
    seeded.confettiColor = look.confetti.color
    seeded.confettiShape = look.confetti.shape
  }
  const settings = { ...ANNOUNCEMENT_DEFAULTS, ...seeded, ...preset }
  if (look.outline === null) settings.outline = 0
  if (look.rule === null) settings.lines = false
  if (look.confetti === null) settings.confetti = false
  return settings
}

// ─── What the browser is told to draw ──────────────────────────────────────

/** A size in rem that also follows the height of the viewport, so a title shrinks by itself on a short screen (a phone held sideways) */
export const fontSize = (rem: number) => `min(${rem}rem, ${rem * 2.4}vh)`

/** The space between a hairline and the title: `px` on a tall screen, in proportion to the height of a short one */
export const lineGap = (px: number) => `min(${px}px, ${px * 0.15}vh)`

/** A colour at some percent of its opacity */
const tint = (color: string, percent: number) => `color-mix(in srgb, ${color} ${percent}%, transparent)`

/** The letters: colour, outline and the two shadows (hard, then soft) in the game's shadow colour */
export function textStyle(r: AnnouncementSettings): CSSProperties {
  return {
    color: r.textColor,
    WebkitTextStroke: r.outline ? `${r.outline}px ${r.outlineColor}` : undefined,
    paintOrder: "stroke fill",
    filter: `drop-shadow(0 ${r.shadow}px 0 ${tint(r.shadowColor, 85)}) drop-shadow(0 ${r.shadow * 2.5}px ${r.blur}px ${tint(r.shadowColor, 60)})`,
  }
}

/** The veil over the table; its opacity (`overlay`) is animated, not drawn here */
export function veilStyle(r: AnnouncementSettings): CSSProperties {
  return r.fadeGradient ? { background: `linear-gradient(to bottom, ${r.veil} 0%, transparent ${r.gradientHeight}%)` } : { backgroundColor: r.veil }
}

/** A hairline (fading at both ends) and the glint that crosses it: the line's colour whitened */
export function ruleStyles(r: AnnouncementSettings): { line: CSSProperties; glint: CSSProperties } {
  const bright = `color-mix(in srgb, ${r.lineColor} 25%, white)`
  return {
    line: { background: `linear-gradient(90deg, transparent, ${r.lineColor} 16%, ${r.lineColor} 84%, transparent)` },
    glint: { background: `linear-gradient(90deg, transparent, ${bright} 50%, transparent)` },
  }
}

/** Medallions shown above the title of a victory: one large, several (a tie) smaller, at most `HERO_MAX` */
export const HERO_MAX = 4
export const heroSeatSize = (count: number): "lg" | "xl" => (count > 1 ? "lg" : "xl")

// ─── The timeline ──────────────────────────────────────────────────────────

/** Seconds an announcement takes to leave: quicker than it came */
export const EXIT = 0.45

const RULE_DELAY = 0.05
const RULE_DRAW = 0.7
/** The medallion of a victory comes first: the title waits for it */
const HERO_LEAD = 0.4
const TITLE_LEAD = 0.12

export type AnnouncementTimeline = {
  motion: Motion
  /** Seconds the veil takes to come in */
  veil: number
  /** The hairlines draw from the centre in `draw` seconds (0: they only fade in), then a glint crosses each (null: no glint) */
  rule: { show: boolean; delay: number; draw: number; glint: { delay: number; duration: number } | null }
  /** The winner's medallion, then the crown settling on it */
  seat: { delay: number; duration: number; crownDelay: number }
  title: { delay: number; duration: number; rise: number; blur: number; scale: number; spring: boolean }
  subtitle: { delay: number; duration: number; rise: number }
  confetti: boolean
  /** Seconds every part takes to leave */
  exit: number
}

/**
 * When each part of an announcement comes in: the veil first, the hairlines draw from the centre, the title rises and comes into
 * focus, the subtitle follows it. A victory brings the winner's medallion in before the title (`seats`: how many are shown; none,
 * and the title does not wait for them). Reduced motion: everything fades at once (150 ms at most); nothing travels, blurs, draws,
 * springs or falls, and the hairlines are simply there.
 */
export function announcementTimeline(r: AnnouncementSettings, motion: Motion, seats = 0): AnnouncementTimeline {
  const veil = fade(motion, r.fade)
  if (motion === "reduced") {
    return {
      motion,
      veil,
      rule: { show: r.lines, delay: 0, draw: 0, glint: null },
      seat: { delay: 0, duration: veil, crownDelay: 0 },
      title: { delay: 0, duration: veil, rise: 0, blur: 0, scale: 1, spring: false },
      subtitle: { delay: 0, duration: veil, rise: 0 },
      confetti: false,
      exit: veil,
    }
  }
  const titleDelay = r.seat === "hero" && seats > 0 ? HERO_LEAD : TITLE_LEAD
  return {
    motion,
    veil,
    rule: {
      show: r.lines,
      delay: RULE_DELAY,
      draw: RULE_DRAW,
      glint: r.lineDuration > 0 ? { delay: RULE_DELAY + RULE_DRAW * 0.6, duration: r.lineDuration } : null,
    },
    seat: { delay: 0.1, duration: 0.6, crownDelay: 0.5 },
    title: { delay: titleDelay, duration: r.riseDuration, rise: r.rise, blur: r.riseBlur, scale: r.startScale, spring: r.spring && motion === "lively" },
    subtitle: { delay: titleDelay + r.subtitleDelay, duration: r.riseDuration * 0.8, rise: r.rise * 0.7 },
    confetti: r.confetti && motion === "lively",
    exit: EXIT,
  }
}
