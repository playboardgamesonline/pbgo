import { type PlayerInfo, assertPlayers, createSaveableRng, issueIds, normalizeOptions, randomSeed, shuffle, sideSeed } from "@pbgo/engine-kit"
import { CATALOGUE } from "./catalogue"
import { close, open } from "./machine"
import { OPTIONS } from "./options"
import { startRound } from "./round"
import type { State, Status, Flip7Step } from "./types"

/**
 * The booklet says "3+ players" and recommends a second deck past 18, which this engine does not have. The web edition seats 3 to 8: a line
 * of cards per seat has to stay readable on one screen.
 */
export const MIN_PLAYERS = 3
export const MAX_PLAYERS = 8

/** Salt of the stream of the card ids (see `sideSeed`): it never moves the stream of the shuffles. */
const IDS_STREAM = 1

/**
 * A new game, and what happened while it was set up: the 94 cards are shuffled, a random player is the first dealer, and the first round is dealt (the dealer deals, and the
 * round goes on until the game needs a player). Everything comes from `seed` (drawn when missing): the same seed and the same options
 * deal the same game. The events are those of the first round, the log opens with them.
 */
export function setupStep(args: { players: readonly PlayerInfo[]; options?: unknown; seed?: number }): Flip7Step {
  const { players } = args
  assertPlayers(players, { min: MIN_PLAYERS, max: MAX_PLAYERS })
  const n = players.length
  const seats = players.map((player) => player.id)
  const options = normalizeOptions(OPTIONS, args.options, { playerCount: n })
  const seed = args.seed ?? randomSeed()
  const rng = createSaveableRng(seed)
  const idsRng = createSaveableRng(sideSeed(seed, IDS_STREAM))

  const ids = issueIds(CATALOGUE.length, idsRng)
  const deck = shuffle(ids, rng)
  const dealer = Math.floor(rng() * n)

  const state: State = {
    options,
    seats,
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
  return close(ctx)
}

/** A new game: the state of `setupStep`. */
export function setupGame(args: { players: readonly PlayerInfo[]; options?: unknown; seed?: number }): State {
  return setupStep(args).state
}
