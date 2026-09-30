import "server-only"
import { cache } from "react"
import { client } from "../sanity/client"
import { fixedUrlFor, urlFor } from "../sanity/image"
import type { Locale, Localized } from "./i18n"
import { getLocale } from "./locale-server"
import { byLocale, clampPlayers, RULES_FIELD, clampTimeout, cleanOptions, DEFAULT_SETTINGS, DEFAULT_THEME, isFont, isHex, type SiteSettings, type ThemeColors, type UploadedFile } from "./settings"

export const SETTINGS_TAG = "settings"

export type SettingsDoc = {
  title?: string
  description?: string
  descriptionI18n?: Localized
  creditsAuthorsI18n?: Localized
  logo?: ImageRef
  favicon?: ImageRef
  shareImage?: ImageRef
  turnTimeout?: number
  gameOptions?: { defaults?: string; hidden?: string[] }
  minPlayers?: number
  maxPlayers?: number
  theme?: Partial<ThemeColors>
  bodyFont?: string
  displayFont?: string
  rulesPdfFr?: string
  rulesPdfEn?: string
  rulesPdfEs?: string
  rulesPdfDe?: string
  creditsAuthors?: string
  publisher?: string
  publisherUrl?: string
  rulesPdfFrFile?: FileRef
  rulesPdfEnFile?: FileRef
  rulesPdfEsFile?: FileRef
  rulesPdfDeFile?: FileRef
  bodyFontFile?: FileRef
  displayFontFile?: FileRef
} | null

type FileRef = { url?: string; name?: string } | null
type ImageRef = (Parameters<typeof urlFor>[0] & { asset?: { _ref?: string }; mime?: string }) | null | undefined

const hasImage = (i: ImageRef): i is NonNullable<ImageRef> => !!i?.asset?._ref

function parseJson(v: unknown) {
  try {
    return typeof v === "string" ? JSON.parse(v) : undefined
  } catch {
    return undefined
  }
}

export const SETTINGS_QUERY = `*[_id == "settings"][0]{ title, description, descriptionI18n, creditsAuthorsI18n, logo, "favicon": favicon{asset, crop, hotspot, "mime": asset->mimeType}, shareImage, turnTimeout, gameOptions, minPlayers, maxPlayers, theme, bodyFont, displayFont, rulesPdfFr, rulesPdfEn, rulesPdfEs, rulesPdfDe, creditsAuthors, publisher, publisherUrl, "rulesPdfFrFile": rulesPdfFrFile.asset->{url, "name": originalFilename}, "rulesPdfEnFile": rulesPdfEnFile.asset->{url, "name": originalFilename}, "rulesPdfEsFile": rulesPdfEsFile.asset->{url, "name": originalFilename}, "rulesPdfDeFile": rulesPdfDeFile.asset->{url, "name": originalFilename}, "bodyFontFile": bodyFontFile.asset->{url, "name": originalFilename}, "displayFontFile": displayFontFile.asset->{url, "name": originalFilename} }`

const file = (f: FileRef | undefined): UploadedFile | null => (f?.url ? { url: f.url, name: f.name || f.url.split("/").pop() || "fichier" } : null)

