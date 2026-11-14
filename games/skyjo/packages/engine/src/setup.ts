import { EngineError, type PlayerInfo, createSaveableRng, issueIds, normalizeOptions, randomSeed, sideSeed } from "@pbgo/engine-kit"
import { CATALOGUE } from "./catalogue"
import { close, open } from "./machine"
import { OPTIONS } from "./options"
import { startRound } from "./round"
import type { SkyjoStep, State } from "./types"

/**
 * The rulebook does not say how many play. Skyjo is sold for 2 to 8 players, and 8 grids of 12 cards and the discard (97 cards) leave 53 in the pile of the 150.
 */
export const MIN_PLAYERS = 2
export const MAX_PLAYERS = 8

/** Salt of the stream of the card ids (see `sideSeed`): it never moves the stream of the shuffles. */
const IDS_STREAM = 1

/**
 * A new game, and what happened while it was set up: the 150 cards are shuffled, a random player is the first dealer, and the first round
 * is dealt (the players now turn two cards over). Everything comes from `seed` (drawn when missing): the same seed deals the same game.
 */
export function setupStep(args: { players: readonly PlayerInfo[]; options?: unknown; seed?: number }): SkyjoStep {
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

  const state: State = {
    options,
    seats: seats as string[],
    ids: issueIds(CATALOGUE.length, idsRng),
    rng: rng.save(),
    deck: [],
    discard: [],
    dealer: Math.floor(rng() * n),
    grids: seats.map(() => []),
    stage: { kind: "between" },
    ender: null,
    last: [],
    rounds: [],
    stats: seats.map(() => ({ columns: 0, ended: 0, doubled: 0 })),
  }
  const ctx = open(state)
  // `open` restored the stream from `state.rng`, which is the one that drew the dealer
  startRound(ctx)
  return close(ctx)
}

/** A new game: the state of `setupStep`. */
export function setupGame(args: { players: readonly PlayerInfo[]; options?: unknown; seed?: number }): State {
  return setupStep(args).state
}
