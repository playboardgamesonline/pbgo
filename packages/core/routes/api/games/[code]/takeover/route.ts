import { canPlayFor, isEngineError, playFor, waitingPlayers } from "@pbgo/engine-kit"
import { after } from "next/server"
import type { GameRouteContext } from "../../../../../lib/binding"
import { loadSettings } from "../../../../../lib/settings-server"
import { trackAfter, trackGameFinished } from "../../../../../server/analytics"
import { ApiError, handle, readJson } from "../../../../../server/api"
import { publicGame, stateFingerprint, updateGame } from "../../../../../server/games"
import { getPlayerId } from "../../../../../server/player"
import { markSeen } from "../../../../../server/presence"
import { rateLimit } from "../../../../../server/rate-limit"
import { TakeoverError, castVotes, isStalled, parseVotes, presentPlayers, sameVotes } from "../../../../../server/takeover"

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

  // What the write of the modifier's last run did: it runs again when it loses a race, so it starts from nothing each time
  const outcome = { started: false, completed: false, played: 0 }
  const row = await updateGame(
    game,
    params.code ?? "",
    (row) => {
      outcome.started = false
      outcome.completed = false
      outcome.played = 0
      if (!id || !row.players.some((p) => p.id === id)) throw new ApiError("UNKNOWN_PLAYER", 403)
      if (row.status !== "playing" || !row.state) throw new ApiError("GAME_NOT_STARTED", 409)
      const now = Date.now()
      if (!isStalled(row.updated_at, now, turnTimeout)) throw new ApiError("NOT_STALLED", 409)
      const waiting = waitingPlayers(GAME, row.state)
      const fingerprint = stateFingerprint(row.state)
      try {
        const { entries, play } = castVotes({
          players: row.players,
          waiting,
          present: presentPlayers(row.players, row.seen, now),
          entries: row.takeover_votes,
          fingerprint,
          voter: id,
          targets: playerIds?.length ? (playerIds as string[]) : waiting,
        })
        if (!play.length) {
          if (sameVotes(entries, row.takeover_votes)) return null
          outcome.started = !parseVotes(row.takeover_votes, fingerprint).length
          return { takeover_votes: entries }
        }
        let state = row.state
        for (const target of play) {
          if (GAME.isOver(state)) break
          if (waitingPlayers(GAME, state).includes(target)) {
            state = playFor(GAME, state, target)
            outcome.played += 1
          }
        }
        // The first vote on this state, and the last one: on a table of two they are the same request
        outcome.started = !parseVotes(row.takeover_votes, fingerprint).length
        outcome.completed = true
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
  if (outcome.started) trackAfter("takeover_vote_started", id, { game: game.slug })
  if (outcome.completed) {
    trackAfter("takeover_completed", id, { game: game.slug })
    // One per player played for: a step owed by several players is played for all of them in the same request
    for (let i = 0; i < outcome.played; i++) trackAfter("turn_auto_played", id, { game: game.slug, reason: "takeover" })
  }
  // The modifier only runs on a table in play, so an `over` table is the one this takeover has just ended
  if (row.status === "over") trackGameFinished(game.slug, row, id)
  return publicGame(game, row, id)
})
