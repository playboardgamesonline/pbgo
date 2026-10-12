import { defaultOptions, normalizeOptions, type OptionContext, type OptionValues } from "@pbgo/engine-kit"
import { FONT_CHOICES } from "@pbgo/studio-kit/constants"
import type { GameBinding } from "./binding"
import { LOCALES, type Locale } from "./i18n"
import { gameI18n } from "./skin"

export { FONT_CHOICES }

const FONT_WEIGHTS: Record<string, string> = {
  Inter: "400..900",
  Nunito: "400..900",
  Fredoka: "400..700",
  "Baloo 2": "400..800",
  Poppins: "400;500;600;700;800;900",
  Outfit: "400..900",
  "DM Sans": "400..900",
  Montserrat: "400..900",
  "Space Grotesk": "400..700",
  Cinzel: "400..900",
  "Playfair Display": "400..900",
  Alegreya: "400..900",
}

// Credits of the original game, shown in the footer (empty: no adaptation notice)
// authors: free text after "un jeu de", e.g. "Romaric Galonnier et Anthony Perone, illustré par Noëmie Chevalier"
export type Credits = {
  /** In the language of the request (falls back to French) */
  authors: string | null
  publisher: string | null
  publisherUrl: string | null
}

export type UploadedFile = { url: string; name: string }

// Files uploaded from the admin (stored in Sanity): settings (`settings`) and skin (`interface`)
export const SETTINGS_FILE_SLOTS = ["rulesFr", "rulesEn", "rulesEs", "rulesDe", "fontBody", "fontDisplay"] as const

/** Slot (and Sanity field) of the rules PDF of each language */
export const RULES_SLOT = { fr: "rulesFr", en: "rulesEn", es: "rulesEs", de: "rulesDe" } as const satisfies Record<Locale, (typeof SETTINGS_FILE_SLOTS)[number]>
export const RULES_FIELD = { fr: "rulesPdfFr", en: "rulesPdfEn", es: "rulesPdfEs", de: "rulesPdfDe" } as const satisfies Record<Locale, string>

export type ByLocale<T> = Record<Locale, T>
export const byLocale = <T,>(f: (l: Locale) => T) => Object.fromEntries(LOCALES.map((l) => [l, f(l)])) as ByLocale<T>
export const SETTINGS_IMAGE_SLOTS = ["logo", "favicon", "shareImage"] as const
export const VISUAL_IMAGE_SLOTS = ["background", "pattern", "decorTop", "decorBottom", "hero", "hostIcon"] as const
export type VisualSlot = (typeof VISUAL_IMAGE_SLOTS)[number]
export type UploadSlot = (typeof SETTINGS_FILE_SLOTS)[number] | (typeof SETTINGS_IMAGE_SLOTS)[number] | VisualSlot
export type SettingsFiles = Record<(typeof SETTINGS_FILE_SLOTS)[number], UploadedFile | null>

/** Engine options: default value chosen in the admin, and options hidden in the lobby (they keep their default). */
export type OptionSettings = { defaults: OptionValues; hidden: string[] }

export const TURN_TIMEOUT_BOUNDS = { min: 20, max: 600, default: 60 }

export type ThemeColors = { background: string; foreground: string; accent: string; surface: string; surfaceDark: string }

export type SiteSettings = {
  title: string
  /** In the language of the request (falls back to French) */
  description: string
  /** Every language, as saved (or default): for the admin */
  descriptions: ByLocale<string>
  creditsAuthors: ByLocale<string>
  logo: string | null
  /** Tab icon (PNG or SVG); without it, generated from the logo */
  favicon: string | null
  /** Share image 1200×630; without it, generated from the skin */
  shareImage: string | null
  minPlayers: number
  maxPlayers: number
  theme: ThemeColors
  bodyFont: string | null
  displayFont: string | null
  // effective link (uploaded PDF, else the link typed in)
  rulesPdf: ByLocale<string | null>
  rulesPdfLinks: ByLocale<string | null>
  files: SettingsFiles
  credits: Credits
  /** Seconds of inactivity before the others can play for an absent player */
  turnTimeout: number
  options: OptionSettings
}

export const THEME_FIELDS: { key: keyof ThemeColors; label: string; hint: string }[] = [
  { key: "background", label: "Background", hint: "Screen background" },
  { key: "foreground", label: "Text", hint: "Main text and primary button" },
  { key: "accent", label: "Accent", hint: "Selection, highlights, titles" },
  { key: "surface", label: "Surface", hint: "Cards and panels" },
  { key: "surfaceDark", label: "Dark surface", hint: "Fields, footer, secondary backgrounds" },
]

