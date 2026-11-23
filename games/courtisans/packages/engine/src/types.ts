import type { LogEntry, PlayerResult, Results, Step } from "@pbgo/engine-kit"
import type { Family, Role } from "./catalogue"

/**
 * Courtisans: the types the engine and the board share.
 *
 * A card is a number in the state: the opaque id it holds right now (`ids` of the engine-kit). What it is (its family and its role) comes from the catalogue of the game (`catalogue.ts`), which is
 * constant and never stored (lean state, PLT-45). The views show a card as a `Courtier` (its id, its family and its role) to a viewer who may see it, and as a `VisibleCard` where a spy keeps its family
 * hidden: a spy that was played shows no family to anybody until the game is over, its owner included.
 *
 * Hidden: the hands of the other players, the order of the deck, the cards set aside, the cards that were eliminated, the two missions of each player until the end.
 */

/** The side of the mat: the cards the Queen's table holds above it (`up`, the light) and below it (`down`, the disgrace). */
export type Level = "up" | "down"
export type Status = "light" | "disgrace" | "neutral"

/**
 * The three places a turn plays a card, once each: the Queen's table, the player's own domain, another player's domain. Playing in a domain, whoever's, is the zone of the player it belongs to:
 * the player's own is `domain`, anybody else's is `opponentDomain`.
 */
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

/**
 * A mission, as a rule: what has to hold at the end for it to be worth `MISSION_POINTS`. Its text and its picture are not here: they are the game's, in its Sanity, under the same `id`.
 */
export type Mission = {
  id: string
  color: MissionColor
  condition: Condition
}

/** A card of the Queen's table: its id and the side of the mat it lies on. */
export type TableCard = { card: number; level: Level }

/** What the game is at: the missions are read (a simultaneous step), then the banquet is played, then it is over. Never stored: it is read from the state (`phaseOf`). */
export type Phase = "missions" | "playing" | "over"

/**
 * The state holds ids and numbers only. Every order comes from an array (`seats`, the piles, the hands), never from the keys of an object: the state is stored as `jsonb`, which does not keep them.
 *
 * Each id of `ids` is in exactly one place: the deck, `setAside`, `eliminated`, the hand of a seat, the domain of a seat or the table.
 */
export type State = {
  /** Player ids in seat order, clockwise: the player on the left of seat 3 is seat 4. */
  seats: string[]
  /** `ids[card]` is the id the card at index `card` of the catalogue holds. */
  ids: number[]
  /** Saved position of the stream of the shuffles, which the automatic moves draw from too. */
  rng: number
  /** The draw pile, top first. Hidden. */
  deck: number[]
  /** The cards put aside at the start, face down: nobody looks at them and they never come back. Hidden. */
  setAside: number[]
  /** The cards an assassin eliminated, in the order they went. Out of the game. */
  eliminated: number[]
  /** By seat: the cards the player holds. Hidden from the others. */
  hands: number[][]
  /** By seat: the cards that lie in the player's domain, in the order they came. */
  domains: number[][]
  /** The Queen's table: the cards played to it, in the order they came, each above or below the mat. */
  table: TableCard[]
  /** By seat: the ids of the two missions the player was dealt, the white one then the blue one (`MISSIONS`). Hidden until the end. */
  missions: string[][]
  /** By seat: the player has read their missions. The banquet starts once every player has. */
  read: boolean[]
  /** The seat that plays: while the missions are read, the one that will begin the banquet. */
  active: number
  /** The zones the player of the turn has played a card in, in the order they were. A turn ends at three zones, or when the hand is empty. */
  zones: PlayZone[]
}

/**
 * What a player can do.
 * - `readMissions`: before the banquet, say that you have read your missions. Once is enough; saying it again changes nothing.
 * - `playCard`: on your turn, play the card `cardId` of your hand in a zone you have not played in yet this turn. `target` says where: the Queen's table above or below the mat, or the domain of a player
 *   (yours, or another one's). An assassin may eliminate a card of the zone it is played in, named by `victimId`: a card of that player's domain, or of the table, that is not a guard.
 */
export type Action = { type: "readMissions"; playerId: string } | { type: "playCard"; playerId: string; cardId: number; target: Target; victimId?: number }

/** One action, by its type: `ActionOf<"playCard">`. */
export type ActionOf<T extends Action["type"]> = Extract<Action, { type: T }>

/** The actions a client may send. */
export const CLIENT_ACTIONS = ["readMissions", "playCard"] as const satisfies readonly Action["type"][]

