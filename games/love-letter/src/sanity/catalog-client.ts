import "server-only"
import { CHARACTER_KEYS, type CharacterKey } from "@love-letter/engine"
import type { LoaderContext } from "@pbgo/core/lib/binding"
import { type Locale, translate } from "@pbgo/core/lib/i18n"
import { isMissing, missing } from "@pbgo/core/lib/missing"
import { fixedUrlFor, type SanityImageSource } from "@pbgo/core/sanity/image"
import { type ClientCatalog, MISSING_CATALOG } from "../lib/catalog"
import { type Vocabulary, WORD_FIELDS } from "../lib/words"
import { getCatalog } from "./catalog"

const reported = new Set<string>()

/** One line in the server log per text Sanity does not have, once per language: the same report as core's `skinFor`. */
function reportMissing(slug: string, locale: Locale, catalog: ClientCatalog) {
  for (const text of [...Object.values(catalog.words), ...Object.values(catalog.names), ...Object.values(catalog.texts)].filter(isMissing)) {
    const id = `${slug}:${locale}:${text}`
    if (reported.has(id)) continue
    reported.add(id)
    console.error(`[missing] ${slug} (${locale}): ${text.slice("[missing: ".length, -1)} is not in Sanity`)
  }
}

const isCharacterKey = (key: string | null): key is CharacterKey => key !== null && (CHARACTER_KEYS as readonly string[]).includes(key)

/**
 * The catalog given to the board: the face of each character, its name and its card text, the back of the cards and the words of the board, all of it from the game's Sanity project. A picture it does not have is `null` and a text reads `[missing: <key>]`,
 * in the language asked, else English, never another language.
 */
export async function getClientCatalog({ game: module, locale, sanity }: LoaderContext): Promise<ClientCatalog> {
  if (!sanity) return MISSING_CATALOG
  // The faces are WebP files: the image CDN could convert them to another format by what the browser accepts, which a canvas that reads a picture must not depend on, so they are served as they are
  const url = (source: SanityImageSource | null | undefined) => (source ? fixedUrlFor(module, source).url() : null)
  try {
    const { game, texts, characters } = await getCatalog(sanity)

    const faces = { ...MISSING_CATALOG.faces }
    const names = { ...MISSING_CATALOG.names }
    const cardTexts = { ...MISSING_CATALOG.texts }
    for (const character of characters) {
      if (!isCharacterKey(character.key)) continue
      faces[character.key] = url(character.image)
      names[character.key] = translate(character.name, locale)?.trim() || names[character.key]
      cardTexts[character.key] = translate(character.text, locale)?.trim() || cardTexts[character.key]
    }

    const catalog: ClientCatalog = {
      faces,
      names,
      texts: cardTexts,
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
