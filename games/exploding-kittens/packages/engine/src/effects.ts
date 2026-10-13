import { shuffle } from "@pbgo/engine-kit"
import { type Effect, emit, endTurn, facesOf, hasCards, nextLiving, reissueAll, startTurn } from "./machine"

/**
 * What each action card does, by the `effect` key of its card type. They run when the card resolves, that is once its Nope
 * window has closed without cancelling it (a Noped card does nothing at all).
 *
 * A card that does something new is a new entry here; if it needs a choice from a player that the game has no step for, that
 * choice is a new `Phase` in `types.ts` (see Favor, which hands the turn to the target).
 */
export const EFFECTS: Record<string, Effect> = {
  /**
   * The turn ends without drawing and the next player takes 2 turns. Attacks stack: aimed at a player who was attacked, the next
   * one takes 2 more than what the attacked player still owed.
   */
  attack: {
    resolve(ctx, { by }) {
      const { s } = ctx
      const owed = s.attacked ? s.owed + 2 : 2
      s.stats[s.turn]!.turns += 1
      const next = nextLiving(s, s.turn)
      emit(ctx, { kind: "attack", by, next: s.seats[next]!, owed })
      startTurn(ctx, next, owed, true)
    },
  },

  /** One turn ends without drawing. */
  skip: {
    resolve(ctx, { by }) {
      emit(ctx, { kind: "skip", by })
      endTurn(ctx)
    },
  },

  /** The target chooses a card of their hand and gives it to the player. Nothing happens if their hand is empty by then. */
  favor: {
    targeted: true,
    resolve(ctx, { by, target }) {
      const { s } = ctx
      if (!hasCards(s, target)) {
        emit(ctx, { kind: "fizzled", by })
        return
      }
      emit(ctx, { kind: "ask", by, from: target })
      s.phase = { kind: "give", from: target, to: by }
    },
  },

  /** The draw pile is shuffled. Its cards come out under new ids and nobody knows its top any more. */
  shuffle: {
    resolve(ctx, { by }) {
      const { s } = ctx
      s.deck = shuffle(reissueAll(ctx, s.deck), ctx.rng)
      s.known = {}
      emit(ctx, { kind: "shuffle", by })
    },
  },

  /** The player looks at the top 3 cards of the draw pile (fewer when there are fewer): nobody else does. */
  "see-the-future": {
    resolve(ctx, { by }) {
      const { s } = ctx
      const seen = s.deck.slice(0, 3)
      if (seen.length > 0) s.known[by] = seen.length
      else delete s.known[by]
      emit(ctx, { kind: "see", by, count: seen.length, cards: facesOf(ctx, seen) }, [by], { kind: "see", by, count: seen.length })
    },
  },
}
