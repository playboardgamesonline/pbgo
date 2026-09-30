import "server-only"
import { cache } from "react"
import { client } from "../sanity/client"
import { fixedUrlFor, urlFor } from "../sanity/image"
import { clampPlayers, clampTimeout, cleanOptions, DEFAULT_SETTINGS, DEFAULT_THEME, isFont, isHex, type SiteSettings, type ThemeColors, type UploadedFile } from "./settings"

export const SETTINGS_TAG = "settings"

export type SettingsDoc = {
  title?: string
  description?: string
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
  creditsAuthors?: string
  publisher?: string
  publisherUrl?: string
  rulesPdfFrFile?: FileRef
  rulesPdfEnFile?: FileRef
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

export const SETTINGS_QUERY = `*[_id == "settings"][0]{ title, description, logo, "favicon": favicon{asset, crop, hotspot, "mime": asset->mimeType}, shareImage, turnTimeout, gameOptions, minPlayers, maxPlayers, theme, bodyFont, displayFont, rulesPdfFr, rulesPdfEn, creditsAuthors, publisher, publisherUrl, "rulesPdfFrFile": rulesPdfFrFile.asset->{url, "name": originalFilename}, "rulesPdfEnFile": rulesPdfEnFile.asset->{url, "name": originalFilename}, "bodyFontFile": bodyFontFile.asset->{url, "name": originalFilename}, "displayFontFile": displayFontFile.asset->{url, "name": originalFilename} }`

const file = (f: FileRef | undefined): UploadedFile | null => (f?.url ? { url: f.url, name: f.name || f.url.split("/").pop() || "fichier" } : null)

const url = (v: unknown) => (typeof v === "string" && /^https?:\/\//.test(v) ? v : null)

export function toSettings(doc: SettingsDoc): SiteSettings {
  if (!doc) return DEFAULT_SETTINGS
  const theme = Object.fromEntries(
    Object.entries(DEFAULT_THEME).map(([k, d]) => [k, isHex(doc.theme?.[k as keyof ThemeColors]) ? doc.theme![k as keyof ThemeColors]! : d]),
  ) as ThemeColors
  return {
    title: doc.title?.trim() || DEFAULT_SETTINGS.title,
    description: doc.description?.trim() || DEFAULT_SETTINGS.description,
    logo: hasImage(doc.logo) ? urlFor(doc.logo).width(1200).url() : DEFAULT_SETTINGS.logo,
    favicon: hasImage(doc.favicon) ? (doc.favicon.mime === "image/svg+xml" ? fixedUrlFor(doc.favicon).url() : fixedUrlFor(doc.favicon).width(512).height(512).fit("fill").format("png").url()) : DEFAULT_SETTINGS.favicon,
    shareImage: hasImage(doc.shareImage) ? fixedUrlFor(doc.shareImage).width(1200).height(630).fit("crop").format("jpg").quality(88).url() : DEFAULT_SETTINGS.shareImage,
    turnTimeout: doc.turnTimeout == null ? DEFAULT_SETTINGS.turnTimeout : clampTimeout(doc.turnTimeout),
    options: doc.gameOptions ? cleanOptions({ defaults: parseJson(doc.gameOptions.defaults), hidden: doc.gameOptions.hidden }) : DEFAULT_SETTINGS.options,
    ...clampPlayers(doc.minPlayers, doc.maxPlayers),
    theme,
    bodyFont: isFont(doc.bodyFont) ? doc.bodyFont : DEFAULT_SETTINGS.bodyFont,
    displayFont: isFont(doc.displayFont) ? doc.displayFont : DEFAULT_SETTINGS.displayFont,
    rulesPdf: { fr: file(doc.rulesPdfFrFile)?.url ?? url(doc.rulesPdfFr), en: file(doc.rulesPdfEnFile)?.url ?? url(doc.rulesPdfEn) },
    rulesPdfLinks: { fr: url(doc.rulesPdfFr), en: url(doc.rulesPdfEn) },
    files: { rulesFr: file(doc.rulesPdfFrFile), rulesEn: file(doc.rulesPdfEnFile), fontBody: file(doc.bodyFontFile), fontDisplay: file(doc.displayFontFile) },
    credits: {
      authors: doc.creditsAuthors?.trim() || DEFAULT_SETTINGS.credits.authors,
      publisher: doc.publisher?.trim() || DEFAULT_SETTINGS.credits.publisher,
      publisherUrl: url(doc.publisherUrl) ?? DEFAULT_SETTINGS.credits.publisherUrl,
    },
  }
}

export const loadSettings = cache(async (): Promise<SiteSettings> => {
  if (!client) return DEFAULT_SETTINGS
  try {
    const doc = await client.withConfig({ useCdn: false }).fetch<SettingsDoc>(SETTINGS_QUERY, {}, { next: { tags: [SETTINGS_TAG], revalidate: 60 } })
    return toSettings(doc)
  } catch {
    return DEFAULT_SETTINGS
  }
})
