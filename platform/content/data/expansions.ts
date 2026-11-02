import type { SeedDoc } from "@pbgo/content-kit"
import type { NotionExpansion, NotionGame } from "../notion/types.ts"
import { expansionId, gameId, reference } from "./ids.ts"
import { sharedFields } from "./shared.ts"

/**
 * The expansion documents, in the order they are given. An expansion points at the game it is played with by a reference like the Studio
 * writes one into a draft whose target is not published (weak, marked to be made strong on publication; the field is a strong reference
 * in the schema, so the mark does not say `weak`): the game has to be published before its expansions. It has the figures, the credits,
 * the description and the links to the rules of a game, and none of what places a game on the hub (kind, order, categories, complexity,
 * related). A field the row leaves empty is left out. A base game that is not a game of the catalog is left out too, as for a
 * reimplementation: the Studio asks for it, since an expansion cannot be published without one.
 * Two expansions of one slug stop the seed: they would be one document.
 */
export function buildExpansions(expansions: readonly NotionExpansion[], games: readonly NotionGame[]): SeedDoc[] {
  const known = new Set(games.map((game) => game.slug))
  const taken = new Map<string, string>()

  return expansions.map((expansion) => {
    const id = expansionId(expansion.slug)
    const other = taken.get(id)
    if (other !== undefined) throw new Error(`The expansions "${other}" and "${expansion.name}" have the same slug "${expansion.slug}": settle it in Notion`)
    taken.set(id, expansion.name)

    const doc: SeedDoc = { _id: id, _type: "expansion", name: expansion.name, slug: { _type: "slug", current: expansion.slug } }
    if (known.has(expansion.base)) doc.baseGame = reference(gameId(expansion.base), "game")
    return Object.assign(doc, sharedFields(expansion))
  })
}
