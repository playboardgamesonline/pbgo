import type { Courtier, Family, GameState, Player, Placement, Role } from "./types"

let seq = 0
export function card(family: Family, role: Role | null = null): Courtier {
  return { id: `t${++seq}`, family, role }
}

export function place(c: Courtier, level: "up" | "down"): Placement {
  return { card: c, level }
}

export function player(id: string, patch: Partial<Player> = {}): Player {
  return { id, nickname: id, hand: [], domain: [], missions: [], missionsRead: true, ...patch }
}

export function makeState(patch: Partial<GameState>): GameState {
  return {
    players: [],
    deck: [],
    setAside: [],
    eliminated: [],
    table: [],
    activePlayer: 0,
    playedZones: [],
    turnNumber: 1,
    phase: "playing",
    log: [],
    ...patch,
  }
}