const CORE_THEME: ThemeColors = {
  background: "#13213a",
  foreground: "#f5f2ea",
  accent: "#e8b43a",
  surface: "#1b2c4a",
  surfaceDark: "#0d1729",
}

/** One value per game binding, computed once. */
function perGame<T>(compute: (binding: GameBinding) => T): (binding: GameBinding) => T {
  const cache = new WeakMap<GameBinding, T>()
  return (binding) => {
    if (!cache.has(binding)) cache.set(binding, compute(binding))
    return cache.get(binding)!
  }
}

/** Theme of a game when Sanity has none: core colors, then `SETTINGS_DEFAULTS.theme` of the game. */
export const defaultTheme = perGame((binding): ThemeColors => ({ ...CORE_THEME, ...binding.SETTINGS_DEFAULTS?.theme }))

/** Player counts allowed by the engine (a game without engine yet has no real bounds). */
export const playerBounds = (binding: GameBinding) => ({ min: binding.GAME?.minPlayers ?? 2, max: binding.GAME?.maxPlayers ?? 8 })

/** Prefix and suffix added to the game name in the browser tab, search results and share cards. */
export const TITLE_PREFIX = "Play"
export const TITLE_SUFFIX = "Online [PBGO]"

/** « Play Courtisans Online [PBGO] » */
export const siteTitle = (title: string) => `${TITLE_PREFIX} ${title.trim()} ${TITLE_SUFFIX}`

/** « Play Courtisans Online [PBGO] · Table #4XV-XA1 » */
export const tableTitle = (title: string, code: string) => {
  const c = code.toUpperCase()
  return `${siteTitle(title)} · Table #${c.length === 6 ? `${c.slice(0, 3)}-${c.slice(3)}` : c}`
}

/** Settings of a game when Sanity has nothing: its constants, then `SETTINGS_DEFAULTS` of its binding. */
export const defaultSettings = perGame((binding): SiteSettings => {
  const i18n = gameI18n(binding)
  const bounds = playerBounds(binding)
  return {
    title: binding.NAME,
    description: binding.DESCRIPTION,
    descriptions: byLocale((l) => (l === "fr" ? binding.DESCRIPTION : (i18n[l]?.description ?? ""))),
    creditsAuthors: byLocale((l) => (l === "fr" ? "" : (i18n[l]?.authors ?? ""))),
    logo: null,
    favicon: null,
    shareImage: null,
    minPlayers: bounds.min,
    maxPlayers: bounds.max,
    bodyFont: null,
    displayFont: null,
    rulesPdf: byLocale(() => null),
    rulesPdfLinks: byLocale(() => null),
    files: { rulesFr: null, rulesEn: null, rulesEs: null, rulesDe: null, fontBody: null, fontDisplay: null },
    credits: { authors: null, publisher: null, publisherUrl: null },
    turnTimeout: TURN_TIMEOUT_BOUNDS.default,
    options: { defaults: binding.GAME ? defaultOptions(binding.GAME.options) : {}, hidden: [] },
    ...binding.SETTINGS_DEFAULTS,
    theme: defaultTheme(binding),
  }
})

const HEX = /^#[0-9a-fA-F]{6}$/

export const isHex = (v: unknown): v is string => typeof v === "string" && HEX.test(v)

export function clampPlayers(binding: GameBinding, min: unknown, max: unknown) {
  const bounds = playerBounds(binding)
  const toInt = (v: unknown, d: number) => (typeof v === "number" && Number.isFinite(v) ? Math.round(v) : d)
  const lo = Math.min(bounds.max, Math.max(bounds.min, toInt(min, bounds.min)))
  const hi = Math.min(bounds.max, Math.max(lo, toInt(max, bounds.max)))
  return { minPlayers: lo, maxPlayers: hi }
}

export function clampTimeout(v: unknown) {
  const n = typeof v === "number" && Number.isFinite(v) ? Math.round(v) : TURN_TIMEOUT_BOUNDS.default
  return Math.min(TURN_TIMEOUT_BOUNDS.max, Math.max(TURN_TIMEOUT_BOUNDS.min, n))
}

const engineOptions = (binding: GameBinding) => binding.GAME?.options ?? {}

