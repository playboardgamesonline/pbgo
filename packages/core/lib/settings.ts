import * as binding from "@pgo/binding"
import { defaultOptions, GAME, normalizeOptions, type OptionValues } from "@pgo/binding"
import { FONT_CHOICES } from "@pgo/studio-kit/constants"
import { DESCRIPTION, NAME } from "@pgo/binding"

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

// Crédits du jeu original, affichés dans le pied de page (vides : pas de mention d'adaptation)
// authors : texte libre après « un jeu de », ex. « Romaric Galonnier et Anthony Perone, illustré par Noëmie Chevalier »
export type Credits = { authors: string | null; publisher: string | null; publisherUrl: string | null }

export type UploadedFile = { url: string; name: string }

// Fichiers envoyés depuis l'admin (stockés dans Sanity) : réglages (`settings`) et habillage (`interface`)
export const SETTINGS_FILE_SLOTS = ["rulesFr", "rulesEn", "fontBody", "fontDisplay"] as const
export const SETTINGS_IMAGE_SLOTS = ["logo", "favicon", "shareImage"] as const
export const VISUAL_IMAGE_SLOTS = ["background", "pattern", "decorTop", "decorBottom", "hero", "hostIcon"] as const
export type VisualSlot = (typeof VISUAL_IMAGE_SLOTS)[number]
export type UploadSlot = (typeof SETTINGS_FILE_SLOTS)[number] | (typeof SETTINGS_IMAGE_SLOTS)[number] | VisualSlot
export type SettingsFiles = Record<(typeof SETTINGS_FILE_SLOTS)[number], UploadedFile | null>

/** Options du moteur : valeur par défaut choisie dans l'admin et options masquées dans le lobby (gardent leur défaut). */
export type OptionSettings = { defaults: OptionValues; hidden: string[] }

export const TURN_TIMEOUT_BOUNDS = { min: 20, max: 600, default: 60 }

export type ThemeColors = { background: string; foreground: string; accent: string; surface: string; surfaceDark: string }

export type SiteSettings = {
  title: string
  description: string
  logo: string | null
  /** Icône d'onglet (PNG ou SVG) ; sans elle, générée depuis le logo */
  favicon: string | null
  /** Image de partage 1200×630 ; sans elle, générée depuis l'habillage */
  shareImage: string | null
  minPlayers: number
  maxPlayers: number
  theme: ThemeColors
  bodyFont: string | null
  displayFont: string | null
  // lien effectif (PDF envoyé, sinon lien saisi)
  rulesPdf: { fr: string | null; en: string | null }
  rulesPdfLinks: { fr: string | null; en: string | null }
  files: SettingsFiles
  credits: Credits
  /** Secondes d'inactivité avant de pouvoir jouer à la place d'un joueur absent */
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

export const DEFAULT_THEME: ThemeColors = { ...CORE_THEME, ...(binding as { SETTINGS_DEFAULTS?: { theme?: Partial<ThemeColors> } }).SETTINGS_DEFAULTS?.theme }

export const PLAYER_BOUNDS = { min: GAME.minPlayers, max: GAME.maxPlayers }

/** Valeurs par défaut propres au jeu (thème, polices, crédits…) quand Sanity n'a rien : export facultatif `SETTINGS_DEFAULTS` de @pgo/binding. */
const gameDefaults = (binding as { SETTINGS_DEFAULTS?: Partial<Omit<SiteSettings, "theme">> & { theme?: Partial<ThemeColors> } }).SETTINGS_DEFAULTS ?? {}

/** Suffixe ajouté au nom du jeu dans l'onglet du navigateur, les résultats de recherche et les cartes de partage. */
export const TITLE_SUFFIX = "Online (PBGO)"

/** Nom du jeu tel qu'enregistré dans l'admin : sans « Online » ni « (PBGO) » (tolère les anciennes valeurs). */
export const gameName = (title: string) => title.replace(/\s*\bonline\b(\s*\(PBGO\))?\s*$/i, "").trim()

/** « Courtisans Online (PBGO) » */
export const siteTitle = (title: string) => `${gameName(title)} ${TITLE_SUFFIX}`

/** « Courtisans Online (PBGO) · Table #4XV-XA1 » */
export const tableTitle = (title: string, code: string) => {
  const c = code.toUpperCase()
  return `${siteTitle(title)} · Table #${c.length === 6 ? `${c.slice(0, 3)}-${c.slice(3)}` : c}`
}

export const DEFAULT_SETTINGS: SiteSettings = {
  title: gameName(NAME),
  description: DESCRIPTION,
  logo: null,
  favicon: null,
  shareImage: null,
  minPlayers: GAME.minPlayers,
  maxPlayers: GAME.maxPlayers,
  bodyFont: null,
  displayFont: null,
  rulesPdf: { fr: null, en: null },
  rulesPdfLinks: { fr: null, en: null },
  files: { rulesFr: null, rulesEn: null, fontBody: null, fontDisplay: null },
  credits: { authors: null, publisher: null, publisherUrl: null },
  turnTimeout: TURN_TIMEOUT_BOUNDS.default,
  options: { defaults: defaultOptions(GAME.options), hidden: [] },
  ...gameDefaults,
  theme: { ...DEFAULT_THEME, ...gameDefaults.theme },
}

const HEX = /^#[0-9a-fA-F]{6}$/

export const isHex = (v: unknown): v is string => typeof v === "string" && HEX.test(v)

export function clampPlayers(min: unknown, max: unknown) {
  const toInt = (v: unknown, d: number) => (typeof v === "number" && Number.isFinite(v) ? Math.round(v) : d)
  const lo = Math.min(PLAYER_BOUNDS.max, Math.max(PLAYER_BOUNDS.min, toInt(min, PLAYER_BOUNDS.min)))
  const hi = Math.min(PLAYER_BOUNDS.max, Math.max(lo, toInt(max, PLAYER_BOUNDS.max)))
  return { minPlayers: lo, maxPlayers: hi }
}

export function clampTimeout(v: unknown) {
  const n = typeof v === "number" && Number.isFinite(v) ? Math.round(v) : TURN_TIMEOUT_BOUNDS.default
  return Math.min(TURN_TIMEOUT_BOUNDS.max, Math.max(TURN_TIMEOUT_BOUNDS.min, n))
}

export function cleanOptions(v: unknown): OptionSettings {
  const raw = (v && typeof v === "object" ? v : {}) as { defaults?: unknown; hidden?: unknown }
  const keys = Object.keys(GAME.options)
  return {
    defaults: normalizeOptions(GAME.options, raw.defaults),
    hidden: Array.isArray(raw.hidden) ? raw.hidden.filter((k): k is string => typeof k === "string" && keys.includes(k)) : [],
  }
}

/** Options d'une nouvelle partie : défauts de l'admin. Options d'une partie modifiées par l'hôte : les masquées restent au défaut. */
export function gameOptions(settings: OptionSettings, values: unknown = {}): OptionValues {
  const merged = normalizeOptions(GAME.options, { ...settings.defaults, ...(values as object) })
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

export const mediaUrl = (url: string) => `/api/media?url=${encodeURIComponent(url)}`

// @font-face des polices envoyées (servies en same-origin par /api/media)
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
    // sans police choisie, on garde celles du CSS du jeu (:root --font-body / --font-title)
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
