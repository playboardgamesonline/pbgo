import { faceOfId, facesOfIds, playerAt, seatOf } from "@pbgo/engine-kit"
import { CATALOGUE } from "./catalogue"
import { areaOf, handOf, isOut, isOver, playableOf, targetsOf, tokensOf } from "./machine"
import { tokensToWin } from "./options"
import { results } from "./results"
import type { Me, PlayerView, PublicPhase, PublicSeat, State } from "./types"

function publicPhase(s: State): PublicPhase {
  const { stage } = s
  if (stage.kind === "keep") return { kind: "keep", player: playerAt(s.seats, s.turn) }
  if (stage.kind === "play") return { kind: "turn", player: playerAt(s.seats, s.turn), targets: targetsOf(s, s.turn).map((seat) => playerAt(s.seats, seat)) }
  if (isOver(s)) return { kind: "over" }
  return { kind: "between", next: playerAt(s.seats, s.turn), winners: stage.winners.map((seat) => playerAt(s.seats, seat)), spy: stage.spy === null ? null : playerAt(s.seats, stage.spy), revealed: stage.revealed }
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
  const seat = viewer === null ? -1 : seatOf(s.seats, viewer)
  const revealed = s.stage.kind === "between" && s.stage.revealed
  const players: PublicSeat[] = s.seats.map((id, i) => ({
    id,
    cards: handOf(s, i).length,
    hand: revealed && !isOut(s, i) ? facesOfIds(s.ids, CATALOGUE, handOf(s, i)) : null,
    area: facesOfIds(s.ids, CATALOGUE, areaOf(s, i)),
    out: isOut(s, i),
    shielded: s.shielded[i] === true,
    tokens: tokens[i] ?? 0,
  }))
  const me: Me | null = viewer !== null && seat >= 0 ? { id: viewer, hand: facesOfIds(s.ids, CATALOGUE, handOf(s, seat)), playable: playableOf(s, seat) } : null
  return {
    options: { ...s.options },
    me,
    players,
    standings: s.seats.map((playerId, i) => ({ playerId, score: tokens[i] ?? 0 })),
    deck: { size: s.deck.length },
    aside: s.aside === null ? 0 : 1,
    faceUp: s.faceUp.map((id) => faceOfId(s.ids, CATALOGUE, id)),
    round: s.round,
    target: tokensToWin(s.seats.length),
    phase: publicPhase(s),
    results: results(s),
  }
}
