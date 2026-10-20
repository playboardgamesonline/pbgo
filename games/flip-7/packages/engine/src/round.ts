import { reshuffleDiscard } from "@pbgo/engine-kit"
import { isFlip7 } from "./scoring"
import {
  type Ctx,
  effectOf,
  emit,
  faceOf,
  isOver,
  lineOf,
  lineTypes,
  nextActive,
  numbersOf,
  playerAt,
  removeFrom,
  roundScore,
  secondChanceIn,
  targetsOf,
  typeOf,
  winnersOf,
} from "./machine"
import type { FrameOf, Status } from "./types"

/**
 * How a round goes. `run` is the engine: it plays the frames of the stack (see `Frame`) until it needs a player, so a move of a player
 * is "change something, then `run`".
 */

/** Cards a Flip Three makes its target flip. */
const FLIP_THREE = 3

/** A round is a few dozen steps; this only stops a bug from looping for ever. */
const GUARD = 10_000

/** Where a card comes from: a Flip Three defers the Freeze and Flip Three cards it flips (they wait for its three cards to be done). */
export type Source = { how: "deal" } | { how: "hit" } | { how: "flip"; frame: FrameOf<"flip"> }

/** The top card of the draw pile. When it is empty the discard is shuffled into a new one, as the booklet says. `null` when no card is left anywhere. */
function drawCard(ctx: Ctx): number | null {
  const { s } = ctx
  if (s.deck.length === 0) {
    if (s.discard.length === 0) return null
    const piles = reshuffleDiscard({ deck: s.deck, discard: s.discard }, ctx.rng)
    s.deck = piles.deck
    s.discard = piles.discard
    emit(ctx, { kind: "reshuffle" })
  }
  return s.deck.shift() ?? null
}

/** A number card: a duplicate busts, unless a Second Chance cancels it; seven different numbers are a Flip 7 and end the round. */
function takeNumber(ctx: Ctx, seat: number, id: number, value: number): void {
  const { s } = ctx
  const by = playerAt(s, seat)
  const line = lineOf(s, seat)
  if (!numbersOf(s, seat).includes(value)) {
    line.push(id)
    if (isFlip7(lineTypes(s, seat))) {
      s.stats[seat]!.flip7 += 1
      emit(ctx, { kind: "flip7", by })
      endRound(ctx)
    }
    return
  }
  const saver = secondChanceIn(s, seat)
  if (saver !== undefined) {
    removeFrom(line, saver)
    s.discard.unshift(saver, id)
    emit(ctx, { kind: "saved", by, card: faceOf(s, id), secondChance: faceOf(s, saver) })
    return
  }
  line.push(id)
  s.status[seat] = "busted"
  s.stats[seat]!.busts += 1
  emit(ctx, { kind: "bust", by, card: faceOf(s, id) })
}

/**
 * An action card. A Second Chance is kept, unless the player holds one already: then they must give it away. A Freeze or a Flip Three
 * is played right away on a player of their choice, except one flipped during a Flip Three, which waits for the three cards to be done.
 */
function takeAction(ctx: Ctx, seat: number, id: number, source: Source): void {
  const { s } = ctx
  const effect = effectOf(s, id)
  if (effect === "second-chance" && secondChanceIn(s, seat) === undefined) {
    lineOf(s, seat).push(id)
    const by = playerAt(s, seat)
    emit(ctx, { kind: "play", by, target: by, card: faceOf(s, id) })
    return
  }
  if (effect !== "second-chance" && source.how === "flip") {
    source.frame.held.push(id)
    return
  }
  s.stack.push({ kind: "target", seat, card: id })
}

/**
 * Turns the top card of the draw pile over in front of `seat`. If nothing can be drawn, not even from a reshuffled discard, the round
 * ends as if everybody still in had stayed (cannot happen with 18 players or fewer, but the game must not get stuck).
 */
export function receive(ctx: Ctx, seat: number, source: Source): void {
  const { s } = ctx
  const id = drawCard(ctx)
  if (id === null) {
    endRound(ctx)
    return
  }
  emit(ctx, { kind: "draw", by: playerAt(s, seat), card: faceOf(s, id), how: source.how })
  const card = typeOf(s, id)
  switch (card.kind) {
    case "number":
      takeNumber(ctx, seat, id, card.value)
      return
    case "modifier":
      lineOf(s, seat).push(id)
      return
    case "action":
      takeAction(ctx, seat, id, source)
      return
  }
}

