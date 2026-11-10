import { fan, inFrame, onTable, type Pose, RESTING_HEIGHT, row, seats as ringOf, shifted, type Spot } from "@pbgo/table"

/** A seat at the table: where it stands and the yaw that sends what lies there away from the middle */
export type SeatSpot = Required<Spot>

export const LAYOUT_SETTINGS = {
  radiusX: 7.4,
  radiusZ: 4.4,
  handZ: 6.1,
  handY: 1.1,
  handTilt: 0.62,
  handGap: 1.05,
  handScale: 1.2,
  hoverLift: 0.45,
  trickGap: 0.3,
}

/** The seat of each player: the viewer in front, the others around the far half in turn order */
export function seats(ids: string[], meId: string | null): Map<string, SeatSpot> {
  const R = LAYOUT_SETTINGS
  const viewer = ids.indexOf(meId ?? "")
  const ring = ringOf(ids.length, { radiusX: R.radiusX, radiusZ: R.radiusZ, me: viewer < 0 ? null : viewer })
  return new Map(ids.map((id, i): [string, SeatSpot] => [id, ring[i]]))
}

/** The slots of a hand of `n` cards, a fan in front of the viewer. The card at index `raised` (-1: none) lifts toward them */
export function handLayout(n: number, raised: number): Pose[] {
  const R = LAYOUT_SETTINGS
  const slots = fan(n, { gap: R.handGap, y: R.handY, rise: 0.004, z: R.handZ, curve: 0.06, tilt: R.handTilt, roll: 0.05, scale: R.handScale })
  return slots.map((slot, i) => (i === raised ? shifted(slot, { y: R.hoverLift, z: -0.25 }) : slot))
}

/** The frame of an opponent's cards: just beyond their seat, turned like it */
export function backFrame(seat: SeatSpot): Spot {
  return { x: seat.x * 1.08, z: seat.z * 1.08, yaw: seat.yaw }
}

/** The backs of an opponent's `n` cards: a row in the frame of their seat, each card rolled by the seat's yaw plus a half turn as they have always been drawn (`turn` cancels the frame's yaw to get there) */
export function backLayout(seat: SeatSpot, n: number): Pose[] {
  return row(n, { gap: 0.32, y: 0.02, rise: 0.004, face: "down", turn: -(2 * seat.yaw + Math.PI), scale: 0.62 })
}

/** Where the back of card `i` of an opponent's `n` lies on the table: the card they play flies from there */
export function backPose(seat: SeatSpot, i: number, n: number): Pose {
  return inFrame(backFrame(seat), backLayout(seat, n)[i])
}

/** A card played to the middle: on the line to its player's seat, a hair off true by its rank */
export function trickPose(seat: SeatSpot, rank: number): Pose {
  const R = LAYOUT_SETTINGS
  return onTable(seat.x * R.trickGap, seat.z * R.trickGap, { y: RESTING_HEIGHT + rank * 0.012, yaw: seat.yaw + ((rank * 37) % 11) * 0.02 - 0.1 })
}

/** A won trick, shrunk to a small stack beside the winner's seat */
export function collectedPose(seat: SeatSpot): Pose {
  return onTable(seat.x * 1.05, seat.z * 1.05, { y: 0.04, yaw: seat.yaw, scale: 0.35 })
}

/** The hourglass of the clock: where it stands, in the corner by the viewer's hand where no seat is (the seats keep to the far half of the ring) and past the end of the row of bid cards, and how tall it is */
export const CLOCK = { at: { x: 7.4, z: 2.4 }, size: 2 }

/**
 * The bid cards. While the players bid, the viewer has a row of them across the middle of the table, one for each bid they may make (from none to one for each card of their hand): they are smaller than the cards of the hand, since a row of up to eleven
 * must fit. `toward` is how far along the line from a seat to the middle of the table a bid lies once it is made.
 */
export const BID = { scale: 0.7, gap: 1.05, z: 0.9, hover: 0.3, toward: 0.7 }

/** Where bid card `k` of `count` lies while it waits to be chosen: in the row across the middle, the lowest on the left. Raised, and nearer the viewer, when the pointer is over it */
export function bidRowPose(k: number, count: number, raised = false): Pose {
  const pose = onTable((k - (count - 1) / 2) * BID.gap, BID.z, { scale: BID.scale })
  return raised ? shifted(pose, { y: BID.hover, z: 0.2 }) : pose
}

/** Where the bid of a player lies once it is made: on the line from their seat to the middle of the table, turned as the seat is, face up when it can be read and face down while it is secret */
export function bidPose(seat: SeatSpot, up: boolean): Pose {
  return onTable(seat.x * BID.toward, seat.z * BID.toward, { face: up ? "up" : "down", yaw: seat.yaw, scale: BID.scale })
}

/** Where the cards are dealt from: above the middle of the table, face down */
export const DECK_POSE = onTable(0, -0.5, { y: 3.2, face: "down", scale: 0.9 })
