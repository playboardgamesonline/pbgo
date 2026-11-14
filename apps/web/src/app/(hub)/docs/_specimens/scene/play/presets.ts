// The scenes the playground starts from: a coherent table in one press. Each is the base table with some parts switched on, some cards in the hand, some pieces on the cells and a score that has begun, so the first second shows a table that looks played on
// and not a list of components. Plain functions of nothing: every call makes a fresh state.

import type { PlayCard, PlayHeld, PlayPart, PlayState, PlayThing } from "../defaults"
import { cellCentres, planOf } from "./geometry"
import { baseState, deckCard } from "./state"

export const PRESET_IDS = ["card", "board", "trick", "dice", "everything", "empty"] as const
export type PresetId = (typeof PRESET_IDS)[number]
export const DEFAULT_PRESET: PresetId = "card"

export type Preset = { id: PresetId; name: string; summary: string; parts: readonly PlayPart[] }

/** What each scene is and which parts it switches on, for the controls and the docs */
export const PRESETS: Record<PresetId, Preset> = {
  card: { id: "card", name: "Card game", summary: "A ring of four seats, the draw and discard piles, the floor buttons and your hand in the bottom left, like Flip 7.", parts: ["seats", "scoreboard", "piles", "floor", "hand"] },
  board: { id: "board", name: "Board game", summary: "A board in the middle with pawns on its cells to move, dice to roll, a bag to draw from and a counter.", parts: ["board", "dice", "bag", "counter"] },
  trick: { id: "trick", name: "Trick-taking", summary: "Four seats, a trick of four cards in the middle, your hand of seven in the bottom left and the points of each player.", parts: ["seats", "scoreboard", "piles", "hand"] },
  dice: { id: "dice", name: "Dice game", summary: "Five dice and a cup, a sheet of boxes to tick, a timer for each go and the score of three players.", parts: ["dice", "cup", "sheet", "timer", "scoreboard"] },
  everything: { id: "everything", name: "Everything", summary: "The small components on one table as the playground used to start: a board, a track, a counter, a stepper, a slider, a timer, a bag, a cup, dice and fields.", parts: ["board", "track", "counter", "stepper", "slider", "timer", "bag", "cup", "dice", "fields"] },
  empty: { id: "empty", name: "Empty table", summary: "A bare table with the bin: add what you want from the Add and Parts tabs.", parts: [] },
}

const cards = (ids: readonly [id: number, card: number][]): PlayCard[] => ids.map(([id, card]) => ({ id, card }))
const heldCards = (seat: number, firstId: number, count: number): PlayHeld[] => Array.from({ length: count }, (_, k) => ({ id: firstId + k, card: deckCard(firstId + k + seat), seat }))

function withParts(state: PlayState, parts: readonly PlayPart[]): PlayState {
  return { ...state, parts: { ...state.parts, ...Object.fromEntries(parts.map((part) => [part, true])) } }
}

/** The state of a scene, as it starts and as Reset puts it back */
export function presetState(id: PresetId): PlayState {
  const base = baseState()
  const parts = PRESETS[id].parts
  switch (id) {
    case "empty":
      return { ...base, things: [], parts: { ...base.parts } }
    case "everything":
      return withParts(base, parts)
    case "card":
      return withParts(
        {
          ...base,
          things: [],
          players: 4,
          turn: 0,
          layout: { hand: "corner", piles: "middle" },
          hand: { layout: "fan", cards: cards([[7, 3], [8, 9], [9, 14], [10, 18], [11, 23]]) },
          held: [...heldCards(1, 100, 4), ...heldCards(2, 110, 3), ...heldCards(3, 120, 4)],
          piles: { drawn: 14, discard: cards([[130, 5], [131, 27]]) },
          score: { round: 3, points: [3, 0, 7, 0, 0, 0, 0, 0], total: [12, 5, 23, 8, 0, 0, 0, 0] },
          log: ["Camille +7, 7 in round 3", "Round 2 over: Camille leads with 16", "Dealt a round: one card to each of 4 players"],
          zoom: 30,
        },
        parts,
      )
    case "board": {
      const plan = planOf({ shape: "grid", centre: true })
      const centres = cellCentres(plan)
      const on = (id: number, cell: number, paint: number, shape: "pawn" | "cube"): PlayThing => ({ id, kind: "piece", shape, paint, x: centres[cell]!.x, z: centres[cell]!.z, fromBag: false })
      return withParts(
        {
          ...base,
          things: [on(1, 7, 0, "pawn"), on(2, 10, 1, "pawn"), on(3, 25, 2, "pawn"), on(4, 28, 5, "pawn"), on(5, 14, 3, "cube")],
          board: { shape: "grid", centre: true, hops: 0 },
          dice: { shape: "d6", count: 2, values: [4, 3, 1, 6, 2, 4], rolls: 0 },
          counter: 1,
          log: ["Board game: drag a pawn onto a cell, or press Move a piece in the Play tab"],
          zoom: 26,
        },
        parts,
      )
    }
    case "trick": {
      const played: PlayThing[] = [
        { id: 1, kind: "card", card: 31, x: 0, z: 1.3, face: "up" },
        { id: 2, kind: "card", card: 8, x: -1.5, z: -0.2, face: "up" },
        { id: 3, kind: "card", card: 17, x: 0, z: -1.7, face: "up" },
        { id: 4, kind: "card", card: 26, x: 1.5, z: -0.2, face: "up" },
      ]
      return withParts(
        {
          ...base,
          things: played,
          players: 4,
          turn: 2,
          layout: { hand: "corner", piles: "middle" },
          hand: { layout: "fan", cards: cards([[7, 2], [8, 7], [9, 12], [10, 19], [11, 22], [12, 28], [13, 33]]) },
          piles: { drawn: 24, discard: cards([[130, 5], [131, 27], [132, 11]]) },
          score: { round: 2, points: [1, 2, 0, 1, 0, 0, 0, 0], total: [14, 9, 11, 7, 0, 0, 0, 0] },
          log: ["Basile's turn", "Alix +1, 1 in round 2"],
          zoom: 30,
        },
        parts,
      )
    }
    case "dice":
      return withParts(
        {
          ...base,
          things: [],
          players: 3,
          dice: { shape: "d6", count: 5, values: [2, 5, 5, 3, 6, 1], rolls: 0 },
          counter: 0,
          score: { round: 1, points: [0, 0, 0, 0, 0, 0, 0, 0], total: [18, 24, 11, 0, 0, 0, 0, 0] },
          log: ["Dice game: roll the dice, then tick a box of the sheet"],
          zoom: 32,
        },
        parts,
      )
  }
}
