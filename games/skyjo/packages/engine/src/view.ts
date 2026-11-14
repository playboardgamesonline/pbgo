import { faceOf, gridOf, isOver, openingSeats, playerAt, revealedCount, totalsOf, visibleScore } from "./machine"
import { TARGET_SCORE } from "./options"
import { results } from "./results"
import type { LastTurn, PlayerView, PublicCell, PublicPhase, PublicSeat, State } from "./types"

function publicPhase(s: State, viewer: string | null): PublicPhase {
  const { stage } = s
  switch (stage.kind) {
    case "reveal":
      return { kind: "reveal", waiting: openingSeats(s).map((seat) => playerAt(s, seat)) }
    case "choose":
      return { kind: "choose", player: playerAt(s, stage.seat) }
    case "place": {
      const player = playerAt(s, stage.seat)
      // a card taken from the discard was seen by everybody; one drawn from the pile only by whoever drew it
      const seen = stage.from === "discard" || viewer === player
      return { kind: "place", player, from: stage.from, card: seen ? faceOf(s, stage.card) : null, canDiscard: stage.from === "deck" }
    }
    case "flip":
      return { kind: "flip", player: playerAt(s, stage.seat) }
    case "between":
      return isOver(s) ? { kind: "over" } : { kind: "between", dealer: playerAt(s, s.dealer) }
  }
}

function lastTurnOf(s: State, seat: number): LastTurn {
  if (s.ender === null) return null
  if (s.ender === seat) return "ender"
  return s.last.includes(seat) ? "done" : "pending"
}

/**
 * What `viewer` sees of the game. A card face down in a grid is `{ up: false }`: no id, no face, for every viewer, its owner included
 * (they do not know it either). The draw pile is its size. The card a player has drawn is seen by them only, until it is placed or thrown away.
 *
 * The viewer only decides `me` and the drawn card: a spectator, or a player who is not at the table, gets `me: null` and never sees a drawn card.
 */
export function playerView(state: State, viewer: string | null): PlayerView {
  const s = state
  const totals = totalsOf(s)
  const phase = publicPhase(s, viewer)
  const players: PublicSeat[] = s.seats.map((id, seat) => ({
    id,
    cells: gridOf(s, seat).map((cell): PublicCell => (cell === null ? null : cell.up ? { up: true, card: faceOf(s, cell.card) } : { up: false })),
    score: visibleScore(s, seat),
    total: totals[seat]!,
    revealed: revealedCount(s, seat),
    lastTurn: lastTurnOf(s, seat),
  }))
  const top = s.discard[0]
  return {
    options: { ...s.options },
    me: viewer !== null && s.seats.includes(viewer) ? viewer : null,
    players,
    standings: s.seats.map((playerId, seat) => ({ playerId, score: totals[seat]! })),
    dealer: playerAt(s, s.dealer),
    deck: { size: s.deck.length },
    discard: { size: s.discard.length, top: top === undefined ? null : faceOf(s, top) },
    ender: s.ender === null ? null : playerAt(s, s.ender),
    round: s.stage.kind === "between" ? s.rounds.length : s.rounds.length + 1,
    rounds: s.rounds.map((scores) => [...scores]),
    target: TARGET_SCORE,
    phase,
    results: results(s),
  }
}

