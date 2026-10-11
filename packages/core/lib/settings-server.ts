import "server-only"
import { cache } from "react"
import { sanityClient } from "../sanity/client"
import { fixedUrlFor, type SanityImageSource, urlFor } from "../sanity/image"
import type { GameModule } from "./binding"
import type { Locale, Localized } from "./i18n"
import { getLocale } from "./locale-server"
import { byLocale, clampPlayers, RULES_FIELD, clampTimeout, cleanOptions, defaultSettings, defaultTheme, isFont, isHex, type SiteSettings, type ThemeColors, type UploadedFile } from "./settings"

/** Cache tag of a game's settings (revalidated when the admin saves). */
export const settingsTag = (slug: string) => `${slug}:settings`

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
type ImageRef = (SanityImageSource & { asset?: { _ref?: string }; mime?: string }) | null | undefined

const hasImage = (i: ImageRef): i is NonNullable<ImageRef> => !!i?.asset?._ref

function parseJson(v: unknown) {
  try {
    return typeof v === "string" ? JSON.parse(v) : undefined
  } catch {
    return undefined
  }
}

export const SETTINGS_QUERY = `*[_id == "settings"][0]{ title, description, descriptionI18n, creditsAuthorsI18n, logo, "favicon": favicon{asset, crop, hotspot, "mime": asset->mimeType}, shareImage, turnTimeout, gameOptions, minPlayers, maxPlayers, theme, bodyFont, displayFont, rulesPdfFr, rulesPdfEn, rulesPdfEs, rulesPdfDe, creditsAuthors, publisher, publisherUrl, "rulesPdfFrFile": rulesPdfFrFile.asset->{url, "name": originalFilename}, "rulesPdfEnFile": rulesPdfEnFile.asset->{url, "name": originalFilename}, "rulesPdfEsFile": rulesPdfEsFile.asset->{url, "name": originalFilename}, "rulesPdfDeFile": rulesPdfDeFile.asset->{url, "name": originalFilename}, "bodyFontFile": bodyFontFile.asset->{url, "name": originalFilename}, "displayFontFile": displayFontFile.asset->{url, "name": originalFilename} }`

const file = (f: FileRef | undefined): UploadedFile | null => (f?.url ? { url: f.url, name: f.name || f.url.split("/").pop() || "file" } : null)

const url = (v: unknown) => (typeof v === "string" && /^https?:\/\//.test(v) ? v : null)

const pickText = (v: Localized, l: Locale) => {
  const x = v?.[l]
  return typeof x === "string" && x.trim() ? x.trim() : ""
}

export function toSettings(game: GameModule, doc: SettingsDoc, locale: Locale = "fr"): SiteSettings {
  const defaults = defaultSettings(game.binding)
  if (!doc) return { ...defaults, description: defaults.descriptions[locale] || defaults.descriptions.fr, credits: { ...defaults.credits, authors: defaults.creditsAuthors[locale] || defaults.credits.authors } }
  const descriptions = byLocale((l) => pickText(doc.descriptionI18n, l) || (l === "fr" ? doc.description?.trim() || "" : "") || defaults.descriptions[l])
  const authors = byLocale((l) => pickText(doc.creditsAuthorsI18n, l) || (l === "fr" ? doc.creditsAuthors?.trim() || "" : "") || (l === "fr" ? (defaults.credits.authors ?? "") : defaults.creditsAuthors[l]))
  const theme = Object.fromEntries(
    Object.entries(defaultTheme(game.binding)).map(([k, d]) => [k, isHex(doc.theme?.[k as keyof ThemeColors]) ? doc.theme![k as keyof ThemeColors]! : d]),
  ) as ThemeColors
  return {
    title: doc.title?.trim() || defaults.title,
    description: descriptions[locale] || descriptions.fr,
    descriptions,
    creditsAuthors: authors,
    logo: hasImage(doc.logo) ? urlFor(game, doc.logo).width(1200).url() : defaults.logo,
    favicon: hasImage(doc.favicon) ? (doc.favicon.mime === "image/svg+xml" ? fixedUrlFor(game, doc.favicon).url() : fixedUrlFor(game, doc.favicon).width(512).height(512).fit("fill").format("png").url()) : defaults.favicon,
    shareImage: hasImage(doc.shareImage) ? fixedUrlFor(game, doc.shareImage).width(1200).height(630).fit("crop").format("jpg").quality(88).url() : defaults.shareImage,
    turnTimeout: doc.turnTimeout == null ? defaults.turnTimeout : clampTimeout(doc.turnTimeout),
    options: doc.gameOptions ? cleanOptions(game.binding, { defaults: parseJson(doc.gameOptions.defaults), hidden: doc.gameOptions.hidden }) : defaults.options,
    ...clampPlayers(game.binding, doc.minPlayers, doc.maxPlayers),
    theme,
    bodyFont: isFont(doc.bodyFont) ? doc.bodyFont : defaults.bodyFont,
    displayFont: isFont(doc.displayFont) ? doc.displayFont : defaults.displayFont,
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
      publisher: doc.publisher?.trim() || defaults.credits.publisher,
      publisherUrl: url(doc.publisherUrl) ?? defaults.credits.publisherUrl,
    },
  }
}

const settingsFor = cache(async (game: GameModule, locale: Locale): Promise<SiteSettings> => {
  const client = sanityClient(game)
  if (!client) return toSettings(game, null, locale)
  try {
    const doc = await client.withConfig({ useCdn: false }).fetch<SettingsDoc>(SETTINGS_QUERY, {}, { next: { tags: [settingsTag(game.slug)], revalidate: 60 } })
    return toSettings(game, doc, locale)
  } catch {
    return toSettings(game, null, locale)
  }
})

/** Settings of a game in the visitor's language; explicit `locale` for renders that do not depend on the request (icons, share image). */
export const loadSettings = async (game: GameModule, locale?: Locale): Promise<SiteSettings> => settingsFor(game, locale ?? (await getLocale()))
