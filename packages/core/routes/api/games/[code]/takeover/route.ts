import { canPlayFor, isEngineError, playFor, waitingPlayers } from "@pbgo/engine-kit"
import { after } from "next/server"
import type { GameRouteContext } from "../../../../../lib/binding"
import { loadSettings } from "../../../../../lib/settings-server"
import { ApiError, handle, readJson } from "../../../../../server/api"
import { publicGame, stateFingerprint, updateGame } from "../../../../../server/games"
import { getPlayerId } from "../../../../../server/player"
import { markSeen } from "../../../../../server/presence"
import { rateLimit } from "../../../../../server/rate-limit"
import { TakeoverError, castVotes, isStalled, presentPlayers, sameVotes } from "../../../../../server/takeover"

/**
 * Plays for the players the game waits for and who don't play. The caller votes for the players they want to play for
 * (`playerIds`, by default every player the game waits for); a player is played for, with `GAME.autoPlayFor`, as soon as every
 * present member other than them has voted for them: an absent member never blocks (see `server/takeover.ts`). Only when the
 * game has not moved for the delay set in the admin. Voting again changes nothing, but completes a vote left unfinished by a
 * voter who has left since.
 *
 * Several targets are played for in the same write, in the order the game waits for them.
 */
export const POST = handle(async (request: Request, { game, params }: GameRouteContext) => {
  await rateLimit(game.slug, request, "vote")
  const { GAME } = game.binding
  if (!canPlayFor(GAME)) throw new ApiError("TAKEOVER_UNSUPPORTED", 400)
  const id = await getPlayerId(game.slug)
  const { playerIds } = await readJson<{ playerIds?: unknown }>(request)
  if (playerIds !== undefined && (!Array.isArray(playerIds) || !playerIds.every((p) => typeof p === "string"))) throw new ApiError("INVALID_REQUEST")
  const { turnTimeout } = await loadSettings(game)

  const row = await updateGame(
    game,
    params.code ?? "",
    (row) => {
      if (!id || !row.players.some((p) => p.id === id)) throw new ApiError("UNKNOWN_PLAYER", 403)
      if (row.status !== "playing" || !row.state) throw new ApiError("GAME_NOT_STARTED", 409)
      const now = Date.now()
      if (!isStalled(row.updated_at, now, turnTimeout)) throw new ApiError("NOT_STALLED", 409)
      const waiting = waitingPlayers(GAME, row.state)
      try {
        const { entries, play } = castVotes({
          players: row.players,
          waiting,
          present: presentPlayers(row.players, row.seen, now),
          entries: row.takeover_votes,
          fingerprint: stateFingerprint(row.state),
          voter: id,
          targets: playerIds?.length ? (playerIds as string[]) : waiting,
        })
        if (!play.length) return sameVotes(entries, row.takeover_votes) ? null : { takeover_votes: entries }
        let state = row.state
        for (const target of play) {
          if (GAME.isOver(state)) break
          if (waitingPlayers(GAME, state).includes(target)) state = playFor(GAME, state, target)
        }
        return { state, status: GAME.isOver(state) ? "over" : "playing", takeover_votes: [] }
      } catch (error) {
        if (error instanceof TakeoverError) throw new ApiError(error.code, error.code === "UNKNOWN_PLAYER" ? 403 : 409)
        if (isEngineError(error) && error.code === "NOT_WAITING") throw new ApiError("NOT_WAITING", 409)
        throw error
      }
    },
    { quiet: true },
  )
  after(() => markSeen(game, row, id))
  return publicGame(game, row, id)
})
