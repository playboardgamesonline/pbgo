import { slugFromName } from "@pbgo/games/slug"

// The id of a document is made of what it is called, so that the seed finds the same document again (a seed id has letters, digits,
// "-" and "_" only). A person, a company or a category has no slug in the Notion rows: its name makes one, accents and capitals gone.

const idOf = (type: string, name: string): string => {
  const slug = slugFromName(name)
  if (!slug) throw new Error(`"${name}" has no letter or digit to make the id of a ${type} from`)
  return `${type}-${slug}`
}

export const gameId = (slug: string): string => `game-${slug}`
export const creatorId = (name: string): string => idOf("creator", name)
export const publisherId = (name: string): string => idOf("publisher", name)
export const categoryId = (name: string): string => idOf("category", name)

/** A reference to a document, as a field holds it. */
export const reference = (id: string): { _type: "reference"; _ref: string } => ({ _type: "reference", _ref: id })

/**
 * A reference that is an item of a list: it needs a `_key`, and the id it points at is one that no other item of the list has. A weak
 * reference (`_weak`) does not wait for the document it points at to be published, and does not keep it from being deleted.
 */
export const item = (id: string, weak = false): { _key: string; _type: "reference"; _ref: string; _weak?: true } => ({ _key: id, ...reference(id), ...(weak ? { _weak: true as const } : {}) })
