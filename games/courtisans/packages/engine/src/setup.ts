import { assertPlayers, createSaveableRng, deal, draw, issueIds, randomSeed, shuffle, sideSeed, type PlayerInfo } from "@pbgo/engine-kit"
import { CATALOGUE, HAND_SIZE, SET_ASIDE_CARDS } from "./catalogue"
import { MISSIONS } from "./missions"
import type { State } from "./types"

/** The game seats 2 to 5 players. */
export const MIN_PLAYERS = 2
export const MAX_PLAYERS = 5

/** Salt of the stream of the card ids (see `sideSeed`): it never moves the stream of the shuffles. */
const IDS_STREAM = 1

/**
 * A new game: each player is dealt a white and a blue mission, the box is shuffled, some of it is put aside by the number of players, and every player is dealt three cards. The player who begins the banquet
 * is drawn among the seats. The game waits for every player to read their missions. Everything comes from `seed` (drawn when missing): the same seed deals the same game. A table of the wrong size, an empty id
 * or the same id twice is refused with `INVALID_PLAYERS`.
 */
export function setupGame(args: { players: readonly PlayerInfo[]; seed?: number }): State {
  const { players } = args
  assertPlayers(players, { min: MIN_PLAYERS, max: MAX_PLAYERS })
  const seats = players.map((player) => player.id)
  const seed = args.seed ?? randomSeed()
  const rng = createSaveableRng(seed)

  const whites = shuffle(
    MISSIONS.filter((mission) => mission.color === "white"),
    rng,
  )
  const blues = shuffle(
    MISSIONS.filter((mission) => mission.color === "blue"),
    rng,
  )
  // The ids are drawn from a side stream, in the order of the catalogue: an id reveals neither the family nor the place a card has in the shuffle
  const ids = issueIds(CATALOGUE.length, createSaveableRng(sideSeed(seed, IDS_STREAM)))
  const shuffled = shuffle(
    CATALOGUE.map((_, card) => ids[card]!),
    rng,
  )
  const { drawn: setAside, pile: rest } = draw(shuffled, SET_ASIDE_CARDS[seats.length])
  const { hands, pile: deck } = deal(rest, seats.length, HAND_SIZE)
  const active = Math.floor(rng() * seats.length)

  return {
    seats,
    ids,
    rng: rng.save(),
    deck,
    setAside,
    eliminated: [],
    hands,
    domains: seats.map(() => []),
    table: [],
    missions: seats.map((_, seat) => [whites[seat]!.id, blues[seat]!.id]),
    read: seats.map(() => false),
    active,
    zones: [],
  }
}
