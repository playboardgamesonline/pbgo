import { boxAbove, frameBoxOfPoses, heldFan, heldLeftPose, heldShadow, inFrame, joinBoxes, onAxis, onTable, type Pose, RESTING_HEIGHT, SCREEN_HAND_SETTINGS, seats as ringOf, shifted, type Spot, type TableBox } from "@pbgo/table"
import { CAMERA } from "./camera"
import { CARD_SIZE } from "./textures"

/** A seat at the table: where it stands and the yaw that turns what lies there to face the middle, as the player who sits there sees it: the viewer's seat is at yaw 0, the one across at half a turn */
export type SeatSpot = Required<Spot>

export const LAYOUT_SETTINGS = {
  radiusX: 7.4,
  radiusZ: 4.4,
  /** How far beyond its seat on the ring the line of a player stands, as a share of the ring, along x and along z: farther along z, since the line of the seats at the ends of the table runs along x, where there is room, and the one of the seats in front and across along z, where there is little */
  reachX: 1.2,
  reachZ: 1.32,
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

/**
 * The frame of a seat: just beyond it on the ring, turned like it, so that the top of the frame, its least z, is toward the middle of the table. Everything of a player stands in it, turned as their name is, in a line along its z axis and in this order from the middle of the table:
 * their name, the info line just under it (the plate), their play area (where their bid lies) and their hand. The same at every seat, the viewer's included.
 */
export function seatFrame(seat: SeatSpot): SeatSpot {
  return { x: seat.x * LAYOUT_SETTINGS.reachX, z: seat.z * LAYOUT_SETTINGS.reachZ, yaw: seat.yaw }
}

/** The cards of an opponent's hand of `n`, a small fan of backs that stands, in the frame of their seat: `heldFan` of the kit. Their round shadow lies under them (`HELD_SHADOW`) */
export function heldLayout(n: number, seat: SeatSpot): Pose[] {
  return heldFan(n, seat.yaw, CARD_SIZE)
}

/** The small round shadow under an opponent's hand: how far it reaches for `n` cards, and how dark it is */
export const HELD_SHADOW = heldShadow()

/** What the viewer's hand takes of the line of their seat: nothing, since it is held on the screen and not on the table, so its place on the line is the foot of it, where the seat is, and their play area and their name stand where an opponent's do */
const VIEWER_HAND: TableBox = { minX: -1, maxX: 1, minZ: 0, maxZ: 0 }

/** The box of a player's hand in the frame of their seat: a hand of every size from one card to `HAND_MAX` together, as the camera sees it, so that nothing moves as cards are played and drawn. The viewer's takes no room, `VIEWER_HAND` */
export function handBox(seat: SeatSpot): TableBox {
  if (isViewerSeat(seat)) return VIEWER_HAND
  return onAxis(joinBoxes(Array.from({ length: HAND_MAX }, (_, i) => frameBoxOfPoses(heldLayout(i + 1, seat), CARD_SIZE, seatFrame(seat), { tilt: CAMERA.tilt })))!)
}

/**
 * The bid cards. While the players bid, the viewer has a row of them across the middle of the table, one for each bid they may make (from none to one for each card of their hand): they are smaller than the cards of the hand (`BID.scale`), since a row of up to eleven must fit.
 * Once a bid is made it lies in the play area of its player, between their name and their hand. `room` is the clear space between that play area and the hand.
 */
export const BID = { scale: 0.7, gap: 1.05, z: 0.9, hover: 0.3, room: 0.25 }
const BID_SIZE = { width: CARD_SIZE.width * BID.scale, depth: CARD_SIZE.height * BID.scale }

/** The play area of a seat, in its frame: the room of one bid card, on the axis, on the middle's side of the hand (`boxAbove`), a little clear of it */
export function playBox(seat: SeatSpot): TableBox {
  return boxAbove(handBox(seat), BID_SIZE, BID.room, 0)
}

/** Everything of a seat that lies on the table, in its frame: the hand and the play area above it. The plate of the seat, its name and the info line just under it, stands above the two (`above` of the seat): from the middle of the table, the plate, the play area, the hand */
export function seatBox(seat: SeatSpot): TableBox {
  return onAxis(joinBoxes([handBox(seat), playBox(seat)])!)
}

/** Where a card played from an opponent's hand of `count` flies from: the left end of the fan, as the viewer sees it (`heldLeftPose`), the hand still the size it was */
export function heldFrom(seat: SeatSpot, count: number): Pose {
  return heldLeftPose(seatFrame(seat), (n) => heldLayout(n, seat), count)
}

/** The turn of what a player has played to the middle: upright for the viewer, a little turned toward the seat it comes from */
const playedYaw = (seat: SeatSpot) => (isViewerSeat(seat) ? seat.yaw : seat.yaw + Math.PI)

/** A card played to the middle: on the line to its player's seat, a hair off true by its rank */
export function trickPose(seat: SeatSpot, rank: number): Pose {
  const R = LAYOUT_SETTINGS
  return onTable(seat.x * R.trickGap, seat.z * R.trickGap, { y: RESTING_HEIGHT + rank * 0.012, yaw: playedYaw(seat) + ((rank * 37) % 11) * 0.02 - 0.1 })
}

/** A won trick, shrunk to a small stack beside the hand of the winner, at its level and to its right: off the line of the seat, so that the plate, the play area and the hand stay in line */
export function collectedPose(seat: SeatSpot): Pose {
  const hand = handBox(seat)
  return inFrame(seatFrame(seat), onTable(hand.maxX + 0.7, (hand.minZ + hand.maxZ) / 2, { y: 0.04, scale: 0.35 }))
}

/** The hourglass of the clock: where it stands, in the corner by the viewer's seat where no seat is (the seats keep to the far half of the ring) and past the end of the row of bid cards, and how tall it is */
export const CLOCK = { at: { x: 7.4, z: 2.4 }, size: 2 }

/** Where bid card `k` of `count` lies while it waits to be chosen: in the row across the middle, the lowest on the left. Raised, and nearer the viewer, when the pointer is over it */
export function bidRowPose(k: number, count: number, raised = false): Pose {
  const pose = onTable((k - (count - 1) / 2) * BID.gap, BID.z, { scale: BID.scale })
  return raised ? shifted(pose, { y: BID.hover, z: 0.2 }) : pose
}

/** Where the bid of a player lies once it is made: in their play area, on the axis of their seat between their name and their hand, turned as the seat is, face up when it can be read and face down while it is secret */
export function bidPose(seat: SeatSpot, up: boolean): Pose {
  const play = playBox(seat)
  return inFrame(seatFrame(seat), onTable(0, (play.minZ + play.maxZ) / 2, { face: up ? "up" : "down", scale: BID.scale }))
}

/** Where the cards are dealt from: above the middle of the table, face down */
export const DECK_POSE = onTable(0, -0.5, { y: 3.2, face: "down", scale: 0.9 })
