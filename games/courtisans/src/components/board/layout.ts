import { FAMILIES, HAND_SIZE, type VisibleCard, type Family, type Level, type PlayerView } from "@courtisans/engine"
import { type CardSize, centreOf, FACE_DOWN, FACE_UP, frameBoxOfPoses, heldFan, heldLeftPose, heldShadow, inFrame, joinBoxes, lean, onAxis, onTable, type Pose, plateAbove, plateBoxOf, pointInFrame, RESTING_HEIGHT, SCREEN_HAND_SETTINGS, SEAT_SETTINGS, type Spot, type TableBox } from "@pbgo/table"
import { Quaternion, Vector3 } from "three"
import { MAT_ORDER } from "../../lib/catalog"
import { CAMERA } from "./camera"

export const MAT_W = 12
export const MAT_D = MAT_W / (2362 / 579)
const MARGIN = 0.033 * MAT_W
export const STEP = (MAT_W - 2 * MARGIN) / 7
export const CARD_W = STEP * 0.92
export const CARD_H = (CARD_W * 890) / 472
export const MISSION_W = 2.4
export const MISSION_H = (MISSION_W * 452) / 688
export const DOMAIN_SCALE = 1.1
export const OFFSET = 0.42
export const LAYOUT_SETTINGS = { randomRotation: 0.017, pileSpacing: 0.02, deckSpacing: 0.017 }

/** The viewer's hand, held at the bottom left of the screen: the numbers of the table's own, which are the ones Courtisans holds its hand with */
export const HAND_SETTINGS = { ...SCREEN_HAND_SETTINGS }

/** The size of a courtier and of a mission, the same for every card of its kind */
export const CARD_SIZE: CardSize = { width: CARD_W, height: CARD_H }
export const MISSION_SIZE: CardSize = { width: MISSION_W, height: MISSION_H }

export type Column = Family | "queen"

export const columnX = (column: Column) => -MAT_W / 2 + MARGIN + STEP * (MAT_ORDER.indexOf(column) + 0.5)

/** The families that have a column on the mat, left to right */
export const TABLE_FAMILIES = MAT_ORDER.filter((c): c is Family => c !== "queen")

export function tablePose(column: Column, level: Level, rank: number, id?: number): Pose {
  const edge = MAT_D / 2 + CARD_H / 2 + rank * OFFSET
  return onTable(columnX(column), level === "up" ? -edge : edge, { y: RESTING_HEIGHT + rank * LAYOUT_SETTINGS.pileSpacing, lean: id === undefined ? undefined : String(id) })
}

export const columnOf = (card: VisibleCard): Column => card.family ?? "queen"

/** Where a lane of the Queen's table lies: the bright end of its band, on the edge of the mat, and the way it runs from there, away from the mat: the light above it, the disgrace below it */
export function laneFrame(column: Column, light: boolean): Required<Spot> {
  return { x: columnX(column), z: light ? -MAT_D / 2 : MAT_D / 2, yaw: light ? 0 : Math.PI }
}

/** How far a lane is pressed from the edge of the mat, as a share of a card's height: where the cards of the Queen's table lie, and short of the plates of the seats, which a press on a plate belongs to */
export const LANE_REACH = 1.05

/** The area that takes the press of a lane, of the width of its band: from the edge of the mat outward, over the cards that lie there */
export function laneArea(column: Column, light: boolean, width: number): { at: Required<Spot>; width: number; depth: number } {
  const frame = laneFrame(column, light)
  const depth = CARD_H * LANE_REACH
  return { at: { ...frame, z: frame.z + ((light ? -1 : 1) * depth) / 2 }, width, depth }
}

/** Missions placed face down on the table, right of each player board, along the edge facing the table. */
export const MISSION_REST = { scale: 0.62, gap: 0.35, spacing: 0.14 }
export function missionRestPose(zone: { center: Vector3; width: number; labelPos: Vector3; labelYaw: number }, index: number, key: string, faceUp = false): Pose {
  const w = MISSION_W * MISSION_REST.scale
  const h = MISSION_H * MISSION_REST.scale
  const yaw = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), zone.labelYaw)
  const local = new Vector3(zone.width / 2 + MISSION_REST.gap + w / 2, 0.05 + index * 0.02, 0.25 + h / 2 + index * (h + MISSION_REST.spacing)).applyQuaternion(yaw)
  return {
    position: zone.labelPos.clone().add(local).setY(0.05 + index * 0.02),
    quaternion: yaw.multiply(lean(`${key}:${index}`, 0.06)).multiply(faceUp ? FACE_UP : FACE_DOWN),
    scale: MISSION_REST.scale,
  }
}

