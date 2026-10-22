import "server-only"
import type { LoaderContext } from "@pbgo/core/lib/binding"
import { type Locale, type Localized, only } from "@pbgo/core/lib/i18n"
import { isMissing, missing } from "@pbgo/core/lib/missing"
import { type SanityImageSource, urlFor } from "@pbgo/core/sanity/image"
import { type CardCategory, type ClientCatalog, faceTypeOf, MISSING_CATALOG, type Vocabulary, WORD_FIELDS } from "../lib/catalog"
import { getCatalog } from "./catalog"

const reported = new Set<string>()

/** One line in the server log per text Sanity does not have, once per language: the same report as core's `skinFor`. */
function reportMissing(slug: string, locale: Locale, catalog: ClientCatalog) {
  for (const text of Object.values(catalog.words).filter(isMissing)) {
    const id = `${slug}:${locale}:${text}`
    if (reported.has(id)) continue
    reported.add(id)
    console.error(`[missing] ${slug} (${locale}): ${text.slice("[missing: ".length, -1)} is not in Sanity`)
  }
}

/** Catalog given to the board (the faces, the table, the words). Every picture and every text comes from Sanity: `null` for a picture it does not have, `[missing: <key>]` for a word. */
export async function getClientCatalog({ game: module, locale, sanity }: LoaderContext): Promise<ClientCatalog> {
  if (!sanity) return MISSING_CATALOG
  // An SVG cannot be resized by the CDN (transformation parameters → 400 errors): the file is served as is.
  const isSvg = (source: SanityImageSource) => JSON.stringify(source).includes("-svg")
  const url = (source: SanityImageSource | null | undefined, width: number) =>
    source ? (isSvg(source) ? urlFor(module, source).url() : urlFor(module, source).width(width).url()) : null
  try {
    const { game, texts, numberCards, actionCards, modifierCards } = await getCatalog(sanity)

    const faces: ClientCatalog["faces"] = {}
    const file = (category: CardCategory, cards: { key: string | null; image: SanityImageSource | null; name?: Localized }[]) => {
      for (const card of cards) {
        if (!card.key) continue
        faces[faceTypeOf(category, card.key)] = { name: only(card.name, locale)?.trim() || null, imageUrl: url(card.image, 360) }
      }
    }
    file("number", numberCards)
    file("action", actionCards)
    file("modifier", modifierCards)

    const catalog: ClientCatalog = {
      words: Object.fromEntries(WORD_FIELDS.map((field) => [field, only(texts?.[field], locale)?.trim() || missing(field)])) as Vocabulary,
      faces,
      matUrl: url(game?.mat, 2000),
      cardBackUrl: url(game?.cardBack, 360),
    }
    reportMissing(module.slug, locale, catalog)
    return catalog
  } catch (error) {
    console.error("Sanity catalog unavailable", error)
    return MISSING_CATALOG
  }
}
