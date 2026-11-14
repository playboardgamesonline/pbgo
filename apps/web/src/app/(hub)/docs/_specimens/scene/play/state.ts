// What the playground's table holds and every change the controls make to it, as pure functions of the state: add a thing, deal, flip, move a piece, pass the cards, score. The page applies them with `setState`, the shortcuts and the buttons call the same ones, and
// the tests run them. A change that cannot be made (the table is full, the hand is empty) gives the state back untouched.

import { createSaveableRng, emptyDrawing } from "@pbgo/engine-kit"
import {
  BAG_SEED,
  BAG_START,
  DICE_SIDES,
  type DiceShape,
  PLAY_DECK,
  PLAY_LIMITS,
  PLAY_LOG_MAX,
  PLAY_MAP,
  PLAY_NAMES,
  PLAY_NUMBERS,
  PLAY_PART_NAMES,
  PLAY_PLAYERS,
  PLAY_SHEET,
  PLAY_SKETCH,
  PLAY_STACK,
  PLAY_TILES,
  type PlayCard,
  type PlayPart,
  type PlayPiece,
  type PlayPlace,
  type PlayState,
  type PlayThing,
} from "../defaults"
import { BOX, nextFitting, START as FIRST_TILE } from "../landscape"
import { cellAt, cellCentres, neighboursOf, PILE_PLACES_AT, planOf, type Place } from "./geometry"

/** The parts that lie beyond the rest of the table: the camera backs off to at least this distance when one is switched on */
export const BACK_OFF: Partial<Record<PlayPart, number>> = { seats: 28, sketch: PLAY_SKETCH.zoom, hand: 28, piles: 28, stack: 28, paper: 28, map: 32, sheet: PLAY_SHEET.zoom, tiles: PLAY_TILES.zoom, scoreboard: 0, floor: 28 }

/** Where a thing is put when it is added: the first place of a grid in the middle of the table that has nothing near it. */
const SLOTS = Array.from({ length: 24 }, (_, n) => ({ x: -2.4 + (n % 4) * 1.6, z: -2.4 + Math.floor(n / 4) * 2.1 }))

/** What lies in the middle of the table where a new thing should not land: the piles when they are there */
function obstacles(state: PlayState): { x: number; z: number; r: number }[] {
  const found: { x: number; z: number; r: number }[] = []
  if (state.parts.piles && state.layout.piles === "middle") found.push({ ...PILE_PLACES_AT.middle.draw, r: 2.4 }, { ...PILE_PLACES_AT.middle.discard, r: 2.4 })
  if (state.parts.floor && state.layout.piles === "middle") found.push({ x: 0.2, z: 0.4, r: 4 })
  return found
}

export const freeSlot = (state: PlayState): Place =>
  SLOTS.find((slot) => !state.things.some((thing) => Math.hypot(thing.x - slot.x, thing.z - slot.z) < 1) && !obstacles(state).some((o) => Math.hypot(o.x - slot.x, o.z - slot.z) < o.r)) ?? { x: 0, z: 0 }

/** The number the face of the k-th card drawn from the deck is painted from: the 36 numbers come once each before any returns. */
export const deckCard = (k: number) => (k * 7 + 3) % 36

export const rollFor = (shape: DiceShape) => Array.from({ length: PLAY_LIMITS.dice }, () => 1 + Math.floor(Math.random() * DICE_SIDES[shape]))
export const freshBag = () => ({ counts: [...BAG_START], rng: createSaveableRng(BAG_SEED).save(), drawn: 0 })

/** Writes a line at the top of the log, which keeps the newest few */
export const say = (state: PlayState, line: string): PlayState => ({ ...state, log: [line, ...state.log].slice(0, PLAY_LOG_MAX) })

export const nameOf = (seat: number) => PLAY_NAMES[seat] ?? `Player ${seat + 1}`

const zeros = () => Array.from({ length: PLAY_PLAYERS.max }, () => 0)

