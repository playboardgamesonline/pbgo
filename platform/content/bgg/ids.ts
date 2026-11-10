import type { BggClient } from "./client.ts"
import type { GameFigures, Plan } from "./figures.ts"
import type { BggCandidate } from "./xml.ts"

// PLT-78: a BGG id for the games that have none or a wrong one. BGG is searched by the name of each game and the results are only said: an id decides which game the BGG button
// leads to and which figures are proposed, and a name like "Trio" or "Odin" is more than one game, so the owner picks (the `BGG ID` field of the game in the Studio). Nothing is written.

export type IdCandidates = { id: string; slug: string; name: string; /** `no-id`: the game has none · `mismatch`: the one it has is another item or another game */ why: "no-id" | "mismatch"; candidates: BggCandidate[]; exact: BggCandidate[] }

/** A name as one compares two: no accent, no case, letters and digits in words. */
const plain = (name: string): string =>
  name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()

/** How many results are said for each game. */
export const CANDIDATES_SHOWN = 4

/** The games a plan found without a BGG id or with a wrong one, and that have a name to search for. */
export const needingAnId = (plan: Plan): GameFigures[] => plan.games.filter((game) => (game.status === "no-id" || game.status === "mismatch") && game.name !== "")

/** The BGG results for each of these games: the exact name first (`exact`), else the nearest results. */
export async function findIds(games: readonly GameFigures[], client: Pick<BggClient, "search">): Promise<IdCandidates[]> {
  const found: IdCandidates[] = []
  for (const game of games) {
    const exact = await client.search(game.name, { exact: true })
    const candidates = exact.length > 0 ? exact : await client.search(game.name)
    found.push({
      id: game.id,
      slug: game.slug,
      name: game.name,
      why: game.status === "mismatch" ? "mismatch" : "no-id",
      candidates: candidates.slice(0, CANDIDATES_SHOWN),
      exact: candidates.filter((candidate) => plain(candidate.name) === plain(game.name)),
    })
  }
  return found
}

/** The results in words: one line per game, an id that matches the name exactly marked. */
export function describeCandidates(found: readonly IdCandidates[]): string {
  if (found.length === 0) return "Every game has a BGG id that matches it."
  const lines = [`BGG ids to pick for ${found.length} games (nothing is written; set the BGG ID of the game in the Studio):`, ""]
  for (const game of found) {
    const why = game.why === "mismatch" ? " · its BGG id is wrong" : ""
    if (game.candidates.length === 0) {
      lines.push(`  ${game.slug} ("${game.name}")${why}: no result`)
      continue
    }
    const unique = game.exact.length === 1
    lines.push(`  ${game.slug} ("${game.name}")${why}${unique ? ` · one result has exactly this name: ${game.exact[0]!.id}` : ""}`)
    for (const candidate of game.candidates) lines.push(`      ${candidate.id}  ${candidate.name}${candidate.year ? ` (${candidate.year})` : ""}`)
  }
  return lines.join("\n")
}

/**
 * The ids to propose: for each game, the one result that has exactly its name, when there is only one. A name that several BGG games bear ("Trio", "Rummy") is left to the
 * owner. The year is no help: the Studio holds a release date for few games.
 */
export function pickIds(found: readonly IdCandidates[]): Map<string, number> {
  const picked = new Map<string, number>()
  for (const game of found) if (game.exact.length === 1) picked.set(game.id, game.exact[0]!.id)
  return picked
}
