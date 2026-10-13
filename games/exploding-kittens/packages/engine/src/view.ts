import { buildCatalogue } from "./catalogue"
import { type Ctx, faceOf, facesOf, isOut, seatOf } from "./machine"
import { results } from "./results"
import type { Rules } from "./rules"
import type { Pending, PlayerView, PublicPending, PublicPhase, State } from "./types"

/** What a view needs to name a card: the state's ids and the types of the catalogue. */
type Book = Pick<Ctx, "s" | "types">

function publicPending(book: Book, pending: Pending): PublicPending {
  if (pending.kind === "card") {
    const card: Extract<PublicPending, { kind: "card" }> = { kind: "card", by: pending.by, card: faceOf(book, pending.card) }
    if (pending.target !== undefined) card.target = pending.target
    return card
  }
  const combo: Extract<PublicPending, { kind: "combo" }> = { kind: "combo", by: pending.by, cards: facesOf(book, pending.cards) }
  if (pending.target !== undefined) combo.target = pending.target
  if (pending.named !== undefined) combo.named = pending.named
  return combo
}

/** `me` is the viewer when they are playing, `null` otherwise: the window shows a responder whether they passed, and nobody else. */
function publicPhase(book: Book, me: string | null): PublicPhase {
  const { phase } = book.s
  switch (phase.kind) {
    case "reaction": {
      const reaction: Extract<PublicPhase, { kind: "reaction" }> = {
        kind: "reaction",
        pending: publicPending(book, phase.pending),
        nopes: phase.nopes.map(({ card, by }) => ({ card: faceOf(book, card), by })),
        chain: phase.nopes.length,
      }
      if (me !== null && Object.hasOwn(phase.passed, me)) reaction.passed = phase.passed[me] === true
      return reaction
    }
    case "defuse":
      // The Kitten was shown when it was drawn; where it goes back is not in the state at all
      return { kind: "defuse", kitten: faceOf(book, phase.kitten) }
    case "pick":
      return { kind: "pick", played: facesOf(book, phase.played) }
    case "give":
      return { kind: "give", from: phase.from, to: phase.to }
    default:
      return { kind: phase.kind }
  }
}

/**
 * What `viewer` sees of the game: their own hand and the top of the draw pile they know of, the size of every other hand and of
 * the draw pile, the whole discard, and the Nope window with the Nopes played so far (never who passed). Nothing else about
 * another player's cards, the draw pile or the way a Kitten went back.
 *
 * A spectator (`null`), a player who is not at the table and a player who is out all get the same view: the one of a spectator.
 */
export function playerView(rules: Rules, state: State, viewer: string | null): PlayerView {
  const book: Book = { s: state, types: buildCatalogue(rules, state.options) }
  const me = viewer !== null && seatOf(state, viewer) >= 0 && !isOut(state, viewer) ? viewer : null
  return {
    options: { ...state.options },
    me:
      me === null
        ? null
        : {
            id: me,
            hand: facesOf(book, state.hands[seatOf(state, me)]!),
            top: facesOf(book, state.deck.slice(0, state.known[me] ?? 0)),
          },
    players: state.seats.map((id, seat) => ({ id, cards: state.hands[seat]!.length, alive: !isOut(state, id) })),
    deck: state.deck.length,
    discard: facesOf(book, state.discard),
    turn: state.phase.kind === "over" ? null : state.seats[state.turn]!,
    owed: state.owed,
    attacked: state.attacked,
    phase: publicPhase(book, me),
    out: [...state.out],
    results: results(state),
  }
}
