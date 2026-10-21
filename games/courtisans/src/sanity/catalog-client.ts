import "server-only"
import type { Family, Role } from "@courtisans/engine"
import type { LoaderContext } from "@pbgo/core/lib/binding"
import { type Locale, LOCALES, only } from "@pbgo/core/lib/i18n"
import { isMissing, missing } from "@pbgo/core/lib/missing"
import { type SanityImageSource, urlFor } from "@pbgo/core/sanity/image"
import { cardKey, type ClientCatalog, MISSING_CATALOG, type Vocabulary, WORD_FIELDS } from "../lib/catalog"
import { getCatalog } from "./catalog"

const reported = new Set<string>()

/** One line in the server log per text Sanity does not have, once per language: the same report as core's `skinFor`. */
function reportMissing(slug: string, locale: Locale, catalog: ClientCatalog) {
  const texts = [
    catalog.missionsButtonText,
    catalog.banquetStartText,
    ...Object.values(catalog.words),
    ...Object.values(catalog.families).map((family) => family.name),
    ...Object.values(catalog.roles).map((role) => role.name),
    ...(catalog.statusWords.light.length ? [] : [missing("statusLight")]),
    ...(catalog.statusWords.disgrace.length ? [] : [missing("statusDisgrace")]),
  ]
  for (const text of texts.filter(isMissing)) {
    const id = `${slug}:${locale}:${text}`
    if (reported.has(id)) continue
    reported.add(id)
    console.error(`[missing] ${slug} (${locale}): ${text.slice("[missing: ".length, -1)} is not in Sanity`)
  }
}

/** Catalog given to the board (card images, families, roles, game texts). Every picture and every text comes from Sanity: `null` for a picture it does not have, `[missing: <key>]` for a text. */
export async function getClientCatalog({ game: module, locale, sanity }: LoaderContext): Promise<ClientCatalog> {
  const d = MISSING_CATALOG
  if (!sanity) return d
  // An SVG cannot be resized by the CDN (transformation parameters → 400 errors): the file is served as is.
  const isSvg = (source: SanityImageSource) => JSON.stringify(source).includes("-svg")
  const url = (source: SanityImageSource | null | undefined, width: number) =>
    source ? (isSvg(source) ? urlFor(module, source).url() : urlFor(module, source).width(width).url()) : null
  try {
    const { game, texts, families, roles, courtiers, missions } = await getCatalog(sanity)

    const familiesMap = { ...d.families }
    for (const f of families) {
      const key = f.key as Family | undefined
      if (!key || !familiesMap[key]) continue
      familiesMap[key] = {
        ...familiesMap[key],
        name: only(f.name, locale) ?? familiesMap[key].name,
        color: f.color ?? familiesMap[key].color,
        pictogramUrl: url(f.pictogram, 128),
      }
    }
    const rolesMap = { ...d.roles }
    for (const r of roles) {
      const key = r.key as Role | undefined
      if (!key || !rolesMap[key]) continue
      rolesMap[key] = { ...rolesMap[key], name: only(r.name, locale) ?? rolesMap[key].name, pictogramUrl: url(r.pictogram, 128) }
    }

    const cards: Record<string, string> = { ...d.cards }
    for (const c of courtiers) {
      const imageUrl = url(c.card, 360)
      if (c.family && imageUrl) cards[cardKey(c.family as Family, (c.role as Role | null) ?? null)] = imageUrl
    }
    const missionsMap: Record<string, string> = { ...d.missions }
    for (const m of missions) {
      const imageUrl = url(m.card, 520)
      if (imageUrl) missionsMap[m._id] = imageUrl
    }

    const catalog: ClientCatalog = {
      families: familiesMap,
      roles: rolesMap,
      cards,
      missions: missionsMap,
      matUrl: url(game?.mat, 2000),
      clothUrl: url(game?.matTexture, 1024),
      courtierBackUrl: url(game?.courtierBack, 360),
      whiteMissionBackUrl: url(game?.whiteMissionBack, 520),
      blueMissionBackUrl: url(game?.blueMissionBack, 520),
      arrowUpUrl: url(game?.arrowUp, 256),
      arrowDownUrl: url(game?.arrowDown, 256),
      missionTexts: Object.fromEntries(missions.flatMap((m) => (only(m.text, locale)?.trim() ? [[m._id, only(m.text, locale)!.trim()]] : []))),
      missionsButtonText: only(texts?.missionsButton, locale)?.trim() || d.missionsButtonText,
      banquetStartText: only(texts?.banquetStarts, locale)?.trim() || d.banquetStartText,
      words: Object.fromEntries(WORD_FIELDS.map((field) => [field, only(texts?.[field], locale)?.trim() || missing(field)])) as Vocabulary,
      // Mission texts name a status in whatever wording their author chose, in any language: the union of the languages is highlighted
      statusWords: {
        light: LOCALES.flatMap((l) => texts?.statusLight?.[l] ?? []),
        disgrace: LOCALES.flatMap((l) => texts?.statusDisgrace?.[l] ?? []),
      },
    }
    reportMissing(module.slug, locale, catalog)
    return catalog
  } catch (error) {
    console.error("Sanity catalog unavailable", error)
    return d
  }
}
