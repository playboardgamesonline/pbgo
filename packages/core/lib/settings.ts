import { GAME } from "@pgo/binding"
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

// Fichiers envoyés depuis /setup (stockés dans Sanity)
export type UploadSlot = "logo" | "rulesFr" | "rulesEn" | "fontBody" | "fontDisplay"
export type SettingsFiles = Record<Exclude<UploadSlot, "logo">, UploadedFile | null>

export type ThemeColors = { background: string; foreground: string; accent: string; surface: string; surfaceDark: string }

export type SiteSettings = {
  title: string
  description: string
  logo: string | null
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
}

export const THEME_FIELDS: { key: keyof ThemeColors; label: string; hint: string }[] = [
  { key: "background", label: "Fond", hint: "Arrière-plan des écrans" },
  { key: "foreground", label: "Texte", hint: "Texte principal" },
  { key: "accent", label: "Accent", hint: "Boutons, sélection, titres" },
  { key: "surface", label: "Surface", hint: "Cartes et panneaux" },
  { key: "surfaceDark", label: "Surface foncée", hint: "Champs et fonds secondaires" },
]

export const DEFAULT_THEME: ThemeColors = {
  background: "#13213a",
  foreground: "#f5f2ea",
  accent: "#e8b43a",
  surface: "#1b2c4a",
  surfaceDark: "#0d1729",
}

export const PLAYER_BOUNDS = { min: GAME.minPlayers, max: GAME.maxPlayers }

export const DEFAULT_SETTINGS: SiteSettings = {
  title: NAME,
  description: DESCRIPTION,
  logo: null,
  minPlayers: GAME.minPlayers,
  maxPlayers: GAME.maxPlayers,
  theme: DEFAULT_THEME,
  bodyFont: null,
  displayFont: null,
  rulesPdf: { fr: null, en: null },
  rulesPdfLinks: { fr: null, en: null },
  files: { rulesFr: null, rulesEn: null, fontBody: null, fontDisplay: null },
  credits: { authors: null, publisher: null, publisherUrl: null },
}

const HEX = /^#[0-9a-fA-F]{6}$/

export const isHex = (v: unknown): v is string => typeof v === "string" && HEX.test(v)

export function clampPlayers(min: unknown, max: unknown) {
  const toInt = (v: unknown, d: number) => (typeof v === "number" && Number.isFinite(v) ? Math.round(v) : d)
  const lo = Math.min(PLAYER_BOUNDS.max, Math.max(PLAYER_BOUNDS.min, toInt(min, PLAYER_BOUNDS.min)))
  const hi = Math.min(PLAYER_BOUNDS.max, Math.max(lo, toInt(max, PLAYER_BOUNDS.max)))
  return { minPlayers: lo, maxPlayers: hi }
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
    "--font-body": fontStack(bodyFamily(s), BODY_FALLBACK),
    "--font-title": fontStack(titleFamily(s) ?? bodyFamily(s), BODY_FALLBACK),
  }
}

export function googleFontsHref(fonts: (string | null)[]) {
  const families = [...new Set(fonts.filter(isFont))]
  if (!families.length) return null
  const query = families.map((f) => `family=${f.replace(/ /g, "+")}${FONT_WEIGHTS[f] ? `:wght@${FONT_WEIGHTS[f]}` : ""}`).join("&")
  return `https://fonts.googleapis.com/css2?${query}&display=swap`
}