export const DRAW_PILE = new Vector3(MAT_W / 2 + 1.2, 0, 0)
export const deckTopPose = (n: number) => onTable(DRAW_PILE.x, DRAW_PILE.z, { y: RESTING_HEIGHT + Math.min(n, 60) * LAYOUT_SETTINGS.deckSpacing, face: "down", lean: `pioche${n}`, leanAmplitude: 0.04 })

/** Pile of missions, face down, left of the board (mirror of the draw pile); missions are dealt from it after the cards of the draw pile. */
export const MISSION_PILE = { x: -(MAT_W / 2 + 1.2), z: 0, size: 8, scale: 0.85, spacing: 0.022 }
export const missionPilePose = (n: number, scale = MISSION_PILE.scale): Pose =>
  onTable(MISSION_PILE.x, MISSION_PILE.z, { y: RESTING_HEIGHT + n * MISSION_PILE.spacing, face: "down", lean: `mission-pile${n}`, leanAmplitude: 0.05, scale })

const FAMILY_ORDER: Family[] = [...FAMILIES]
export const DL = CARD_W * DOMAIN_SCALE
export const DH = CARD_H * DOMAIN_SCALE
const OVERLAP = 0.42
const GAP = 0.35

/**
 * A seat at the table: where its frame stands and the yaw that turns what lies there to face the middle, as the player who sits there sees it. The viewer's seat is at yaw 0, a seat at the side has a quarter turn and a seat across the table half a turn
 * (the top of the frame, its least z, is toward the middle). The frame is centred on the player's domain.
 */
export type SeatSpot = Required<Spot>

/** A seat: its frame, how wide its domain may spread along it before its piles close up, and whether it is the viewer's */
export type Seat = { frame: SeatSpot; maxWidth: number; viewer: boolean }

/**
 * From the middle of a domain to the line where the hand of its player stands: half a domain's depth and a clear space. The hand is the farthest of the line from the middle of the table: in this order outward, the plate, the domain and the hand. The viewer's is held on the screen
 * and takes no room on the table, so the line only places the foot of their domain.
 */
const REACH = DH / 2 + 0.4

/** Where the line of the hand of each seat stands: across the table, at the sides, and in front for the viewer, whose domain lies beyond it */
const ACROSS = -10.6
const SIDE = 13.2
const SIDE_Z = -2.2
const FRONT = 5.4

/** The viewer's domain lies a little farther from the middle than its hand line would put it, so that their name stands clear of the cards of the Queen's table, which come down toward it two deep before they reach the plate */
const VIEWER_DROP = 0.4
const VIEWER_SEAT: Seat = { frame: { x: 0, z: FRONT + REACH + VIEWER_DROP, yaw: 0 }, maxWidth: 11, viewer: true }
const LEFT = (z = SIDE_Z): SeatSpot => ({ x: -SIDE + REACH, z, yaw: -Math.PI / 2 })
const RIGHT = (z = SIDE_Z): SeatSpot => ({ x: SIDE - REACH, z, yaw: Math.PI / 2 })
const OPPOSITE = (x = 0): SeatSpot => ({ x, z: ACROSS + REACH, yaw: Math.PI })

/** The seats of the opponents for a table of each number of them, in turn order from the player after the viewer: the turn passes to the left */
const OPPONENTS: Record<number, Omit<Seat, "viewer">[]> = {
  1: [{ frame: OPPOSITE(), maxWidth: 12 }],
  2: [
    { frame: LEFT(), maxWidth: 10 },
    { frame: RIGHT(), maxWidth: 10 },
  ],
  3: [
    { frame: LEFT(), maxWidth: 10 },
    { frame: OPPOSITE(), maxWidth: 12 },
    { frame: RIGHT(), maxWidth: 10 },
  ],
  // The two seats across take the corners of the table, so the seats at the sides are not as long, or their domains would meet in the corner
  4: [
    { frame: LEFT(), maxWidth: 9.4 },
    { frame: OPPOSITE(-6), maxWidth: 9.5 },
    { frame: OPPOSITE(6), maxWidth: 9.5 },
    { frame: RIGHT(), maxWidth: 9.4 },
  ],
}