/** The table as the playground begins, with every part off: a board of the side, a few cards and pieces to move and nothing else. The scenes (`presets.ts`) switch parts on from here. */
export function baseState(): PlayState {
  return {
    things: [
      { id: 1, kind: "card", card: 12, x: -1.6, z: -1.4, face: "up" },
      { id: 2, kind: "card", card: 21, x: 0, z: -1.4, face: "up" },
      { id: 3, kind: "card", card: 30, x: 1.6, z: -1.4, face: "down" },
      { id: 4, kind: "piece", shape: "pawn", paint: 0, x: -1.6, z: 1.6, fromBag: false },
      { id: 5, kind: "piece", shape: "cube", paint: 2, x: 0, z: 1.6, fromBag: false },
      { id: 6, kind: "piece", shape: "disc", paint: 1, x: 1.6, z: 1.6, fromBag: false },
    ],
    nextId: 200,
    selected: null,
    parts: Object.fromEntries(Object.keys(PLAY_PART_NAMES).map((part) => [part, false])) as Record<PlayPart, boolean>,
    counter: 12,
    stepper: PLAY_NUMBERS.stepper.start,
    slider: PLAY_NUMBERS.slider.start,
    clock: { endsAt: null },
    marker: 0,
    cup: "covering",
    dice: { shape: "d6", count: 3, values: [3, 5, 1, 6, 2, 4], rolls: 0 },
    bag: freshBag(),
    text: "",
    bet: null,
    face: null,
    sketch: { strokes: emptyDrawing(), color: 0, width: 1 },
    glow: "halo",
    hand: {
      cards: [
        { id: 7, card: 3 },
        { id: 8, card: 9 },
        { id: 9, card: 14 },
        { id: 10, card: 18 },
        { id: 11, card: 23 },
      ],
      layout: "fan",
    },
    piles: { drawn: 0, discard: [] },
    stack: PLAY_STACK.start,
    presses: 0,
    seat: null,
    map: { claimed: PLAY_MAP.roads.map(() => false), city: null },
    sheet: { marks: Array.from({ length: PLAY_SHEET.columns * PLAY_SHEET.rows }, () => null), mark: "tick" },
    tiles: { laid: [FIRST_TILE], index: nextFitting([FIRST_TILE], BOX, 0, PLAY_TILES.table), spin: 0 },
    players: 4,
    board: { shape: "grid", centre: false, hops: 0 },
    layout: { hand: "edge", piles: "edge" },
    turn: 0,
    score: { round: 1, points: zeros(), total: zeros() },
    held: [],
    floor: { zones: true, disabled: false },
    log: [],
    above: false,
    zoom: PLAY_LIMITS.zoom.start,
    tilt: PLAY_LIMITS.tilt.start,
  }
}

/** The parts switched on or off together. Switching a part on backs the camera off far enough to see it, and parts that lean on one another come with it: the floor buttons sit beside the draw pile in the middle of the table */
export function showParts(state: PlayState, parts: readonly PlayPart[], on: boolean): PlayState {
  let next: PlayState = { ...state, parts: { ...state.parts, ...Object.fromEntries(parts.map((part) => [part, on])) } }
  if (on) {
    const farthest = Math.max(0, ...parts.map((part) => BACK_OFF[part] ?? 0))
    if (farthest > state.zoom) next = { ...next, zoom: Math.min(farthest, PLAY_LIMITS.zoom.max + 8) }
    if (parts.includes("floor")) next = { ...next, parts: { ...next.parts, piles: true }, layout: { ...next.layout, piles: "middle" } }
  }
  return next
}

