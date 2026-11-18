import { fan, frameBoxOfPoses, heldLeftPose, joinBoxes, onTable, type Pose, RESTING_HEIGHT, SCREEN_HAND_SETTINGS, seats as ringOf, shifted, type Spot, type TableBox } from "@pbgo/table"
import { CAMERA } from "./camera"
import { CARD_SIZE } from "./textures"

/** A seat at the table: where it stands and the yaw that turns what lies there to face the middle, as the player who sits there sees it: the viewer's seat is at yaw 0, the one across at half a turn */
export type SeatSpot = Required<Spot>

export const LAYOUT_SETTINGS = {
  radiusX: 7.4,
  radiusZ: 4.4,
  /** An opponent's hand, held up in a fan that stands: how far beyond its seat it stands (a share of the ring), how far apart its cards are, how big they are, how high the middle of a card stands, how they are turned about their own axis, and how they lean (toward the middle of the table, from standing straight): the least for a seat the viewer sees from the front, the most for a seat at the side, which the viewer sees edge on */
  heldReach: 1.2,
  heldGap: 0.3,
  heldScale: 0.68,
  heldY: 0.66,
  heldRoll: 0.12,
  heldTilt: -1.25,
  heldSideTilt: -1.0,
  /** How far a card played to the middle lies toward the middle from its seat, as a share of the way */
  trickGap: 0.3,
}

/** The viewer's hand, held at the bottom left of the screen as Courtisans holds its own: its numbers, but for the room it may take, which stops short of the viewer's name in the middle of the front of the table, whatever the size of the hand */
export const HAND_SETTINGS = { ...SCREEN_HAND_SETTINGS, room: 0.42 }

/** The seat of each player: the viewer in front, the others around the far half in turn order, each turned toward the middle */
export function seats(ids: string[], meId: string | null): Map<string, SeatSpot> {
  const R = LAYOUT_SETTINGS
  const viewer = ids.indexOf(meId ?? "")
  const ring = ringOf(ids.length, { radiusX: R.radiusX, radiusZ: R.radiusZ, me: viewer < 0 ? null : viewer })
  return new Map(ids.map((id, i): [string, SeatSpot] => [id, ring[i]]))
}

/** The most cards a hand holds: the greatest `handSize` the demo's engine allows */
export const HAND_MAX = 8

/** Whether a seat is the viewer's: the ring keeps the viewer in front (z > 0) and every other seat on its far half */
export const isViewerSeat = (seat: SeatSpot) => seat.z > 0

/** The frame of an opponent's hand: just beyond their seat on the ring, turned like it, so that the top of the frame is toward the middle of the table */
export function heldFrame(seat: SeatSpot): SeatSpot {
  const R = LAYOUT_SETTINGS
  return { x: seat.x * R.heldReach, z: seat.z * R.heldReach, yaw: seat.yaw }
}

/**
 * The cards of an opponent's hand of `n`, a fan in the frame of their seat (`heldFrame`): they stand up, backs to the viewer, and open as a hand does. A seat the viewer sees from the front (across the table) has them nearly straight; a seat at the side, which the viewer sees edge on, has them lean
 * toward the middle so that their backs show. Their round shadow lies under them (`HELD_SHADOW`)
 */
export function heldLayout(n: number, yaw = 0): Pose[] {
  const R = LAYOUT_SETTINGS
  const tilt = R.heldTilt + (R.heldSideTilt - R.heldTilt) * Math.abs(Math.sin(yaw))
  return fan(n, { gap: R.heldGap, y: R.heldY, rise: 0.004, curve: 0.08, tilt, roll: R.heldRoll, face: "down", scale: R.heldScale })
}

/** How far the round shadow under an opponent's hand of `n` reaches, and how dark it is: a small pool under the fan, which grows with the cards */
export const HELD_SHADOW = { radius: (n: number) => 0.6 + 0.13 * Math.min(n, HAND_MAX), opacity: 0.55 }

/** The box of an opponent's cards in the frame of their seat, which their plate stands beyond: a hand of every size from one card to `HAND_MAX` together, as the camera sees it */
export function heldBox(seat: SeatSpot): TableBox {
  return joinBoxes(Array.from({ length: HAND_MAX }, (_, i) => frameBoxOfPoses(heldLayout(i + 1, seat.yaw), CARD_SIZE, heldFrame(seat), { tilt: CAMERA.tilt })))!
}

/** Where a card played from an opponent's hand of `count` flies from: the left end of the fan, as the viewer sees it (`heldLeftPose`), the hand still the size it was */
export function heldFrom(seat: SeatSpot, count: number): Pose {
  return heldLeftPose(heldFrame(seat), (n) => heldLayout(n, seat.yaw), count)
}

/** The turn of what a player has played to the middle: upright for the viewer, a little turned toward the seat it comes from */
const playedYaw = (seat: SeatSpot) => (isViewerSeat(seat) ? seat.yaw : seat.yaw + Math.PI)

/** A card played to the middle: on the line to its player's seat, a hair off true by its rank */
export function trickPose(seat: SeatSpot, rank: number): Pose {
  const R = LAYOUT_SETTINGS
  return onTable(seat.x * R.trickGap, seat.z * R.trickGap, { y: RESTING_HEIGHT + rank * 0.012, yaw: playedYaw(seat) + ((rank * 37) % 11) * 0.02 - 0.1 })
}

/** A won trick, shrunk to a small stack beside the winner's seat */
export function collectedPose(seat: SeatSpot): Pose {
  return onTable(seat.x * 1.05, seat.z * 1.05, { y: 0.04, yaw: playedYaw(seat), scale: 0.35 })
}

/** The hourglass of the clock: where it stands, in the corner by the viewer's seat where no seat is (the seats keep to the far half of the ring) and past the end of the row of bid cards, and how tall it is */
export const CLOCK = { at: { x: 7.4, z: 2.4 }, size: 2 }

/**
 * The bid cards. While the players bid, the viewer has a row of them across the middle of the table, one for each bid they may make (from none to one for each card of their hand): they are smaller than the cards of the hand, since a row of up to eleven
 * must fit. `toward` is how far along the line from a seat to the middle of the table a bid lies once it is made.
 */
export const BID = { scale: 0.7, gap: 1.05, z: 0.9, hover: 0.3, toward: 0.64 }

/** Where bid card `k` of `count` lies while it waits to be chosen: in the row across the middle, the lowest on the left. Raised, and nearer the viewer, when the pointer is over it */
export function bidRowPose(k: number, count: number, raised = false): Pose {
  const pose = onTable((k - (count - 1) / 2) * BID.gap, BID.z, { scale: BID.scale })
  return raised ? shifted(pose, { y: BID.hover, z: 0.2 }) : pose
}

/** Where the bid of a player lies once it is made: on the line from their seat to the middle of the table, turned as the seat is, face up when it can be read and face down while it is secret */
export function bidPose(seat: SeatSpot, up: boolean): Pose {
  return onTable(seat.x * BID.toward, seat.z * BID.toward, { face: up ? "up" : "down", yaw: playedYaw(seat), scale: BID.scale })
}

/** Where the cards are dealt from: above the middle of the table, face down */
export const DECK_POSE = onTable(0, -0.5, { y: 3.2, face: "down", scale: 0.9 })
