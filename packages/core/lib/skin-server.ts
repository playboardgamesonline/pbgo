import "server-only"
import * as binding from "@pgo/binding"
import { cache } from "react"
import { client } from "../sanity/client"
import { urlFor } from "../sanity/image"
import { translate, type Localized } from "./i18n"
import { mediaUrl } from "./settings"
import { type DecorImage, DEFAULT_SKIN, mergeSkin, type Skin, type SkinDefaults } from "./skin"

export const SKIN_TAG = "skin"

type ImageRef = (Parameters<typeof urlFor>[0] & { asset?: { _ref?: string }; ratio?: number; mime?: string }) | null | undefined

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

export const SKIN_QUERY = `{
  "interface": *[_id == "interface"][0]{ "background": background${IMG}, "pattern": pattern${IMG}, "decorTop": decorTop${IMG}, "decorBottom": decorBottom${IMG}, "hero": hero${IMG}, "hostIcon": hostIcon${IMG}, playerColors, desktopOnly },
  "texts": *[_id == "texts"][0]{ tagline, homeTitle, homeIntro, victoryPhrases, ui_home, ui_lobby, ui_game, errorMessages }
}`

const has = (i: ImageRef): i is NonNullable<ImageRef> => !!i?.asset?._ref

const image = (i: ImageRef, width: number) => (has(i) ? urlFor(i).width(width).url() : null)

// SVG (pictos, masques) : servi en same-origin, sans redimensionnement
const picto = (i: ImageRef) => (has(i) ? (i.mime === "image/svg+xml" ? mediaUrl(urlFor(i).url()) : mediaUrl(urlFor(i).width(256).url())) : null)

function decor(i: ImageRef): DecorImage | null {
  if (!has(i)) return null
  const full = urlFor(i).width(3000).url()
  return { url: full, srcSet: `${urlFor(i).width(1600).url()} 1600w, ${full} 3000w`, ratio: i.ratio ?? null }
}

const HEX = /^#[0-9a-fA-F]{6}$/

export type { SkinDoc }

export function toSkin(doc: SkinDoc): Partial<SkinDefaults> {
  const ui = doc?.interface
  const t = doc?.texts
  const labels = Object.fromEntries(
    ["ui_home", "ui_lobby", "ui_game"].flatMap((g) => Object.entries((t?.[g] as Record<string, Localized>) ?? {}).map(([k, v]) => [k, translate(v)?.trim()])),
  )
  const colors = (ui?.playerColors ?? []).filter((c) => HEX.test(c))
  const phrases = (translate(t?.victoryPhrases) ?? []).filter((p) => p.trim())
  return {
    decor: {
      background: image(ui?.background, 2400),
      pattern: image(ui?.pattern, 512),
      top: decor(ui?.decorTop),
      bottom: decor(ui?.decorBottom),
      hero: image(ui?.hero, 1400),
    },
    hostIcon: picto(ui?.hostIcon),
    ...(colors.length ? { playerColors: colors } : {}),
    ...(typeof ui?.desktopOnly === "boolean" ? { desktopOnly: ui.desktopOnly } : {}),
    home: { title: translate(t?.homeTitle)?.trim() || null, intro: translate(t?.homeIntro)?.trim() || null, tagline: translate(t?.tagline)?.trim() || null },
    errors: Object.fromEntries((t?.errorMessages ?? []).flatMap((e) => (e.code && translate(e.message)?.trim() ? [[e.code, translate(e.message)!.trim()]] : []))),
    ...(phrases.length ? { victoryPhrases: phrases } : {}),
    texts: labels,
  }
}

/** Valeurs par défaut propres au jeu (images locales de /public, libellés…) : export facultatif `DEFAULT_SKIN` de @pgo/binding. */
const gameDefaults = (binding as { DEFAULT_SKIN?: SkinDefaults }).DEFAULT_SKIN

export const loadSkin = cache(async (): Promise<Skin> => {
  const base = mergeSkin(DEFAULT_SKIN, gameDefaults)
  if (!client) return base
  try {
    const doc = await client.fetch<SkinDoc>(SKIN_QUERY, {}, { next: { tags: [SKIN_TAG], revalidate: 60 } })
    return mergeSkin(base, toSkin(doc))
  } catch {
    return base
  }
})