/**
 * The seat of each player: the viewer in front, the others around the far half in turn order, each turned toward the middle. A spectator has no seat in front, so the players take the seats of the opponents of a table of that many, and
 * the fifth of a table of five sits where the viewer would.
 */
export function seats(view: PlayerView): Map<string, Seat> {
  const meId = view.me?.id
  const i = view.players.findIndex((j) => j.id === meId)
  const others = i < 0 ? view.players : [...view.players.slice(i + 1), ...view.players.slice(0, i)]
  const places = OPPONENTS[Math.min(others.length, 4)] ?? []
  const map = new Map<string, Seat>()
  others.forEach((j, k) => {
    const place = places[k]
    map.set(j.id, place ? { ...place, viewer: false } : { ...VIEWER_SEAT, frame: { ...VIEWER_SEAT.frame } })
  })
  if (meId && i >= 0) map.set(meId, { ...VIEWER_SEAT, frame: { ...VIEWER_SEAT.frame } })
  return map
}

/**
 * The cards another player holds, in the frame of the line of their hand (`heldFrame`): a small fan of backs that stands. The round shadow under them (`HELD_SHADOW`) lies at the origin of the frame.
 */
export function heldLayout(n: number, seat: Seat): Pose[] {
  return heldFan(n, seat.frame.yaw, CARD_SIZE)
}

/** The small round shadow under an opponent's hand: how far it reaches for `n` cards, and how dark it is */
export const HELD_SHADOW = heldShadow()

/** The frame of the line of a seat's hand: beyond its domain, turned as the seat is */
export function heldFrame(seat: Seat): SeatSpot {
  const { x, z } = pointInFrame(seat.frame, { x: 0, z: REACH })
  return { x, z, yaw: seat.frame.yaw }
}

/** Where a card played from an opponent's hand of `count` flies from: the left end of the fan, as the viewer sees it, the hand still the size it was */
export function heldFrom(seat: Seat, count: number): Pose {
  return heldLeftPose(heldFrame(seat), (n) => heldLayout(n, seat), Math.max(1, count))
}

/** The most cards a hand holds */
export const HAND_MAX = HAND_SIZE

/**
 * The box of a player's hand in the frame of their seat (the middle of their domain): a hand of every size from one card to the most, together, as the camera sees it, so that the plate does not move as cards are played and drawn. The viewer's takes no room,
 * since it is held on the screen: `null`.
 */
export function handBox(seat: Seat): TableBox | null {
  if (seat.viewer) return null
  const line = Array.from({ length: HAND_MAX }, (_, i) => frameBoxOfPoses(heldLayout(i + 1, seat), CARD_SIZE, seat.frame, { tilt: CAMERA.tilt }))
  const box = joinBoxes(line)
  // Drawn in the frame of the hand line, which stands `REACH` beyond the middle of the domain
  return box && { ...box, minZ: box.minZ + REACH, maxZ: box.maxZ + REACH }
}

/** The room of a domain in the frame of its seat: as wide as it may spread, as deep as a card of it, whatever it holds now, so that nothing moves as cards are played */
export function domainBox(seat: Seat): TableBox {
  return { minX: -seat.maxWidth / 2, maxX: seat.maxWidth / 2, minZ: -DH / 2, maxZ: DH / 2 }
}

/**
 * Everything of a seat that lies on the table, in its frame: the domain and the hand beyond it. The plate (the name) stands above the two (`above` of the seat), the middle's side, so that the line of a seat reads, from the middle of the table: the plate, the domain and the hand.
 */
export function seatBox(seat: Seat): TableBox {
  return onAxis(joinBoxes([domainBox(seat), handBox(seat)])!)
}

/** The area of a seat that is pressed to choose its player: their domain and the plate that stands beyond it, with a little room round, in the frame of the seat */
export const HOTSPOT_PADDING = 0.3
export function hotspotOf(seat: Seat, width: number): { at: { x: number; z: number; yaw: number }; width: number; depth: number } {
  const plate = plateBoxOf(plateAbove(seatBox(seat), SEAT_SETTINGS), SEAT_SETTINGS)
  const area: TableBox = { minX: -width / 2, maxX: width / 2, minZ: Math.min(plate.minZ, -DH / 2), maxZ: DH / 2 }
  const middle = centreOf(area)
  return { at: { ...pointInFrame(seat.frame, middle), yaw: seat.frame.yaw }, width: area.maxX - area.minX + 2 * HOTSPOT_PADDING, depth: area.maxZ - area.minZ + 2 * HOTSPOT_PADDING }
}

