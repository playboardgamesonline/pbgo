import { areaOf, faceOf, facesOf, handOf, isOut, isOver, playableOf, playerAt, seatOf, tokensOf } from "./machine"
import { tokensToWin } from "./options"
import { results } from "./results"
import type { Me, PlayerView, PublicPhase, PublicSeat, State } from "./types"

function publicPhase(s: State): PublicPhase {
  const { stage } = s
  if (stage.kind === "play") return { kind: "turn", player: playerAt(s, s.turn) }
  if (isOver(s)) return { kind: "over" }
  return { kind: "between", next: playerAt(s, s.turn), winners: stage.winners.map((seat) => playerAt(s, seat)), spy: stage.spy === null ? null : playerAt(s, stage.spy), revealed: stage.revealed }
}

/**
 * What `viewer` sees of the game (rulebook, pp. 4-6): the cards in the play areas and the three set aside face up at two players, the tokens, who is out, who is
 * protected; the viewer's own hand, face up; the other hands as a count, until a round that ended on a comparison lays them face up; the deck and the card set aside
 * face down as their size, never a card.
 *
 * The viewer only decides `me`: a spectator, or a player who is not at the table, gets `me: null` and the same view of everything else.
 */
export function playerView(state: State, viewer: string | null): PlayerView {
  const s = state
  const tokens = tokensOf(s)
  const seat = viewer === null ? -1 : seatOf(s, viewer)
  const revealed = s.stage.kind === "between" && s.stage.revealed
  const players: PublicSeat[] = s.seats.map((id, i) => ({
    id,
    cards: handOf(s, i).length,
    hand: revealed && !isOut(s, i) ? facesOf(s, handOf(s, i)) : null,
    area: facesOf(s, areaOf(s, i)),
    out: isOut(s, i),
    shielded: s.shielded[i] === true,
    tokens: tokens[i] ?? 0,
  }))
  const me: Me | null = viewer !== null && seat >= 0 ? { id: viewer, hand: facesOf(s, handOf(s, seat)), playable: playableOf(s, seat) } : null
  return {
    options: { ...s.options },
    me,
    players,
    standings: s.seats.map((playerId, i) => ({ playerId, score: tokens[i] ?? 0 })),
    deck: { size: s.deck.length },
    aside: s.aside === null ? 0 : 1,
    faceUp: s.faceUp.map((id) => faceOf(s, id)),
    round: s.round,
    target: tokensToWin(s.seats.length),
    phase: publicPhase(s),
    results: results(s),
  }
}