/** The holder of an action card gives it to `targetSeat`: it goes in front of them and does what it says. */
export function giveCard(ctx: Ctx, frame: FrameOf<"target">, targetSeat: number): void {
  const { s } = ctx
  if (s.stack.at(-1) !== frame) throw new RangeError("Only the last frame can be settled")
  s.stack.pop()
  lineOf(s, targetSeat).push(frame.card)
  emit(ctx, { kind: "play", by: playerAt(s, frame.seat), target: playerAt(s, targetSeat), card: faceOf(s, frame.card) })
  switch (effectOf(s, frame.card)) {
    case "freeze":
      s.status[targetSeat] = "frozen"
      return
    case "flip-three":
      s.stack.push({ kind: "flip", seat: targetSeat, remaining: FLIP_THREE, held: [] })
      return
    case "second-chance":
      return
  }
}

/** Nobody can get the card: it goes to the discard. */
function discardCard(ctx: Ctx, frame: FrameOf<"target">): void {
  const { s } = ctx
  s.stack.pop()
  s.discard.unshift(frame.card)
  emit(ctx, { kind: "discarded", by: playerAt(s, frame.seat), card: faceOf(s, frame.card) })
}

/**
 * The round is over: everybody still in banks what they hold (the other players of a Flip 7 keep their points), the cards still in
 * the air stay in front of whoever holds them, the points are written down and the deck is handed to the player on the left.
 */
export function endRound(ctx: Ctx): void {
  const { s } = ctx
  for (const frame of s.stack) {
    if (frame.kind === "flip") lineOf(s, frame.seat).push(...frame.held)
    else if (frame.kind === "target") lineOf(s, frame.seat).push(frame.card)
  }
  s.stack = []
  s.status = s.status.map((status): Status => (status === "active" ? "stayed" : status))
  const scores = s.seats.map((_, seat) => roundScore(s, seat))
  s.rounds.push(scores)
  s.dealer = (s.dealer + 1) % s.seats.length
  emit(ctx, { kind: "end", scores })
  if (isOver(s)) emit(ctx, { kind: "over", winners: winnersOf(s) })
}

/**
 * A round starts: the cards of the last one go to the discard, everybody is back in, and the dealer deals. The first turn is the player
 * on the left of the dealer.
 */
export function startRound(ctx: Ctx): void {
  const { s } = ctx
  s.discard = [...s.lines.flat(), ...s.discard]
  s.lines = s.seats.map(() => [])
  s.status = s.seats.map((): Status => "active")
  s.stack = [{ kind: "deal", given: 0 }]
  emit(ctx, { kind: "round", number: s.rounds.length + 1, dealer: playerAt(s, s.dealer) })
  run(ctx)
}

/**
 * Plays the round until it needs a player: their hit or stay (`turn`), or the target of an action card they hold (`target`), unless there
 * is only one possible target, or none: then the engine settles it.
 */
export function run(ctx: Ctx): void {
  const { s } = ctx
  for (let guard = 0; guard < GUARD; guard++) {
    const frame = s.stack.at(-1)
    if (frame === undefined) return
    switch (frame.kind) {
      case "deal": {
        if (frame.given >= s.seats.length) {
          s.stack.pop()
          const first = nextActive(s, s.dealer)
          if (first === null) endRound(ctx)
          else s.stack.push({ kind: "turn", seat: first, acted: false })
          break
        }
        // the player on the left of the dealer first, the dealer last; a player who was frozen on the way gets no card
        const seat = (s.dealer + 1 + frame.given) % s.seats.length
        frame.given += 1
        if (s.status[seat] === "active") receive(ctx, seat, { how: "deal" })
        break
      }
      case "turn": {
        if (!frame.acted) return
        s.stack.pop()
        const next = nextActive(s, frame.seat)
        if (next === null) endRound(ctx)
        else s.stack.push({ kind: "turn", seat: next, acted: false })
        break
      }
      case "flip": {
        if (s.status[frame.seat] === "busted") {
          // out: what they set aside stays in front of them until the round is over
          lineOf(s, frame.seat).push(...frame.held)
          s.stack.pop()
        } else if (frame.remaining > 0) {
          frame.remaining -= 1
          receive(ctx, frame.seat, { how: "flip", frame })
        } else {
          // the three cards are done: the Freeze and Flip Three cards flipped on the way are played now, in the order they came
          const held = frame.held.shift()
          if (held === undefined) s.stack.pop()
          else s.stack.push({ kind: "target", seat: frame.seat, card: held })
        }
        break
      }
      case "target": {
        const targets = targetsOf(s, frame)
        if (targets.length === 0) discardCard(ctx, frame)
        else if (targets.length === 1) giveCard(ctx, frame, targets[0]!)
        else return
        break
      }
    }
  }
  throw new RangeError("The round does not settle")
}
