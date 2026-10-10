import { SET_ASIDE_CARDS, HAND_SIZE, assignOpaqueIds, createCourtiers } from "./deck"
import { EngineError } from "./errors"
import { type Rng, createRng, randomSeed, shuffle, sideSeed } from "./rng"
import type { Courtier, GameState, PlayerInfo, Mission } from "./types"

/** Salt of the stream that draws the opaque card ids (see `sideSeed`). */
const IDS_STREAM = 1

export type SetupOptions = {
  players: PlayerInfo[]
  missions: Mission[]
  /** Game seed: the whole game (deal, card ids, automatic moves) derives from it. Random when omitted. */
  seed?: number
  /** Overrides the deal's stream (tests); defaults to `createRng(seed)`. */
  rng?: Rng
  courtiers?: Courtier[]
}

export function setupGame({ players, missions, seed = randomSeed(), rng = createRng(seed), courtiers = createCourtiers() }: SetupOptions): GameState {
  const count = players.length
  const toSetAside = SET_ASIDE_CARDS[count]
  if (toSetAside === undefined) throw new EngineError("INVALID_PLAYERS", "2 à 5 joueurs")
  if (new Set(players.map((j) => j.id)).size !== count) throw new EngineError("INVALID_PLAYERS", "ids dupliqués")

  const whites = shuffle(missions.filter((m) => m.color === "white"), rng)
  const blues = shuffle(missions.filter((m) => m.color === "blue"), rng)
  if (whites.length < count || blues.length < count) throw new EngineError("NOT_ENOUGH_MISSIONS")

  // ids are given after the shuffle, from a separate stream: they reveal neither the family nor the deal's stream
  const shuffled = assignOpaqueIds(shuffle(courtiers, rng), createRng(sideSeed(seed, IDS_STREAM)))
  const setAside = shuffled.splice(0, toSetAside)

  return {
    players: players.map((player, i) => ({
      ...player,
      hand: shuffled.splice(0, HAND_SIZE),
      domain: [],
      missions: [whites[i] as Mission, blues[i] as Mission],
      missionsRead: false,
    })),
    deck: shuffled,
    setAside,
    eliminated: [],
    table: [],
    activePlayer: Math.floor(rng() * count),
    playedZones: [],
    turnNumber: 1,
    // le banquet commence quand tous les joueurs ont lu leurs missions (voir `readMissions`)
    phase: "missions",
    log: [],
    seed,
  }
}