/**
 * What the engine refuses with an `EngineError`, by code. The board turns them into messages (the game's own ones are listed in `ERROR_CODES` of the binding and written in Sanity); the platform already
 * words the shared ones (`NOT_YOUR_TURN`, `NOT_WAITING`, `INVALID_PHASE`…).
 */
export const COURTISANS_ERROR_CODES = [
  "INVALID_PLAYERS", // the table is not 2 to 5 different players
  "GAME_OVER", // the game is over
  "NOT_YOUR_TURN", // the action belongs to another player (or to nobody)
  "NOT_WAITING", // the game does not wait for this player (a takeover asked for somebody it does not wait for)
  "INVALID_ACTION", // malformed
  "INVALID_PHASE", // a card played while the missions are still being read
  "UNKNOWN_PLAYER", // the player is not at the table
  "UNKNOWN_CARD", // the card is not in the player's hand
  "INVALID_TARGET", // the domain a card is played in is not one of a player at the table
  "ZONE_ALREADY_PLAYED", // a card was already played in that zone this turn
  "INVALID_ASSASSINATION", // the victim is not a card this assassin may eliminate: it is not in the zone, it is a guard or the assassin itself, or the card played is not an assassin
] as const
export type CourtisansErrorCode = (typeof COURTISANS_ERROR_CODES)[number]

/** A card a player knows: the one in their own hand. */
export type Courtier = { id: number; family: Family; role: Role | null }

/** A card as the others see it: a spy that was played keeps its id (stable when it is revealed at the end) but loses its family until the game is over. */
export type VisibleCard = { id: number; family: Family | null; role: Role | null }

/**
 * What happened, as plain data: the client turns it into sentences and animations.
 * - `cardPlayed`: `playerId` played `card` in `target`.
 * - `cardEliminated`: an assassin of `playerId` eliminated `card`, which lay in `target`.
 * - `draw`: `playerId` drew `count` cards from the deck at the end of their turn.
 * - `gameOver`: nobody holds a card any more.
 * Nothing is private: a spy shows no family in the entries either, whoever reads them.
 */
export type CourtisansEvent =
  | { type: "cardPlayed"; playerId: string; card: VisibleCard; target: Target }
  | { type: "cardEliminated"; playerId: string; card: VisibleCard; target: Target }
  | { type: "draw"; playerId: string; count: number }
  | { type: "gameOver" }

export type CourtisansLogEntry = LogEntry<CourtisansEvent>

/** What a step gives back: the new state and what happened, for the platform to keep (the state keeps no log). */
export type CourtisansStep = Step<State, CourtisansEvent>

export type FamilyStatus = { up: number; down: number; status: Status }
export type Statuses = Record<Family, FamilyStatus>

export type FamilyDetail = { family: Family; weight: number; points: number }

/** A player's result: the shared contract (a `detail` of lines) and Courtisans' own detail (the families of their domain, their missions). */
export type CourtisansPlayerResult = PlayerResult & {
  domainPoints: number
  families: FamilyDetail[]
  missions: { missionId: string; done: boolean; points: number }[]
}

export type CourtisansResults = Omit<Results, "players"> & {
  statuses: Statuses
  players: CourtisansPlayerResult[]
}

/** A player at the table, as everybody sees them. */
export type VisiblePlayer = {
  id: string
  /** The cards of their domain, in the order they came; a spy shows no family until the end. */
  domain: VisibleCard[]
  /** How many cards they hold. */
  handCount: number
  missionsRead: boolean
  /** The ids of their two missions: only once the game is over. */
  missions: string[] | null
}

export type PlayerView = {
  /** The viewer, when they sit at the table: their hand and the ids of their two missions. `null` for a spectator, or a player who is not at the table. */
  me: { id: string; hand: Courtier[]; missions: string[] } | null
  /** In seat order. */
  players: VisiblePlayer[]
  /** The Queen's table, in the order the cards came. */
  table: { card: VisibleCard; level: Level }[]
  /** The deck: its size. Its cards are hidden. */
  deckCount: number
  /** Whose turn it is, once the banquet has started. */
  activePlayerId: string | null
  /** Who begins the banquet: the player whose turn it is, or will be. Known from the start. */
  firstPlayerId: string | null
  /** The zones where the player of the turn has not played a card yet. */
  availableZones: PlayZone[]
  phase: Phase
  results: CourtisansResults | null
}
