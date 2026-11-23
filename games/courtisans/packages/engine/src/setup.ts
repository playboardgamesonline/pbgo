import { type Rng, createRng, deal, draw, randomSeed, shuffle, sideSeed } from "@pbgo/engine-kit"
import { SET_ASIDE_CARDS, HAND_SIZE, assignOpaqueIds, createCourtiers } from "./deck"
import { EngineError } from "./errors"
import { MISSIONS } from "./missions"
import type { Courtier, GameState, PlayerInfo } from "./types"

/** Salt of the stream that draws the opaque card ids (see `sideSeed`). */
const IDS_STREAM = 1

export type SetupOptions = {
  players: PlayerInfo[]
  /** Game seed: the whole game (deal, card ids, automatic moves) derives from it. Random when omitted. */
  seed?: number
  /** Overrides the deal's stream (tests); defaults to `createRng(seed)`. */
  rng?: Rng
  courtiers?: Courtier[]
}

export function setupGame({ players, seed = randomSeed(), rng = createRng(seed), courtiers = createCourtiers() }: SetupOptions): GameState {
  const count = players.length
  const toSetAside = SET_ASIDE_CARDS[count]
  if (toSetAside === undefined) throw new EngineError("INVALID_PLAYERS", "2 à 5 joueurs")
  if (new Set(players.map((j) => j.id)).size !== count) throw new EngineError("INVALID_PLAYERS", "ids dupliqués")

  const whites = shuffle(MISSIONS.filter((m) => m.color === "white"), rng)
  const blues = shuffle(MISSIONS.filter((m) => m.color === "blue"), rng)

  // ids are given after the shuffle, from a separate stream: they reveal neither the family nor the deal's stream
  const shuffled = assignOpaqueIds(shuffle(courtiers, rng), createRng(sideSeed(seed, IDS_STREAM)))
  const { drawn: setAside, pile: rest } = draw(shuffled, toSetAside)
  const { hands, pile: deck } = deal(rest, count, HAND_SIZE)

  return {
    players: players.map((player, i) => ({
      ...player,
      hand: hands[i]!,
      domain: [],
      missions: [whites[i]!.id, blues[i]!.id],
      missionsRead: false,
    })),
    deck,
    setAside,
    eliminated: [],
    table: [],
    activePlayer: Math.floor(rng() * count),
    playedZones: [],
    turnNumber: 1,
    // the banquet starts once every player has read their missions (see `readMissions`)
    phase: "missions",
    log: [],
    seed,
  }
}
