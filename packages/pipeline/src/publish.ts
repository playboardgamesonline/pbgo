// What a catalog entry makes public. The skill `platform-catalog-entry` stops at drafts and says, in one sentence of its report, which documents "validate" would publish
// (`Validate publishes 3 documents (game-x, publisher-y, category-z)`); `pnpm game-flow` reads that sentence, shows the owner those ids at the second gate, and checks that
// exactly those documents are published once the skill says it published them.

const PUBLISHED_ID = /^(?:game|expansion|creator|publisher|category)-[a-z0-9]+(?:-[a-z0-9]+)*$/

/** An id that the gate may show for publishing: `game-x`, `publisher-y`. */
export const isPublishedId = (id: string): boolean => PUBLISHED_ID.test(id)

/**
 * The documents that publishing makes public, from the skill's own sentence ("Validate publishes 3 documents (game-x, publisher-y)"). Empty when the sentence is not
 * there or does not add up: the owner is shown these ids, and these are the only ones that may be published, so without them there is no `publish`.
 */
export function publishedIds(report: string): string[] {
  const match = /Validate publishes (\d+) documents?\s*\(([^)]*)\)/i.exec(report)
  if (!match) return []
  const ids = (match[2] ?? "").split(",").map((id) => id.trim()).filter(Boolean)
  return ids.length === Number(match[1]) && new Set(ids).size === ids.length && ids.every(isPublishedId) ? ids : []
}

/** The line of the second gate: what `publish` makes public. */
export function publishLine(report: string): string | null {
  const ids = publishedIds(report)
  return ids.length > 0 ? `publish makes ${ids.length} document${ids.length === 1 ? "" : "s"} public (${ids.join(", ")}): they are on the hub within about eleven minutes.` : null
}
