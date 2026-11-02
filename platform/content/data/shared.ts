import { LANGUAGES } from "@pbgo/studio-kit/constants"
import type { CreatorRole } from "../../apps/studio/schemaTypes/constants.ts"
import type { NotionGame } from "../notion/types.ts"
import { creatorId, item, publisherId, reference } from "./ids.ts"

// What a game and an expansion take from a row of the Notion Games database in the same way: the figures, the credits, the English
// description and the links to the rules. The two types have these fields alike in the Studio (`model.test.ts` keeps them so).

/** The roles Notion tells of: the people of its Designers column are designers, those of its Artists column artists, and a person can be both. */
export function creditsOf(row: Pick<NotionGame, "authors" | "illustrators">): { creator: string; roles: CreatorRole[] }[] {
  const lines = new Map<string, CreatorRole[]>()
  const add = (names: readonly string[], role: CreatorRole) => {
    for (const name of names) {
      const id = creatorId(name)
      const roles = lines.get(id) ?? []
      if (!roles.includes(role)) roles.push(role)
      lines.set(id, roles)
    }
  }
  add(row.authors, "designer")
  add(row.illustrators, "artist")
  return [...lines].map(([creator, roles]) => ({ creator, roles }))
}

/** The columns of a row that a game and an expansion both read. */
export type SharedColumns = Pick<NotionGame, "bggId" | "players" | "duration" | "age" | "releaseDate" | "authors" | "illustrators" | "publishers" | "descriptions" | "rules">

/**
 * The fields a game and an expansion have in common, as the seed writes them. A field the row leaves empty is left out (the seed fills
 * gaps, and never writes an empty value). The texts are the English ones, the translation system comes later; the links to the rules are
 * the only thing in the four languages.
 */
export function sharedFields(row: SharedColumns): Record<string, unknown> {
  const fields: Record<string, unknown> = {}
  if (row.bggId !== null) fields.bggId = row.bggId
  if (row.players) {
    fields.playersMin = row.players.min
    if (row.players.max !== null) fields.playersMax = row.players.max
  }
  if (row.duration !== null) fields.duration = row.duration
  if (row.age !== null) fields.minAge = row.age
  if (row.releaseDate !== null) fields.releaseDate = row.releaseDate

  const credits = creditsOf(row)
  if (credits.length > 0) fields.creators = credits.map(({ creator, roles }) => ({ _key: creator, _type: "gameCreator", creator: reference(creator, "creator"), roles }))
  if (row.publishers.length > 0) fields.publishers = row.publishers.map(({ name }) => item(publisherId(name), "publisher"))

  if (row.descriptions.en) fields.description = row.descriptions.en
  for (const { id } of LANGUAGES) {
    const link = row.rules[id]
    if (link) fields[`rules${id.charAt(0).toUpperCase()}${id.slice(1)}`] = link
  }
  return fields
}
