import type { SeedDoc } from "@pbgo/content-kit"
import type { NotionGame } from "../notion/types.ts"
import { categoryId, creatorId, publisherId } from "./ids.ts"

// What the games point at: the people credited on them, the companies that publish them and their categories. One document each, made
// from the names the games carry, in the order they are first met. A name nobody's game carries is not seeded.

/** The distinct names, by the id they make: two names that make one id are a mistake to fix at the source, not to merge. */
function distinct(names: Iterable<string>, idOf: (name: string) => string, what: string): Map<string, string> {
  const found = new Map<string, string>()
  for (const name of names) {
    const id = idOf(name)
    const known = found.get(id)
    if (known !== undefined && known !== name) throw new Error(`The ${what} "${known}" and "${name}" make the same id "${id}": rename one of them in Notion`)
    found.set(id, name)
  }
  return found
}

/** Every person credited on a game, as a designer or as an artist. */
export const creatorNames = (games: readonly NotionGame[]): Map<string, string> =>
  distinct(games.flatMap((game) => [...game.authors, ...game.illustrators]), creatorId, "person")

/** Every publisher a game lists, with its website: the first one a game gives, when games give different ones. */
export function publishers(games: readonly NotionGame[]): Map<string, { name: string; url: string | null }> {
  const names = distinct(games.flatMap((game) => game.publishers.map((publisher) => publisher.name)), publisherId, "publisher")
  const found = new Map<string, { name: string; url: string | null }>()
  for (const [id, name] of names) found.set(id, { name, url: null })
  for (const game of games) {
    for (const { name, url } of game.publishers) {
      const entry = found.get(publisherId(name))
      if (entry && entry.url === null) entry.url = url
    }
  }
  return found
}

/** Every category a game lists. */
export const categoryNames = (games: readonly NotionGame[]): Map<string, string> => distinct(games.flatMap((game) => game.categories), categoryId, "category")

export const buildCreators = (games: readonly NotionGame[]): SeedDoc[] => [...creatorNames(games)].map(([id, name]) => ({ _id: id, _type: "creator", name }))

export const buildPublishers = (games: readonly NotionGame[]): SeedDoc[] =>
  [...publishers(games)].map(([id, { name, url }]) => ({ _id: id, _type: "publisher", name, ...(url ? { website: url } : {}) }))

export const buildCategories = (games: readonly NotionGame[]): SeedDoc[] => [...categoryNames(games)].map(([id, name]) => ({ _id: id, _type: "category", name }))