/**
 * Where the button of the table stands: on the viewer's side, right of the cards of the Queen's table and below the draw pile, clear of the seats at the sides and of the area of the seat in front. It says nobody is eliminated while an assassin is being played, and
 * skips the end of the game while it plays: the two never meet. It is as wide as its words need.
 */
export const BUTTON_PAD = { at: { x: 7.7, z: 4.3 }, width: 3.6, depth: 1.1 }

export type DomainPile = { family: Family | null; position: Vector3 }
export type DomainZone = {
  center: Vector3
  width: number
  depth: number
  yaw: number
  labelPos: Vector3
  labelYaw: number
  piles: DomainPile[]
}

export const groupKey = (card: VisibleCard) => card.family ?? "spy"

/** A point of a seat's frame at a height, put on the table */
const onSeat = (frame: SeatSpot, x: number, y: number, z: number): Vector3 => {
  const { x: wx, z: wz } = pointInFrame(frame, { x, z })
  return new Vector3(wx, y, wz)
}

/**
 * The cards of a player's domain, laid in the frame of their seat: the piles of each family side by side, centred on the axis of the seat, each pile overlapping from the left, and the cards of the pile `unfolded` spread out. `hidden` lists the cards
 * that show their back (the spies, until the end), `liftedPile` the pile that is raised for the count of its points.
 */
export function arrangeDomain(
  seat: Seat,
  domain: VisibleCard[],
  unfolded: string | null = null,
  hidden: Set<number> | null = null,
  liftedPile: number | null = null,
): { poses: Map<number, Pose>; zone: DomainZone } {
  const { frame, maxWidth } = seat
  const family = (c: VisibleCard) => (hidden?.has(c.id) ? null : c.family)
  const groups = [...FAMILY_ORDER.map((f) => domain.filter((c) => family(c) === f)), domain.filter((c) => !family(c))].filter(
    (g) => g.length > 0,
  )
  const natural = groups.reduce((s, g) => s + DL + (g.length - 1) * OVERLAP, 0) + GAP * Math.max(0, groups.length - 1)
  const fixed = DL * groups.length
  const f = natural > maxWidth && natural > fixed ? Math.max(0.3, (maxWidth - fixed) / (natural - fixed)) : 1
  const width = groups.length ? fixed + (natural - fixed) * f : DL * 2

  const place = (u: number, y: number, q: Quaternion): Pose => inFrame(frame, { position: new Vector3(u, y, 0), quaternion: q, scale: DOMAIN_SCALE })

  const poses = new Map<number, Pose>()
  const piles: DomainPile[] = []
  let u = -width / 2 + DL / 2
  groups.forEach((group, groupIndex) => {
    const open = unfolded !== null && groupKey(group[0]) === unfolded && group.length > 1
    const lifted = liftedPile === groupIndex ? 0.45 : 0
    const middle = u + ((group.length - 1) * OVERLAP * f) / 2
    // The count of a pile stands beyond it, away from the middle of the table
    piles.push({ family: family(group[0]), position: onSeat(frame, middle, 0.05, DH / 2 + 0.55) })
    group.forEach((card, k) => {
      const position = open ? middle + (k - (group.length - 1) / 2) * DL * 0.6 : u + k * OVERLAP * f
      poses.set(
        card.id,
        place(position, (open ? 0.35 : 0.03) + lifted + k * LAYOUT_SETTINGS.pileSpacing, lean(String(card.id)).multiply(family(card) ? FACE_UP : FACE_DOWN)),
      )
    })
    u += DL + (group.length - 1) * OVERLAP * f + GAP * f
  })

  return {
    poses,
    zone: {
      center: onSeat(frame, 0, 0.012, 0),
      width: Math.max(width, 3 * DL + 2 * GAP) + 0.6,
      depth: DH + 0.5,
      yaw: frame.yaw,
      labelPos: onSeat(frame, 0, 0.02, -(DH / 2 + 0.25)),
      labelYaw: frame.yaw,
      piles,
    },
  }
}