/** Sends card `id`, wherever it lies (the table, the hand, the discard pile), to `to`. A card that has nowhere to go, because the hand or the table is full, stays where it is. */
export function sendCard(now: PlayState, id: number, to: PlayPlace, at: Place = { x: 0, z: 0 }): PlayState {
  const onTable = now.things.find((one) => one.id === id && one.kind === "card")
  const inHand = now.hand.cards.find((one) => one.id === id)
  const onDiscard = now.piles.discard.find((one) => one.id === id)
  const card = onTable?.kind === "card" ? onTable.card : (inHand ?? onDiscard)?.card
  if (card === undefined) return now
  const where = onTable ? "table" : inHand ? "hand" : "discard"
  if (to === where && to !== "table") return now
  if (to === "table" && where === "table") return { ...now, things: now.things.map((one) => (one.id === id ? { ...one, x: at.x, z: at.z } : one)) }
  if (to === "hand" && now.hand.cards.length >= PLAY_DECK.hand) return now
  if (to === "table" && now.things.length >= PLAY_LIMITS.things) return now
  const entry: PlayCard = { id, card }
  const things = now.things.filter((one) => one.id !== id)
  return {
    ...now,
    things: to === "table" ? [...things, { id, kind: "card", card, x: at.x, z: at.z, face: "up" }] : things,
    selected: to === "table" || now.selected !== id ? now.selected : null,
    hand: { ...now.hand, cards: [...now.hand.cards.filter((one) => one.id !== id), ...(to === "hand" ? [entry] : [])] },
    piles: { ...now.piles, discard: [...now.piles.discard.filter((one) => one.id !== id), ...(to === "discard" ? [entry] : [])] },
  }
}

/** The top card of the draw pile is dealt: to the hand when the hand is on and has room, otherwise onto the table. */
export function deal(now: PlayState): PlayState {
  if (now.piles.drawn >= PLAY_DECK.size) return now
  const id = now.nextId
  const card = deckCard(now.piles.drawn)
  // The draw pile held this many cards, which is where the card flies in from
  const from = PLAY_DECK.size - now.piles.drawn
  const piles = { ...now.piles, drawn: now.piles.drawn + 1 }
  if (now.parts.hand && now.hand.cards.length < PLAY_DECK.hand) return say({ ...now, nextId: id + 1, piles, hand: { ...now.hand, cards: [...now.hand.cards, { id, card, from }] } }, "Dealt a card to the hand")
  if (now.things.length >= PLAY_LIMITS.things) return now
  const at = freeSlot(now)
  return say({ ...now, nextId: id + 1, piles, things: [...now.things, { id, kind: "card", card, x: at.x, z: at.z, face: "up", from }] }, "Dealt a card to the table")
}

/** The top card of the draw pile goes to a seat: the viewer's (seat 0) hand, or the cards another seat holds face down */
export function giveTo(now: PlayState, seat: number, quiet = false): PlayState {
  const log = (state: PlayState, line: string) => (quiet ? state : say(state, line))
  if (now.piles.drawn >= PLAY_DECK.size || seat >= now.players) return now
  const id = now.nextId
  const card = deckCard(now.piles.drawn)
  const from = PLAY_DECK.size - now.piles.drawn
  const piles = { ...now.piles, drawn: now.piles.drawn + 1 }
  if (seat === 0) {
    if (now.hand.cards.length >= PLAY_DECK.hand) return now
    return log({ ...now, nextId: id + 1, piles, hand: { ...now.hand, cards: [...now.hand.cards, { id, card, from }] } }, `Gave a card to ${nameOf(0)}`)
  }
  if (now.held.filter((one) => one.seat === seat).length >= HELD_MOST) return now
  return log({ ...now, nextId: id + 1, piles, held: [...now.held, { id, card, seat, from }] }, `Gave a card to ${nameOf(seat)}`)
}

/** The most cards a seat holds face down */
export const HELD_MOST = 7

/** A round of dealing: one card to every seat, from the draw pile, the viewer's first */
export function dealRound(now: PlayState): PlayState {
  let next = now
  for (let seat = 0; seat < now.players; seat++) next = giveTo(next, seat, true)
  return next === now ? now : say(next, `Dealt a round: one card to each of ${now.players} players`)
}

/** The top piece of the stack is taken onto the table. */
export function take(now: PlayState): PlayState {
  if (now.stack === 0 || now.things.length >= PLAY_LIMITS.things) return now
  const at = freeSlot(now)
  return say({ ...now, nextId: now.nextId + 1, stack: now.stack - 1, things: [...now.things, { id: now.nextId, kind: "piece", shape: "disc", paint: 2, x: at.x, z: at.z, fromBag: false, fromStack: now.stack }] }, "Took a piece off the stack")
}

