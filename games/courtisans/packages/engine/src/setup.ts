import { SET_ASIDE_CARDS, HAND_SIZE, createCourtiers } from "./deck"
import { EngineError } from "./errors"
import { type Rng, shuffle } from "./rng"
import type { Courtier, GameState, PlayerInfo, Mission } from "./types"

export type SetupOptions = {
  players: PlayerInfo[]
  missions: Mission[]
  rng?: Rng
  courtiers?: Courtier[]
}

export function setupGame({ players, missions, rng = Math.random, courtiers = createCourtiers() }: SetupOptions): GameState {
  const count = players.length
  const toSetAside = SET_ASIDE_CARDS[count]
  if (toSetAside === undefined) throw new EngineError("INVALID_PLAYERS", "2 à 5 joueurs")
  if (new Set(players.map((j) => j.id)).size !== count) throw new EngineError("INVALID_PLAYERS", "ids dupliqués")

  const whites = shuffle(missions.filter((m) => m.color === "white"), rng)
  const blues = shuffle(missions.filter((m) => m.color === "blue"), rng)
  if (whites.length < count || blues.length < count) throw new EngineError("NOT_ENOUGH_MISSIONS")

  const shuffled = shuffle(courtiers, rng)
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
    phase: "playing",
    log: [],
  }
}
