import type { PublicPlayer } from "./game-types"

/**
 * Where the vote for another game stands at a table that is over, as the end screen draws it (`POST …/replay`: every player who is still there has to agree, and the game begins with the last word). A player who left the table is no
 * longer asked, the rematch is played by those who stayed. Pure, so that the screen, the toasts and the tests read the votes the same way.
 */
export type Rematch = {
  /** The players still at the table who agreed, in seat order. */
  agreed: PublicPlayer[]
  /** The players still at the table who have not answered, in seat order. */
  waiting: PublicPlayer[]
  /** The players who left the table since the game ended, in seat order. */
  left: PublicPlayer[]
  /** The visitor agreed already. */
  mine: boolean
  /** Enough players are left for another game (the game's least). */
  enough: boolean
}

export function rematchOf(players: readonly PublicPlayer[], replay: readonly string[], meId: string | null, minPlayers: number): Rematch {
  const here = players.filter((player) => !player.left)
  return {
    agreed: here.filter((player) => replay.includes(player.id)),
    waiting: here.filter((player) => !replay.includes(player.id)),
    left: players.filter((player) => player.left),
    mine: meId !== null && replay.includes(meId),
    enough: here.length >= minPlayers,
  }
}

/** Names in a sentence: "Ann", "Ann and Bob", "Ann, Bob and Cy". */
export function nameList(names: readonly string[]): string {
  if (names.length <= 1) return names[0] ?? ""
  return `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`
}

/**
 * What the end screen says of the vote, under its buttons: who asked for another game when the visitor has not, whom the table waits for once they have, and who left. Null when there is nothing to say (nobody voted, or everybody did and
 * the game is about to begin).
 */
export function rematchLine({ agreed, waiting, left, mine, enough }: Rematch): string | null {
  const lines: string[] = []
  if (!enough) lines.push("Not enough players are left for another game.")
  else if (mine) {
    if (waiting.length > 0) lines.push(`Waiting for ${nameList(waiting.map((player) => player.nickname))}.`)
  } else if (agreed.length > 0) lines.push(`${nameList(agreed.map((player) => player.nickname))} ${agreed.length === 1 ? "wants" : "want"} a rematch.`)
  if (left.length > 0) lines.push(`${nameList(left.map((player) => player.nickname))} left the table.`)
  return lines.length > 0 ? lines.join(" ") : null
}

/** What a tab remembers of the votes it read, for as long as the end screen is open: null until the first read. */
export type RematchWatch = ReadonlySet<string> | null

/**
 * Reads the votes and says whom to tell about: the players who asked for another game since the last read, never the visitor. The first read tells nothing, since what the table already voted is what the screen shows, and a vote is never told
 * twice. Returns what to remember from now on.
 */
export function watchRematch(seen: RematchWatch, replay: readonly string[], meId: string | null): { tell: string[]; seen: ReadonlySet<string> } {
  const now = new Set(replay)
  if (seen === null) return { tell: [], seen: now }
  return { tell: replay.filter((id) => !seen.has(id) && id !== meId), seen: new Set([...seen, ...now]) }
}

/** The id of the toast of a request for a rematch: one for each player, so that a toast raised again is the same one and not another. */
export const rematchToastId = (code: string, playerId: string): string => `rematch:${code}:${playerId}`
