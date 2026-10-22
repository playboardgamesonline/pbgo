import { EngineError, type PlayerInfo, createSaveableRng, issueIds, normalizeOptions, randomSeed, shuffle, sideSeed } from "@pbgo/engine-kit"
import { CATALOGUE } from "./catalogue"
import { close, open } from "./machine"
import { OPTIONS } from "./options"
import { startRound } from "./round"
import type { State, Status } from "./types"

/**
 * The booklet says "3+ players" and recommends a second deck past 18, which this engine does not have. The web edition seats 3 to 8: a line
 * of cards per seat has to stay readable on one screen.
 */
export const MIN_PLAYERS = 3
export const MAX_PLAYERS = 8

/** Salt of the stream of the card ids (see `sideSeed`): it never moves the stream of the shuffles. */
const IDS_STREAM = 1

/**
 * A new game: the 94 cards are shuffled, a random player is the first dealer, and the first round is dealt (the dealer deals, and the
 * round goes on until the game needs a player). Everything comes from `seed` (drawn when missing): the same seed and the same options
 * deal the same game.
 */
export function setupGame(args: { players: readonly PlayerInfo[]; options?: unknown; seed?: number }): State {
  const { players } = args
  const seats = Array.isArray(players) ? players.map((player) => player?.id) : []
  if (
    seats.length < MIN_PLAYERS ||
    seats.length > MAX_PLAYERS ||
    seats.some((id) => typeof id !== "string" || id === "") ||
    new Set(seats).size !== seats.length
  ) {
    throw new EngineError("INVALID_PLAYERS", `A table is ${MIN_PLAYERS} to ${MAX_PLAYERS} different players`)
  }
  const n = seats.length
  const options = normalizeOptions(OPTIONS, args.options, { playerCount: n })
  const seed = args.seed ?? randomSeed()
  const rng = createSaveableRng(seed)
  const idsRng = createSaveableRng(sideSeed(seed, IDS_STREAM))

  const ids = issueIds(CATALOGUE.length, idsRng)
  const deck = shuffle(ids, rng)
  const dealer = Math.floor(rng() * n)

  const state: State = {
    options,
    seats: seats as string[],
    ids,
    rng: rng.save(),
    deck,
    discard: [],
    dealer,
    lines: seats.map(() => []),
    status: seats.map((): Status => "active"),
    stack: [],
    rounds: [],
    stats: seats.map(() => ({ busts: 0, flip7: 0 })),
  }
  const ctx = open(state)
  startRound(ctx)
  return close(ctx).state
}
