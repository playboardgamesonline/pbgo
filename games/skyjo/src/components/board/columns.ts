import { COLUMNS, type PublicCell, ROWS } from "@skyjo/engine"
import { CARD_SETTINGS, inFrame, onTable, type Pose, type SequenceStep } from "@pbgo/table"
import { Quaternion, Vector3 } from "three"
import { columnSpot, type SeatLayout } from "./layout"
import type { Removal } from "./pacing"

/**
 * What the board does when a column of three equal cards is thrown away, as numbers: which columns a grid lays out, the stack the three cards make and the flight of that stack to the discard, and the film of the whole move, which part of each column is on
 * when. No React and no three.js scene here: `scene.tsx` draws it, `thrown-column.tsx` flies the stack.
 */

/** The columns of a grid that are laid out, in order: those that still have a card in the view, and those whose removal is still on its way (their cards lie in the grid, or their room is kept, until the grid closes over the gap) */
export function shownColumns(cells: readonly PublicCell[], pending: readonly number[] = []): number[] {
  return Array.from({ length: COLUMNS }, (_, column) => column).filter((column) => pending.includes(column) || cells.slice(column * ROWS, (column + 1) * ROWS).some((cell) => cell !== null))
}

/** The three cells of a column thrown away as they lay in the grid before it went: face up, the card of each row from the log (`cards[row]`), at their positions */
export function restoredCells({ column, cards }: Pick<Removal, "column" | "cards">): { cell: Extract<PublicCell, { up: true }>; position: number }[] {
  return cards.map((card, row) => ({ cell: { up: true, card }, position: column * ROWS + row }))
}

/**
 * What the three cards of a column are doing while it is thrown away:
 * - `waiting`: they lie in their cells, as they did before the move, until it is the turn of this column
 * - `gathering`: they slide together into a stack
 * - `travelling`: the stack flies to the discard
 * - `landed`: the stack lies on the discard
 * The gap the column leaves is closed apart from that (`closed`): the columns left slide together, and the grid is centred in its seat zone again.
 */
export type Stage = "waiting" | "gathering" | "travelling" | "landed"

/** What every column thrown away by the move `v` is doing, by its place in `removals` */
export type RemovalState = { v: number; stages: Stage[]; closed: boolean[] }

/**
 * The film of a move that throws columns away, as the steps of a sequence (`useSequence` of the table kit): each column in its turn gathers, flies, has the gap closed and lands, at the seconds its timing says. `start` is what is on the table when the move
 * arrives, every column where it lay, and `final` is where it ends, which is what a table that is opened or reloaded shows and what a visitor who asks for less motion gets at once.
 */
export function removalSequence(v: number, removals: readonly Removal[]): { start: RemovalState; final: RemovalState; steps: SequenceStep<RemovalState>[] } {
  const start: RemovalState = { v, stages: removals.map((): Stage => "waiting"), closed: removals.map(() => false) }
  const final: RemovalState = { v, stages: removals.map((): Stage => "landed"), closed: removals.map(() => true) }
  type Turn = { at: number; k: number; stage?: Stage; closed?: true }
  const turns = removals.flatMap((removal, k): Turn[] => {
    const { hold, gather, closeAt, travel } = removal.timing
    const gathering = removal.at + hold
    const travelling = gathering + gather
    return [
      { at: gathering, k, stage: "gathering" },
      { at: travelling, k, stage: "travelling" },
      { at: travelling + closeAt, k, closed: true },
      { at: travelling + travel, k, stage: "landed" },
    ]
  })
  // the sort is stable: two things at the same moment happen in the order they are listed in
  turns.sort((a, b) => a.at - b.at)
  const steps: SequenceStep<RemovalState>[] = []
  let now = start
  for (const turn of turns) {
    const stages = [...now.stages]
    const closed = [...now.closed]
    if (turn.stage) stages[turn.k] = turn.stage
    if (turn.closed) closed[turn.k] = true
    now = { ...now, stages, closed }
    steps.push([Math.round(turn.at * 1000), { stages, closed }])
  }
  return { start, final, steps }
}

/**
 * The stack the three cards of a column make: on the slot of the middle row of the column, each a little above the one under it, the card of the first row on top, which is how they lie on the discard when they land (`cards[0]` is its top). The cards lean a hair
 * each, a different way, so that the stack reads as three cards and not as one. In the frame of the seat; `shown` are the columns laid out while it forms (the column is among them).
 */
export const STACK = { y: 0.1, step: 0.045, lean: 0.05 }

