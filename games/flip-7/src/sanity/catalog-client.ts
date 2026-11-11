import "server-only"
import type { LoaderContext } from "@pbgo/core/lib/binding"
import { type Locale, translate } from "@pbgo/core/lib/i18n"
import { isMissing, missing } from "@pbgo/core/lib/missing"
import { fixedUrlFor, type SanityImageSource } from "@pbgo/core/sanity/image"
import { ACTION_KEYS, type ClientCatalog, engineKeyOf, MISSING_CATALOG } from "../lib/catalog"
import { type Vocabulary, WORD_FIELDS } from "../lib/words"
import { getCatalog } from "./catalog"

const reported = new Set<string>()

/** One line in the server log per text Sanity does not have, once per language: the same report as core's `skinFor`. */
function reportMissing(slug: string, locale: Locale, catalog: ClientCatalog) {
  for (const text of [...Object.values(catalog.words), ...Object.values(catalog.names)].filter(isMissing)) {
    const id = `${slug}:${locale}:${text}`
    if (reported.has(id)) continue
    reported.add(id)
    console.error(`[missing] ${slug} (${locale}): ${text.slice("[missing: ".length, -1)} is not in Sanity`)
  }
}

/**
 * The catalog given to the board: the pictures of the cards and of their back, the name of each action card and the words of the board, all of it from the game's Sanity project. A picture it does not have is `null` and a text reads
 * `[missing: <key>]`, in the language asked, else English, never another language.
 */
export async function getClientCatalog({ game: module, locale, sanity }: LoaderContext): Promise<ClientCatalog> {
  if (!sanity) return MISSING_CATALOG
  // The faces are SVG files, which the image CDN cannot convert or resize: they are served as they are
  const url = (source: SanityImageSource | null | undefined) => (source ? fixedUrlFor(module, source).url() : null)
  try {
    const { game, texts, numbers, actions, modifiers } = await getCatalog(sanity)

    const faces = { ...MISSING_CATALOG.faces }
    for (const [type, cards] of [["numberCard", numbers], ["actionCard", actions], ["modifierCard", modifiers]] as const) {
      for (const card of cards) {
        const key = card.key ? engineKeyOf(type, card.key) : null
        if (key && key in faces) faces[key] = url(card.image)
      }
    }
    const names = { ...MISSING_CATALOG.names }
    for (const card of actions) {
      if (card.key && ACTION_KEYS.includes(card.key)) names[card.key] = translate(card.name, locale)?.trim() || names[card.key]!
    }

    const catalog: ClientCatalog = {
      faces,
      names,
      backUrl: url(game?.cardBack),
      words: Object.fromEntries(WORD_FIELDS.map((field) => [field, translate(texts?.[field], locale)?.trim() || missing(field)])) as Vocabulary,
    }
    reportMissing(module.slug, locale, catalog)
    return catalog
  } catch (error) {
    console.error("Sanity catalog unavailable", error)
    return MISSING_CATALOG
  }
}
