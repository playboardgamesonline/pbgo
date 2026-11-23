import { playerAt, seatOf } from "@pbgo/engine-kit"
import { activePlayerId, availableZones, courtierOf, domainOf, handOf, isOver, phaseOf, visibleCard } from "./machine"
import { results } from "./results"
import type { PlayerView, State, VisiblePlayer } from "./types"

/**
 * What `viewer` sees of the game. Public: every domain and the Queen's table, the size of the hands and of the deck, who has read their missions. A spy that was played keeps its family hidden from everybody,
 * its owner included, until the game is over; it keeps the same id when it is revealed, so a board can follow the card. The viewer's own hand and their two missions are theirs alone: the other
 * missions are shown at the end, with the results. The nicknames are the table's, never the view's.
 *
 * The viewer only decides `me`: a spectator, or a player who is not at the table, gets `me: null` and the same view of everything else.
 */
export function playerView(state: State, viewer: string | null): PlayerView {
  const s = state
  const over = isOver(s)
  const seat = viewer === null ? -1 : seatOf(s.seats, viewer)
  const players: VisiblePlayer[] = s.seats.map((id, i) => ({
    id,
    domain: domainOf(s, i).map((card) => visibleCard(s, card, over)),
    handCount: handOf(s, i).length,
    missionsRead: s.read[i] === true,
    missions: over ? [...s.missions[i]!] : null,
  }))
  return {
    me: viewer !== null && seat >= 0 ? { id: viewer, hand: handOf(s, seat).map((card) => courtierOf(s, card)), missions: [...s.missions[seat]!] } : null,
    players,
    table: s.table.map(({ card, level }) => ({ card: visibleCard(s, card, over), level })),
    deckCount: s.deck.length,
    activePlayerId: activePlayerId(s),
    firstPlayerId: playerAt(s.seats, s.active),
    availableZones: availableZones(s),
    phase: phaseOf(s),
    // standings: none, the points are secret until the end (the missions are hidden), so `results` is null until the game is over
    results: results(s),
  }
}