/** Turns a card of the table over: the one that is picked, or else the first on the table. With none on the table a card comes face down from the draw pile, to turn on the next press. */
export function flip(now: PlayState): PlayState {
  const picked = now.things.find((one) => one.id === now.selected && one.kind === "card")
  const card = picked ?? now.things.find((one) => one.kind === "card")
  if (card?.kind !== "card") {
    if (now.things.length >= PLAY_LIMITS.things) return now
    const at = freeSlot(now)
    const id = now.nextId
    return say({ ...now, nextId: id + 1, things: [...now.things, { id, kind: "card", card: deckCard(now.piles.drawn), x: at.x, z: at.z, face: "down" }] }, "Laid a card face down: press again to turn it")
  }
  return say({ ...now, things: now.things.map((one) => (one.id === card.id && one.kind === "card" ? { ...one, face: one.face === "up" ? "down" : "up" } : one)) }, `Turned a card ${card.face === "up" ? "face down" : "face up"}`)
}

/** Moves a piece to a cell next to the one it stands on, the next free one in turn. A piece that is off the board is put on a cell first: the first free one. */
export function movePiece(now: PlayState): PlayState {
  const plan = planOf(now.board)
  const centres = cellCentres(plan)
  const taken = (cell: number) => now.things.some((one) => cellAt(centres, one, plan.size * 0.45) === cell)
  const pieces = now.things.filter((one) => one.kind === "piece")
  const picked = pieces.find((one) => one.id === now.selected)
  const pool = picked ? [picked] : pieces
  const onBoard = pool.find((one) => cellAt(centres, one, plan.size * 0.45) >= 0)
  const piece = onBoard ?? pool[0]
  if (!piece) return now
  const from = cellAt(centres, piece, plan.size * 0.45)
  const free = (from >= 0 ? neighboursOf(plan.shape, from) : centres.map((_, i) => i)).filter((cell) => !taken(cell))
  const to = free[now.board.hops % Math.max(1, free.length)]
  const target = to === undefined ? undefined : centres[to]
  if (!target) return now
  return say({ ...now, board: { ...now.board, hops: now.board.hops + 1 }, things: now.things.map((one) => (one.id === piece.id ? { ...one, x: target.x, z: target.z } : one)) }, from >= 0 ? `Moved a ${piece.kind === "piece" ? piece.shape : "piece"} from cell ${from + 1} to cell ${(to ?? 0) + 1}` : `Put a piece on cell ${(to ?? 0) + 1}`)
}

/** The last card of the hand goes to the discard pile */
export function discardOne(now: PlayState): PlayState {
  const card = now.hand.cards.at(-1)
  if (!card) return now
  return say(sendCard(now, card.id, "discard"), "Discarded a card from the hand")
}

/** The last card of the hand is played onto the table, where nothing lies */
export function playFromHand(now: PlayState): PlayState {
  const card = now.hand.cards.at(-1)
  if (!card || now.things.length >= PLAY_LIMITS.things) return now
  return say(sendCard(now, card.id, "table", freeSlot(now)), "Played a card from the hand to the table")
}

/** Every seat passes a card to the next: the viewer's last card of the hand goes to seat 1, a card face down of seat 1 to seat 2, and the last seat's to the viewer's hand */
export function passCards(now: PlayState): PlayState {
  const players = now.players
  if (players < 2) return now
  const moving: { card: PlayCard & { seat: number }; from: number }[] = []
  for (let seat = 0; seat < players; seat++) {
    const own = seat === 0 ? now.hand.cards.at(-1) : now.held.filter((one) => one.seat === seat).at(-1)
    if (own) moving.push({ card: { id: own.id, card: own.card, seat: (seat + 1) % players }, from: seat })
  }
  if (moving.length === 0) return now
  const gone = new Set(moving.map((one) => one.card.id))
  let hand = now.hand.cards.filter((one) => !gone.has(one.id))
  const held = now.held.filter((one) => !gone.has(one.id))
  for (const { card } of moving) {
    if (card.seat === 0) hand = [...hand, { id: card.id, card: card.card }]
    else held.push({ id: card.id, card: card.card, seat: card.seat })
  }
  return say({ ...now, hand: { ...now.hand, cards: hand }, held }, `Passed ${moving.length} ${moving.length === 1 ? "card" : "cards"} to the next seat`)
}

