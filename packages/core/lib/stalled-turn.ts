import type { PublicGame, TakeoverStatus } from "./game-types"

/** What the viewer can do about the players the game waits for (`StalledTurn`). */
export type ViewerTakeover = {
  /** The players the game waits for and that the viewer takes part in playing for: one of the voters required for them (never themself) */
  targets: TakeoverStatus[]
  /** Their ids, sent with the vote */
  ids: string[]
  /** The viewer has voted for every one of them */
  voted: boolean
  /** Everyone required has voted and the game still did not move: a voter has left since (the server only plays when a vote comes in) */
  complete: boolean
}

/**
 * The viewer is `meId`, the player the table knows, and not the `me` of the game's view: a view is the game's to shape, and a game may give
 * none to a player who is out, who stays a voter while they are present.
 */
export function viewerTakeover({ meId, status, takeovers }: Pick<PublicGame, "meId" | "status" | "takeovers">): ViewerTakeover {
  const targets = meId && status === "playing" ? (takeovers ?? []).filter((target) => target.voters.includes(meId)) : []
  const voted = !!meId && targets.length > 0 && targets.every((target) => target.votes.includes(meId))
  const complete = voted && targets.every((target) => target.votes.length >= target.voters.length)
  return { targets, ids: targets.map((target) => target.playerId), voted, complete }
}
