import { CARDS } from "./catalogue"
import { faceOf, facesOf, isOver, keyOf, lineOf, playerAt, roundScore, targetOf, targetsOf, totalsOf } from "./machine"
import { results } from "./results"
import type { PlayerView, PublicPhase, PublicSeat, State } from "./types"

function publicPhase(s: State): PublicPhase {
  const top = s.stack.at(-1)
  if (top?.kind === "turn") return { kind: "turn", player: playerAt(s, top.seat), canStay: lineOf(s, top.seat).length > 0 }
  if (top?.kind === "target") {
    return { kind: "target", player: playerAt(s, top.seat), card: faceOf(s, top.card), targets: targetsOf(s, top).map((seat) => playerAt(s, seat)) }
  }
  return isOver(s) ? { kind: "over" } : { kind: "between", dealer: playerAt(s, s.dealer) }
}

/** The faces the draw pile still holds, in the order of `CARDS`: public, since it is what is not in front of anyone nor on the discard. */
function deckCounts(s: State): { type: string; count: number }[] {
  const counts = new Map<string, number>()
  for (const id of s.deck) {
    const face = keyOf(s, id)
    counts.set(face, (counts.get(face) ?? 0) + 1)
  }
  return Object.keys(CARDS).map((type) => ({ type, count: counts.get(type) ?? 0 }))
}

/**
 * What `viewer` sees of the game: everything but the order of the draw pile. Every card is turned face up as it is drawn, so the lines,
 * the cards set aside and the discard are shown whole, and the draw pile as its size and the faces it still holds.
 *
 * The viewer only decides `me`: a spectator, or a player who is not at the table, gets the same view with `me: null`.
 */
export function playerView(state: State, viewer: string | null): PlayerView {
  const s = state
  const totals = totalsOf(s)
  const phase = publicPhase(s)
  const players: PublicSeat[] = s.seats.map((id, seat) => ({
    id,
    cards: facesOf(s, lineOf(s, seat)),
    held: facesOf(
      s,
      s.stack.flatMap((frame) => (frame.kind === "flip" && frame.seat === seat ? frame.held : [])),
    ),
    status: s.status[seat]!,
    score: roundScore(s, seat),
    total: totals[seat]!,
  }))
  return {
    options: { ...s.options },
    me: viewer !== null && s.seats.includes(viewer) ? viewer : null,
    players,
    dealer: playerAt(s, s.dealer),
    deck: { size: s.deck.length, counts: deckCounts(s) },
    discard: facesOf(s, s.discard),
    round: phase.kind === "turn" || phase.kind === "target" ? s.rounds.length + 1 : s.rounds.length,
    rounds: s.rounds.map((scores) => [...scores]),
    target: targetOf(s),
    phase,
    results: results(s),
  }
}
