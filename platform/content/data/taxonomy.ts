import type { SeedDoc } from "@pbgo/content-kit"
import type { NotionGame } from "../notion/types.ts"
import { categoryId, creatorId, publisherId } from "./ids.ts"

// What the games and the expansions point at: the people credited on them, the companies that publish them and the categories of the
// games. One document each, made from the names they carry, in the order they are first met. A name nobody's game or expansion carries is
// not seeded. The functions take whatever carries the names (a game, an expansion), the games first when both are given.

/** What carries the people of the credits: a game, an expansion. */
type Credited = Pick<NotionGame, "authors" | "illustrators">
/** What carries the publishers: a game, an expansion. */
type Published = Pick<NotionGame, "publishers">

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

/** Every person credited on a game or an expansion, as a designer or as an artist. */
export const creatorNames = (games: readonly Credited[]): Map<string, string> =>
  distinct(games.flatMap((game) => [...game.authors, ...game.illustrators]), creatorId, "person")

/** Every publisher a game or an expansion lists, with its website: the first one it gives, when they give different ones. */
export function publishers(games: readonly Published[]): Map<string, { name: string; url: string | null }> {
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

export const buildCreators = (games: readonly Credited[]): SeedDoc[] => [...creatorNames(games)].map(([id, name]) => ({ _id: id, _type: "creator", name }))

export const buildPublishers = (games: readonly Published[]): SeedDoc[] =>
  [...publishers(games)].map(([id, { name, url }]) => ({ _id: id, _type: "publisher", name, ...(url ? { website: url } : {}) }))

export const buildCategories = (games: readonly NotionGame[]): SeedDoc[] => [...categoryNames(games)].map(([id, name]) => ({ _id: id, _type: "category", name }))
