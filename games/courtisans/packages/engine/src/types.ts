export const FAMILIES = ["butterfly", "toad", "nightingale", "hare", "stag", "carp"] as const
export type Family = (typeof FAMILIES)[number]

export const ROLES = ["noble", "spy", "assassin", "guard"] as const
export type Role = (typeof ROLES)[number]

export type Courtier = {
  id: string
  family: Family
  role: Role | null
}

export type Level = "up" | "down"
export type Status = "light" | "disgrace" | "neutral"
export type PlayZone = "table" | "domain" | "opponentDomain"

export type Target = { zone: "table"; level: Level } | { zone: "domain"; playerId: string }

export type Comparator = "eq" | "gte" | "lte" | "gt" | "lt"

export type CardFilter = {
  family?: Family
  role?: Role | "noRole"
}

export type CountMode = "cards" | "weight"

export type Opponent = "leftNeighbor" | "rightNeighbor" | "allOpponents" | "anyOpponent"

export type Condition =
  | { type: "familyStatus"; family: Family; status: Status }
  | { type: "familiesWithStatus"; status: Status; comparator: Comparator; value: number }
  | { type: "domainCards"; filter: CardFilter; comparator: Comparator; value: number; mode?: CountMode }
  | { type: "tableCards"; filter: CardFilter; level?: Level; comparator: Comparator; value: number; mode?: CountMode }
  | { type: "playerComparison"; filter: CardFilter; comparator: Comparator; opponent: Opponent; mode?: CountMode }
  | { type: "and"; conditions: Condition[] }
  | { type: "or"; conditions: Condition[] }
  | { type: "not"; condition: Condition }

export type MissionColor = "white" | "blue"

export type Mission = {
  id: string
  color: MissionColor
  text: string
  condition: Condition
}

export type { PlayerInfo } from "@pbgo/engine-kit"
import type { PlayerInfo } from "@pbgo/engine-kit"

export type Player = PlayerInfo & {
  hand: Courtier[]
  domain: Courtier[]
  missions: Mission[]
  missionsRead: boolean
}

export type Placement = {
  card: Courtier
  level: Level
}

export type Phase = "missions" | "playing" | "over"

export type GameEvent =
  | { type: "cardPlayed"; playerId: string; card: Courtier; target: Target }
  | { type: "cardEliminated"; playerId: string; card: Courtier; target: Target }
  | { type: "draw"; playerId: string; count: number }
  | { type: "gameOver" }

export type GameState = {
  players: Player[]
  deck: Courtier[]
  setAside: Courtier[]
  eliminated: Courtier[]
  table: Placement[]
  activePlayer: number
  playedZones: PlayZone[]
  turnNumber: number
  phase: Phase
  log: GameEvent[]
  /** Seed the game was set up with (server side only, never in a view). Absent from games started before it existed. */
  seed?: number
}

export type Action =
  | { type: "readMissions"; playerId: string }
  | { type: "playCard"; playerId: string; cardId: string; target: Target; victimId?: string }
