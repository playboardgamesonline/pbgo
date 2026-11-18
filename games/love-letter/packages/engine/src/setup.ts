import { type PlayerInfo, assertPlayers, createSaveableRng, issueIds, normalizeOptions, randomSeed, sideSeed } from "@pbgo/engine-kit"
import { CATALOGUE } from "./catalogue"
import { close, open } from "./machine"
import { OPTIONS } from "./options"
import { startRound } from "./round"
import type { LoveLetterStep, State } from "./types"

/** The standard game seats 2 to 6 players (rulebook, p. 2). The classic version, for 2 to 4, is out of scope. */
export const MIN_PLAYERS = 2
export const MAX_PLAYERS = 6

/** Salt of the stream of the card ids (see `sideSeed`): it never moves the stream of the shuffles. */
const IDS_STREAM = 1

/**
 * A new game, and what happened while it was set up: the first player is drawn among the seats (the booklet says the player who most recently hand-wrote a
 * letter, which a screen cannot know: the reading validated for pp. 3 and 16), and the first round is dealt. Everything comes from `seed` (drawn when missing):
 * the same seed deals the same game. A table of the wrong size, an empty id or the same id twice is refused with `INVALID_PLAYERS`.
 */
export function setupStep(args: { players: readonly PlayerInfo[]; options?: unknown; seed?: number }): LoveLetterStep {
  const { players } = args
  assertPlayers(players, { min: MIN_PLAYERS, max: MAX_PLAYERS })
  const n = players.length
  const seats = players.map((player) => player.id)
  const options = normalizeOptions(OPTIONS, args.options, { playerCount: n })
  const seed = args.seed ?? randomSeed()
  const rng = createSaveableRng(seed)
  const idsRng = createSaveableRng(sideSeed(seed, IDS_STREAM))
  const first = Math.floor(rng() * n)

  const state: State = {
    options,
    seats,
    ids: issueIds(CATALOGUE.length, idsRng),
    // after the draw of the first player: the shuffles go on from here
    rng: rng.save(),
    round: 0,
    turn: first,
    stage: { kind: "between", revealed: false, winners: [], spy: null },
    deck: [],
    aside: null,
    faceUp: [],
    hands: seats.map(() => []),
    areas: seats.map(() => []),
    out: seats.map(() => false),
    shielded: seats.map(() => false),
    won: seats.map(() => 0),
    spies: seats.map(() => 0),
  }
  const ctx = open(state)
  startRound(ctx)
  return close(ctx)
}

/** A new game: the state of `setupStep`. */
export function setupGame(args: { players: readonly PlayerInfo[]; options?: unknown; seed?: number }): State {
  return setupStep(args).state
}