const url = (v: unknown) => (typeof v === "string" && /^https?:\/\//.test(v) ? v : null)

const pickText = (v: Localized, l: Locale) => {
  const x = v?.[l]
  return typeof x === "string" && x.trim() ? x.trim() : ""
}

export function toSettings(doc: SettingsDoc, locale: Locale = "fr"): SiteSettings {
  if (!doc) return { ...DEFAULT_SETTINGS, description: DEFAULT_SETTINGS.descriptions[locale] || DEFAULT_SETTINGS.descriptions.fr, credits: { ...DEFAULT_SETTINGS.credits, authors: DEFAULT_SETTINGS.creditsAuthors[locale] || DEFAULT_SETTINGS.credits.authors } }
  const descriptions = byLocale((l) => pickText(doc.descriptionI18n, l) || (l === "fr" ? doc.description?.trim() || "" : "") || DEFAULT_SETTINGS.descriptions[l])
  const authors = byLocale((l) => pickText(doc.creditsAuthorsI18n, l) || (l === "fr" ? doc.creditsAuthors?.trim() || "" : "") || (l === "fr" ? (DEFAULT_SETTINGS.credits.authors ?? "") : DEFAULT_SETTINGS.creditsAuthors[l]))
  const theme = Object.fromEntries(
    Object.entries(DEFAULT_THEME).map(([k, d]) => [k, isHex(doc.theme?.[k as keyof ThemeColors]) ? doc.theme![k as keyof ThemeColors]! : d]),
  ) as ThemeColors
  return {
    title: doc.title?.trim() || DEFAULT_SETTINGS.title,
    description: descriptions[locale] || descriptions.fr,
    descriptions,
    creditsAuthors: authors,
    logo: hasImage(doc.logo) ? urlFor(doc.logo).width(1200).url() : DEFAULT_SETTINGS.logo,
    favicon: hasImage(doc.favicon) ? (doc.favicon.mime === "image/svg+xml" ? fixedUrlFor(doc.favicon).url() : fixedUrlFor(doc.favicon).width(512).height(512).fit("fill").format("png").url()) : DEFAULT_SETTINGS.favicon,
    shareImage: hasImage(doc.shareImage) ? fixedUrlFor(doc.shareImage).width(1200).height(630).fit("crop").format("jpg").quality(88).url() : DEFAULT_SETTINGS.shareImage,
    turnTimeout: doc.turnTimeout == null ? DEFAULT_SETTINGS.turnTimeout : clampTimeout(doc.turnTimeout),
    options: doc.gameOptions ? cleanOptions({ defaults: parseJson(doc.gameOptions.defaults), hidden: doc.gameOptions.hidden }) : DEFAULT_SETTINGS.options,
    ...clampPlayers(doc.minPlayers, doc.maxPlayers),
    theme,
    bodyFont: isFont(doc.bodyFont) ? doc.bodyFont : DEFAULT_SETTINGS.bodyFont,
    displayFont: isFont(doc.displayFont) ? doc.displayFont : DEFAULT_SETTINGS.displayFont,
    rulesPdf: byLocale((l) => file(doc[`${RULES_FIELD[l]}File`])?.url ?? url(doc[RULES_FIELD[l]])),
    rulesPdfLinks: byLocale((l) => url(doc[RULES_FIELD[l]])),
    files: {
      rulesFr: file(doc.rulesPdfFrFile),
      rulesEn: file(doc.rulesPdfEnFile),
      rulesEs: file(doc.rulesPdfEsFile),
      rulesDe: file(doc.rulesPdfDeFile),
      fontBody: file(doc.bodyFontFile),
      fontDisplay: file(doc.displayFontFile),
    },
    credits: {
      authors: authors[locale] || authors.fr || null,
      publisher: doc.publisher?.trim() || DEFAULT_SETTINGS.credits.publisher,
      publisherUrl: url(doc.publisherUrl) ?? DEFAULT_SETTINGS.credits.publisherUrl,
    },
  }
}

const settingsFor = cache(async (locale: Locale): Promise<SiteSettings> => {
  if (!client) return toSettings(null, locale)
  try {
    const doc = await client.withConfig({ useCdn: false }).fetch<SettingsDoc>(SETTINGS_QUERY, {}, { next: { tags: [SETTINGS_TAG], revalidate: 60 } })
    return toSettings(doc, locale)
  } catch {
    return toSettings(null, locale)
  }
})

/** Réglages dans la langue du visiteur ; `locale` explicite pour les rendus indépendants de la requête (icônes, image de partage). */
export const loadSettings = async (locale?: Locale): Promise<SiteSettings> => settingsFor(locale ?? (await getLocale()))