/** The turn goes to the next seat */
export const nextTurn = (now: PlayState): PlayState => say({ ...now, turn: (now.turn + 1) % now.players }, `${nameOf((now.turn + 1) % now.players)}'s turn`)

/** A seat scores points in the round */
export function addPoints(now: PlayState, seat: number, points: number): PlayState {
  if (seat < 0 || seat >= PLAY_PLAYERS.max) return now
  const next = Math.max(0, (now.score.points[seat] ?? 0) + points)
  if (next === now.score.points[seat]) return now
  return say({ ...now, score: { ...now.score, points: now.score.points.map((had, i) => (i === seat ? next : had)) } }, `${nameOf(seat)} ${points > 0 ? "+" : "−"}${Math.abs(points)}, ${next} in round ${now.score.round}`)
}

/** The round ends: its points are banked into the totals and the next round begins with the turn passing on */
export function endRound(now: PlayState): PlayState {
  const total = now.score.total.map((had, i) => had + (now.score.points[i] ?? 0))
  const lead = total.slice(0, now.players).reduce((best, value, i) => (value > (total[best] ?? 0) ? i : best), 0)
  return say({ ...now, turn: (now.turn + 1) % now.players, score: { round: now.score.round + 1, points: zeros(), total } }, `Round ${now.score.round} over: ${nameOf(lead)} leads with ${total[lead]}`)
}

export const resetScores = (now: PlayState): PlayState => say({ ...now, score: { round: 1, points: zeros(), total: zeros() } }, "Scores back to zero")

/** The seat with the most points, banked and in the round, among those who play, or null while nobody has any */
export function leader(now: Pick<PlayState, "players" | "score">): number | null {
  const sums = now.score.total.slice(0, now.players).map((total, i) => total + (now.score.points[i] ?? 0))
  const best = Math.max(...sums)
  return best > 0 ? sums.indexOf(best) : null
}

/** Adds a card, or a piece of a shape, in a free place */
export function addThing(now: PlayState, make: (id: number, at: Place) => PlayThing): PlayState {
  if (now.things.length >= PLAY_LIMITS.things) return now
  return { ...now, things: [...now.things, make(now.nextId, freeSlot(now))], nextId: now.nextId + 1 }
}
export const newCard = (id: number, at: Place): PlayThing => ({ id, kind: "card", card: (id * 7) % 36, x: at.x, z: at.z, face: "up" })
export const newPiece = (shape: PlayPiece) => (id: number, at: Place): PlayThing => ({ id, kind: "piece", shape, paint: id % 6, x: at.x, z: at.z, fromBag: false })

/** Takes the thing that is picked off the table */
export const removeThing = (now: PlayState, id: number): PlayState => ({ ...now, things: now.things.filter((one) => one.id !== id), selected: now.selected === id ? null : now.selected })

/** Changes the shape or the place of the board: what stood on a cell stands on the cell with the same number of the new board (the last one when it has fewer) */
export function reshapeBoard(now: PlayState, change: Partial<Pick<PlayState["board"], "shape" | "centre">>): PlayState {
  const board = { ...now.board, ...change }
  const [before, after] = [planOf(now.board), planOf(board)]
  const [from, to] = [cellCentres(before), cellCentres(after)]
  const things = now.things.map((thing) => {
    const cell = cellAt(from, thing, before.size * 0.45)
    const target = cell < 0 ? undefined : to[Math.min(cell, to.length - 1)]
    return target ? { ...thing, x: target.x, z: target.z } : thing
  })
  return { ...now, board, things }
}