export function stackPoses(column: number, scale: number, shown: readonly number[]): Pose[] {
  const x = columnSpot(column, scale, shown)
  return Array.from({ length: ROWS }, (_, row) => onTable(x, 0, { y: STACK.y + (ROWS - 1 - row) * STACK.step, face: "up", scale, lean: `stack-${row}`, leanAmplitude: STACK.lean }))
}

/** A place in the world */
export type Vec = { x: number; y: number; z: number }

/** The flight of a stack from where it forms to where it lands: its path, how far it turns and how much bigger it gets on the way, the card scale of the grid it left to the card scale of the discard */
export type Flight = { start: Vec; end: Vec; lift: number; turn: number; grow: number }

/** An angle brought to (-π, π] */
const wrap = (angle: number) => Math.atan2(Math.sin(angle), Math.cos(angle))

/**
 * The flight of the stack of a column from `start`, the place its bottom card lies at, to `end`, where the bottom card of the stack lies on the discard. It rises on a curve like the flight of a card (its height is that of a card's over the same distance, and follows
 * the same setting), turns from the way its seat faces (`yaw`) to the way the discard faces, and grows from the scale of the cards of the grid to that of the discard. All three cards are given the same move (`stackAt`), so the stack stays a stack on the way.
 */
export function flightOf(start: Vec, end: Vec, { yaw, scaleFrom, scaleTo }: { yaw: number; scaleFrom: number; scaleTo: number }): Flight {
  const distance = Math.hypot(end.x - start.x, end.z - start.z)
  return { start, end, lift: Math.min(5.5, 1.8 + distance * 0.3) * CARD_SETTINGS.flightHeight, turn: -wrap(yaw), grow: scaleTo / scaleFrom }
}

/** Where the stack is on its way, `e` from 0 (set out) to 1 (landed) after the easing: its position, how far it has turned about the vertical axis and its scale as a multiple of the one it set out with. The curve is a cubic Bézier with its controls above both ends */
export function flightAt({ start, end, lift, turn, grow }: Flight, e: number, out: Vec & { yaw: number; scale: number }): void {
  const m = 1 - e
  const toward = 3 * m * e * e + e * e * e
  const away = m * m * m + 3 * m * m * e
  out.x = away * start.x + toward * end.x
  out.z = away * start.z + toward * end.z
  out.y = m * m * m * start.y + 3 * m * m * e * (start.y + lift) + 3 * m * e * e * (end.y + lift * 0.85) + e * e * e * end.y
  out.yaw = turn * e
  out.scale = 1 + (grow - 1) * e
}

/** Where a stack lands on the discard: the place of the pile and the height of the card it lies on, and the scale of the cards of the pile */
export type Landing = { x: number; y: number; z: number; scale: number }

/** What a stack is made of, worked out once when it forms: the world poses of its three cards (by row), the place its bottom card is at, and its flight to the discard. It does not follow the grid after that: the grid closing over the gap does not move a stack that is on its way */
export type StackPlan = { poses: Pose[]; pivot: Vec; flight: Flight }

export function stackPlan(seat: SeatLayout, column: number, shown: readonly number[], landing: Landing): StackPlan {
  const poses = stackPoses(column, seat.scale, shown).map((pose) => inFrame(seat.frame, pose))
  // the bottom card is the one of the last row: the stack sets out from its place, and every card of the stack is laid round it
  const { x, y, z } = poses[ROWS - 1]!.position
  const pivot = { x, y, z }
  return { poses, pivot, flight: flightOf(pivot, { x: landing.x, y: landing.y, z: landing.z }, { yaw: seat.frame.yaw, scaleFrom: seat.scale, scaleTo: landing.scale }) }
}

const UP = new Vector3(0, 1, 0)

/**
 * The poses of the three cards of a stack when its flight has gone `e` of its way (0 to 1, after the easing): the cards as they lie at the start, moved with the stack, turned about its bottom card and grown. The cards are laid in their places
 * each time, and each glides to its place as any card does, so the stack stays a stack on the way: they are all given the same move.
 */
export function stackAt({ poses, pivot, flight }: StackPlan, e: number): Pose[] {
  const at = { x: 0, y: 0, z: 0, yaw: 0, scale: 1 }
  flightAt(flight, e, at)
  const turn = new Quaternion().setFromAxisAngle(UP, at.yaw)
  return poses.map((pose) => ({
    position: pose.position
      .clone()
      .sub(new Vector3(pivot.x, pivot.y, pivot.z))
      .multiplyScalar(at.scale)
      .applyQuaternion(turn)
      .add(new Vector3(at.x, at.y, at.z)),
    quaternion: turn.clone().multiply(pose.quaternion),
    scale: pose.scale * at.scale,
  }))
}