export function cleanOptions(binding: GameBinding, v: unknown): OptionSettings {
  const raw = (v && typeof v === "object" ? v : {}) as { defaults?: unknown; hidden?: unknown }
  const keys = Object.keys(engineOptions(binding))
  return {
    defaults: normalizeOptions(engineOptions(binding), raw.defaults),
    hidden: Array.isArray(raw.hidden) ? raw.hidden.filter((k): k is string => typeof k === "string" && keys.includes(k)) : [],
  }
}

/** Options of a new game: the admin defaults. Options changed by the host: the hidden ones keep their default. */
export function gameOptions(binding: GameBinding, settings: OptionSettings, values: unknown = {}, ctx: OptionContext = {}): OptionValues {
  const merged = normalizeOptions(engineOptions(binding), { ...settings.defaults, ...(values as object) }, ctx)
  for (const k of settings.hidden) merged[k] = settings.defaults[k]!
  return merged
}

export const isFont = (v: unknown): v is string => typeof v === "string" && (FONT_CHOICES as readonly string[]).includes(v)

const fontStack = (family: string | null, fallback: string) => (family ? `"${family}", ${fallback}` : fallback)

const BODY_FALLBACK = 'ui-rounded, "Avenir Next", "Nunito", system-ui, -apple-system, sans-serif'

export const UPLOADED_BODY_FONT = "Site Body"
export const UPLOADED_TITLE_FONT = "Site Title"

const bodyFamily = (s: SiteSettings) => (s.files.fontBody ? UPLOADED_BODY_FONT : s.bodyFont)
const titleFamily = (s: SiteSettings) => (s.files.fontDisplay ? UPLOADED_TITLE_FONT : s.displayFont)

const FONT_FORMATS: Record<string, string> = { woff2: "woff2", woff: "woff", ttf: "truetype", otf: "opentype" }

/** Sanity file served same-origin (fonts, sounds, SVG): the `/api/media` route is shared by every game. */
export const mediaUrl = (url: string) => `/api/media?url=${encodeURIComponent(url)}`

// @font-face of the uploaded fonts (served same-origin by /api/media)
export function fontFaceCss(files: SettingsFiles) {
  const entries: [string, UploadedFile | null][] = [
    [UPLOADED_BODY_FONT, files.fontBody],
    [UPLOADED_TITLE_FONT, files.fontDisplay],
  ]
  return entries
    .filter((f): f is [string, UploadedFile] => !!f[1])
    .map(([family, file]) => {
      const format = FONT_FORMATS[file.name.split(".").pop()?.toLowerCase() ?? ""]
      return `@font-face{font-family:"${family}";src:url("${mediaUrl(file.url)}")${format ? ` format("${format}")` : ""};font-weight:100 900;font-display:swap}`
    })
    .join("")
}

export function themeStyle(s: SiteSettings): Record<string, string> {
  return {
    "--background": s.theme.background,
    "--foreground": s.theme.foreground,
    "--accent-game": s.theme.accent,
    "--surface": s.theme.surface,
    "--surface-dark": s.theme.surfaceDark,
    "--primary-foreground": s.theme.background,
    "--popover": s.theme.foreground,
    "--popover-foreground": s.theme.background,
    "--secondary": s.theme.foreground,
    "--secondary-foreground": s.theme.background,
    "--muted": `color-mix(in oklab, ${s.theme.surface}, ${s.theme.foreground} 8%)`,
    "--accent": `color-mix(in oklab, ${s.theme.surface}, ${s.theme.foreground} 8%)`,
    // without a chosen font, keep the ones of the game CSS (:root --font-body / --font-title)
    ...(bodyFamily(s) ? { "--font-body": fontStack(bodyFamily(s), BODY_FALLBACK) } : {}),
    ...((titleFamily(s) ?? bodyFamily(s)) ? { "--font-title": fontStack(titleFamily(s) ?? bodyFamily(s), BODY_FALLBACK) } : {}),
  }
}

export function googleFontsHref(fonts: (string | null)[]) {
  const families = [...new Set(fonts.filter(isFont))]
  if (!families.length) return null
  const query = families.map((f) => `family=${f.replace(/ /g, "+")}${FONT_WEIGHTS[f] ? `:wght@${FONT_WEIGHTS[f]}` : ""}`).join("&")
  return `https://fonts.googleapis.com/css2?${query}&display=swap`
}
