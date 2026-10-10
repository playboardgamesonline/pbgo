import { activePlayerId, availableZones } from "./actions"
import { type CourtisansResults, computeResults } from "./scoring"
import type { Target, Courtier, Family, GameState, Mission, Level, Phase, Role, PlayZone } from "./types"

export type VisibleCard = {
  id: string
  family: Family | null
  role: Role | null
}

export type VisibleEvent =
  | { type: "cardPlayed"; playerId: string; card: VisibleCard; target: Target }
  | { type: "cardEliminated"; playerId: string; card: VisibleCard; target: Target }
  | { type: "draw"; playerId: string; count: number }
  | { type: "gameOver" }

export type VisiblePlayer = {
  id: string
  nickname: string
  domain: VisibleCard[]
  handCount: number
  missionsRead: boolean
  missions: Mission[] | null
}

export type PlayerView = {
  me: { id: string; hand: Courtier[]; missions: Mission[] } | null
  players: VisiblePlayer[]
  table: { card: VisibleCard; level: Level }[]
  deckCount: number
  activePlayerId: string | null
  firstPlayerId: string | null
  availableZones: PlayZone[]
  turnNumber: number
  phase: Phase
  log: VisibleEvent[]
  results: CourtisansResults | null
}

/** A card as others see it: a hidden spy keeps its opaque id (stable when it is revealed) but loses its family. */
export function visibleCard(card: Courtier, revealed: boolean): VisibleCard {
  if (card.role === "spy" && !revealed) return { id: card.id, family: null, role: "spy" }
  return { id: card.id, family: card.family, role: card.role }
}

export function playerView(state: GameState, playerId: string | null): PlayerView {
  const ending = state.phase === "over"
  const me = state.players.find((j) => j.id === playerId)

  return {
    me: me ? { id: me.id, hand: me.hand, missions: me.missions } : null,
    players: state.players.map((j) => ({
      id: j.id,
      nickname: j.nickname,
      domain: j.domain.map((c) => visibleCard(c, ending)),
      handCount: j.hand.length,
      missionsRead: j.missionsRead,
      missions: ending ? j.missions : null,
    })),
    table: state.table.map(({ card, level }) => ({ card: visibleCard(card, ending), level })),
    deckCount: state.deck.length,
    activePlayerId: activePlayerId(state),
    firstPlayerId: state.players[state.activePlayer]?.id ?? null,
    availableZones: availableZones(state),
    turnNumber: state.turnNumber,
    phase: state.phase,
    log: state.log.map((e) =>
      e.type === "cardPlayed" || e.type === "cardEliminated" ? { ...e, card: visibleCard(e.card, ending) } : e,
    ),
    results: ending ? computeResults(state) : null,
  }
}
