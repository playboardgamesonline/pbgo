import "server-only"
import { cache } from "react"
import { sanityClient } from "../sanity/client"
import { type SanityImageSource, urlFor } from "../sanity/image"
import type { GameEntry, GameModule } from "./binding"
import { type Locale, only, type Localized } from "./i18n"
import { getLocale } from "./locale-server"
import { mediaUrl } from "./settings"
import { baseSkin, type DecorImage, mergeSkin, type Skin, type SkinDefaults } from "./skin"

/** Cache tag of a game's skin and texts (revalidated when the admin saves). */
export const skinTag = (slug: string) => `${slug}:skin`

type ImageRef = (SanityImageSource & { asset?: { _ref?: string }; ratio?: number; mime?: string }) | null | undefined
type SanityGame = Pick<GameEntry, "sanityProjectId">

type SkinDoc = {
  interface?: {
    background?: ImageRef
    pattern?: ImageRef
    decorTop?: ImageRef
    decorBottom?: ImageRef
    hero?: ImageRef
    hostIcon?: ImageRef
    playerColors?: string[]
    desktopOnly?: boolean
  } | null
  texts?: ({
    tagline?: Localized
    homeTitle?: Localized
    homeIntro?: Localized
    errorMessages?: { code?: string; message?: Localized }[]
    victoryPhrases?: Localized<string[]>
  } & Record<string, unknown>) | null
} | null

const IMG = "{asset, crop, hotspot, \"ratio\": asset->metadata.dimensions.aspectRatio, \"mime\": asset->mimeType}"

/** GROQ of the skin from the `interface` and `texts` documents: the published ones by default, the draft ids when the admin reads what the Studio shows. The ids are constants of the server, never user input. */
export const skinQuery = (ids = { interface: "interface", texts: "texts" }) => `{
  "interface": *[_id == "${ids.interface}"][0]{ "background": background${IMG}, "pattern": pattern${IMG}, "decorTop": decorTop${IMG}, "decorBottom": decorBottom${IMG}, "hero": hero${IMG}, "hostIcon": hostIcon${IMG}, playerColors, desktopOnly },
  "texts": *[_id == "${ids.texts}"][0]{ tagline, homeTitle, homeIntro, victoryPhrases, ui_home, ui_lobby, ui_game, errorMessages }
}`

export const SKIN_QUERY = skinQuery()

const has = (i: ImageRef): i is NonNullable<ImageRef> => !!i?.asset?._ref

const image = (game: SanityGame, i: ImageRef, width: number) => (has(i) ? urlFor(game, i).width(width).url() : null)

// SVG (icons, masks): served same-origin, not resized
const picto = (game: SanityGame, i: ImageRef) => (has(i) ? (i.mime === "image/svg+xml" ? mediaUrl(urlFor(game, i).url()) : mediaUrl(urlFor(game, i).width(256).url())) : null)

function decor(game: SanityGame, i: ImageRef): DecorImage | null {
  if (!has(i)) return null
  const full = urlFor(game, i).width(3000).url()
  return { url: full, srcSet: `${urlFor(game, i).width(1600).url()} 1600w, ${full} 3000w`, ratio: i.ratio ?? null }
}

const HEX = /^#[0-9a-fA-F]{6}$/

export type { SkinDoc }

export function toSkin(game: SanityGame, doc: SkinDoc, locale: Locale = "fr"): Partial<SkinDefaults> {
  const ui = doc?.interface
  const t = doc?.texts
  const labels = Object.fromEntries(
    ["ui_home", "ui_lobby", "ui_game"].flatMap((g) => Object.entries((t?.[g] as Record<string, Localized>) ?? {}).map(([k, v]) => [k, only(v, locale)?.trim()])),
  )
  const colors = (ui?.playerColors ?? []).filter((c) => HEX.test(c))
  const phrases = (only(t?.victoryPhrases, locale) ?? []).filter((p) => p.trim())
  return {
    decor: {
      background: image(game, ui?.background, 2400),
      pattern: image(game, ui?.pattern, 512),
      top: decor(game, ui?.decorTop),
      bottom: decor(game, ui?.decorBottom),
      hero: image(game, ui?.hero, 1400),
    },
    hostIcon: picto(game, ui?.hostIcon),
    ...(colors.length ? { playerColors: colors } : {}),
    ...(typeof ui?.desktopOnly === "boolean" ? { desktopOnly: ui.desktopOnly } : {}),
    home: { title: only(t?.homeTitle, locale)?.trim() || null, intro: only(t?.homeIntro, locale)?.trim() || null, tagline: only(t?.tagline, locale)?.trim() || null },
    errors: Object.fromEntries((t?.errorMessages ?? []).flatMap((e) => (e.code && only(e.message, locale)?.trim() ? [[e.code, only(e.message, locale)!.trim()]] : []))),
    ...(phrases.length ? { victoryPhrases: phrases } : {}),
    texts: labels,
  }
}

const skinFor = cache(async (game: GameModule, locale: Locale): Promise<Skin> => {
  const base = baseSkin(game.binding, locale)
  const client = sanityClient(game)
  if (!client) return base
  try {
    const doc = await client.fetch<SkinDoc>(SKIN_QUERY, {}, { next: { tags: [skinTag(game.slug)], revalidate: 60 } })
    return mergeSkin(base, toSkin(game, doc, locale))
  } catch (error) {
    console.error("Sanity skin unavailable", error)
    return base
  }
})

/** Skin of a game in the visitor's language; explicit `locale` for renders that do not depend on the request. */
export const loadSkin = async (game: GameModule, locale?: Locale): Promise<Skin> => skinFor(game, locale ?? (await getLocale()))
