// What the games a visitor played say of them: the figures of their profile. Pure, so that the pages that draw them (and the day the games come from the
// database, PLT-13) and the tests all read them the same way.

/** A game a visitor played, or is playing. */
export type PlayedGame = {
  id: string
  /** The slug of the game: its page on the hub is `/game/<slug>`, its picture comes from the catalog's route. */
  slug: string
  name: string
  /** When it started (an ISO date). */
  playedAt: string
  /** The code of the table. */
  table: string
  /** The others at the table. */
  opponents: readonly { nickname: string; avatarUrl?: string | null }[]
  state: "in-progress" | "finished"
  /** How it ended for the visitor, once it has. */
  result?: "won" | "lost" | "draw"
  /** Their rank at the end, among `opponents.length + 1` players. */
  rank?: number
}

/** The games that are over. */
const finishedOf = (games: readonly PlayedGame[]): PlayedGame[] => games.filter((game) => game.state === "finished")

/**
 * The figures of the profile, from the games that are over (a game in progress counts for nothing yet): how many were played, how many won, the share of
 * wins in whole percent, and the game played the most (the first by name when two are tied). `null` where there is nothing to say.
 */
export function statsOf(games: readonly PlayedGame[]): { played: number; wins: number; winRate: number | null; favourite: string | null } {
  const finished = finishedOf(games)
  const wins = finished.filter((game) => game.result === "won").length
  const counts = new Map<string, number>()
  for (const game of finished) counts.set(game.name, (counts.get(game.name) ?? 0) + 1)
  const favourite = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0] ?? null
  return { played: finished.length, wins, winRate: finished.length > 0 ? Math.round((wins / finished.length) * 100) : null, favourite }
}

/** The games a visitor has finished, one row per game: how many, how many won, the most played first (then by name). */
export function perGame(games: readonly PlayedGame[]): { slug: string; name: string; played: number; wins: number }[] {
  const rows = new Map<string, { slug: string; name: string; played: number; wins: number }>()
  for (const game of finishedOf(games)) {
    const row = rows.get(game.slug) ?? { slug: game.slug, name: game.name, played: 0, wins: 0 }
    row.played += 1
    if (game.result === "won") row.wins += 1
    rows.set(game.slug, row)
  }
  return [...rows.values()].sort((a, b) => b.played - a.played || a.name.localeCompare(b.name))
}

const ORDINALS = new Intl.PluralRules("en", { type: "ordinal" })

/** A rank in words: 1st, 2nd, 3rd, 4th … 11th, 12th, 13th, 21st. */
export function ordinal(rank: number): string {
  const rule = ORDINALS.select(rank)
  return `${rank}${rule === "one" ? "st" : rule === "two" ? "nd" : rule === "few" ? "rd" : "th"}`
}
