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

/** The types of document a reference of the seed points at. */
export type Target = "game" | "creator" | "publisher" | "category"

/**
 * A reference as the Studio writes it into a draft whose target is not published yet: weak, because the dataset refuses a strong reference
 * to a document that is not published, a draft's own included, and marked `_strengthenOnPublish` so that the Studio makes it strong when
 * the draft is published (which then needs the target published first). A field that is weak for good (`weak: true` in its schema,
 * `related`) says so in the mark and stays weak.
 */
export const reference = (id: string, type: Target, weak = false): { _type: "reference"; _ref: string; _weak: true; _strengthenOnPublish: { type: Target; weak?: true } } => ({
  _type: "reference",
  _ref: id,
  _weak: true,
  _strengthenOnPublish: weak ? { type, weak: true } : { type },
})

/** A reference that is an item of a list: it needs a `_key`, and the id it points at is one that no other item of the list has. */
export const item = (id: string, type: Target, weak = false) => ({ _key: id, ...reference(id, type, weak) })
