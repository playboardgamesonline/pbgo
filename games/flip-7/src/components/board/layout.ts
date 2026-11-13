import { type Field, onTable, type Pose, row, SEAT_SETTINGS, type Spot } from "@pbgo/table"

/** A seat at the table: where it stands and the yaw that turns what lies there to face its player: the viewer's seat is at yaw 0, a seat across from them at π, one on their left at -π/2 */
export type SeatSpot = Required<Spot>

/** A place on the table, in world units: x to the right, z toward the viewer */
export type Place = { x: number; z: number }

/**
 * The knobs of the layout, edited by the Layout folder of the debug panel (`scene.tsx` binds them with `useSettings`). The seats stand all around the table like the chairs of a real one, the viewer in front, and what lies at a seat (its line of cards, its
 * plate) turns to face the player who sits there.
 */
export const LAYOUT_SETTINGS = {
  /** The ellipse the lines of the seats are centred on, for a table of three and for a table of eight (in between, in steps). Its far end is the line of the seat across, its sides those of the seats at the sides; the viewer's line stands in front of it
   * at `viewerZ`. How far the camera stands is not a knob: it is fitted to the window (`fitCamera`) */
  radiusX3: 5.4,
  radiusX8: 4.8,
  radiusZ3: 4,
  radiusZ8: 5,
  /** The size of the cards of the opponents, for a table of three and for a table of eight: a small table has big cards, a full one small ones */
  opponentScale3: 0.95,
  opponentScale8: 0.62,
  /** The viewer's line: how far toward them it lies, how big its cards are and how wide it may spread */
  viewerZ: 3.1,
  viewerScale: 1,
  viewerWidth: 13,
  /** 1: the line of an opponent turns to face its player (the cards of the seat across from the viewer are upside down for the viewer, as on a real table); 0: every line reads upright from the viewer's side */
  faceSeat: 1,
  /** 1: the plate of a seat (name, score, status) turns with the seat, but never upside down: a text that would be turned more than a quarter turn from upright is turned back by half a turn; 0: every plate reads upright */
  textTurn: 1,
  /** The clear space between a line and its plate, in world units */
  plateGap: 0.25,
  /** How much of the distance to the next seat along the ring a line may take as its width: below 1 two neighbours leave a gap between them */
  share: 0.92,
  /** The widest a gap between two cards of a line may be, as a share of the width of a card: a line that does not fit its room draws its cards closer, over one another */
  gap: 1.06,
  /** The closest two cards of a line may come, as a share of the width of a card, so that the figure of each stays readable */
  closest: 0.22,
  /** The cards set aside (a Freeze or a Flip Three flipped during a Flip Three) lie this far beyond the line, in cards */
  heldDrop: 1.05,
  heldScale: 0.5,
  /** The draw pile and the discard, either side of the middle, with the viewer's one button between them */
  pilesX: 2.5,
  pilesZ: 0.5,
  pileScale: 0.9,
}

export const LAYOUT_FIELDS: Record<keyof typeof LAYOUT_SETTINGS, Field> = {
  radiusX3: ["ring radius x · 3 players", 3, 12, 0.1],
  radiusX8: ["ring radius x · 8 players", 3, 14, 0.1],
  radiusZ3: ["ring radius z · 3 players", 2, 8, 0.1],
  radiusZ8: ["ring radius z · 8 players", 2, 10, 0.1],
  opponentScale3: ["opponent card scale · 3", 0.3, 1.4, 0.01],
  opponentScale8: ["opponent card scale · 8", 0.3, 1.2, 0.01],
  viewerZ: ["viewer line z", 0, 8, 0.05],
  viewerScale: ["viewer card scale", 0.4, 1.6, 0.01],
  viewerWidth: ["viewer line width", 4, 20, 0.1],
  faceSeat: ["lines face their seat (0 off, 1 on)", 0, 1, 1],
  textTurn: ["plates turn with their seat (0 off, 1 on)", 0, 1, 1],
  plateGap: ["plate gap", 0, 2, 0.05],
  share: ["line share of the ring", 0.4, 1.2, 0.01],
  gap: ["gap (cards)", 0.8, 1.4, 0.01],
  closest: ["closest (cards)", 0.05, 0.6, 0.01],
  heldDrop: ["set aside drop (cards)", 0.5, 2, 0.01],
  heldScale: ["set aside scale", 0.3, 1, 0.01],
  pilesX: ["piles x", 1.5, 5, 0.05],
  pilesZ: ["piles z", -3, 3, 0.05],
  pileScale: ["pile scale", 0.4, 1.4, 0.01],
}

/** The width and height of a card of the game, in world units: the faces of Sanity are 326 by 512 */
export const CARD = { width: 1.2, height: 1.88 }

/** What grows with the table, for `n` players: from the values for three (the fewest) to those for eight (the most), in steps in between. */
export function tableOf(n: number) {
  const R = LAYOUT_SETTINGS
  const t = Math.min(1, Math.max(0, (n - 3) / 5))
  const between = (three: number, eight: number) => three + (eight - three) * t
  return {
    radiusX: between(R.radiusX3, R.radiusX8),
    radiusZ: between(R.radiusZ3, R.radiusZ8),
    opponentScale: between(R.opponentScale3, R.opponentScale8),
  }
}

/**
 * Where the seats stand around the table, as angles in degrees: 0 is in front of the viewer, and the angle grows clockwise as the camera sees it (90 is the left side, 180 straight across, 270 the right side). `FIRST_OPPONENT` is where the player after the
 * viewer sits, which is also how far from the viewer's seat the first and the last opponent keep: the wide line of the viewer needs the room, and the more players the less each of them needs. The other opponents are spread evenly between the first and the last.
 */
const FIRST_OPPONENT: Readonly<Record<number, number>> = { 2: 180, 3: 145, 4: 90, 5: 90, 6: 66, 7: 62, 8: 60 }

/**
 * The angle of a seat on the ring, in degrees clockwise from the viewer's: `index` counts the players in turn order from the viewer (0), `count` is the number of players. Without a viewer (`seated` false, a spectator's view) the seats are the
 * ones of a table with one more player, the empty chair in front being the one that nobody has: nobody sits where the viewer would, and the front keeps the room for the piles and the button.
 */
export function seatAngle(index: number, count: number, seated = true): number {
  if (!seated) return seatAngle(index + 1, count + 1)
  if (index === 0) return 0
  const first = FIRST_OPPONENT[Math.min(8, Math.max(2, count))]!
  const others = count - 1
  return others === 1 ? first : first + ((index - 1) / (others - 1)) * (360 - 2 * first)
}

/** The seat for an angle (`seatAngle`) on an ellipse of half-width `radiusX` and half-depth `radiusZ`: the yaw turns what lies there to face the middle of the table (top edge of a face-up card toward the middle), as the player who sits there reads it. */
export function seatAt(angle: number, radiusX: number, radiusZ: number): SeatSpot {
  const a = (angle * Math.PI) / 180
  const x = -Math.sin(a) * radiusX
  const z = Math.cos(a) * radiusZ
  return { x, z, yaw: Math.abs(x) < 1e-9 && z > 0 ? 0 : Math.atan2(x, z) }
}

/** The seat of each player around the table: the viewer in front, the others on the ring in turn order, the turn passing to the viewer's left. */
export function seatSpots(ids: readonly string[], meId: string | null): Map<string, SeatSpot> {
  const { radiusX, radiusZ } = tableOf(ids.length)
  const viewer = ids.indexOf(meId ?? "")
  const seated = viewer >= 0
  return new Map(
    ids.map((id, i): [string, SeatSpot] => {
      const index = seated ? (i - viewer + ids.length) % ids.length : i
      if (seated && index === 0) return [id, { x: 0, z: LAYOUT_SETTINGS.viewerZ, yaw: 0 }]
      return [id, seatAt(seatAngle(index, ids.length, seated), radiusX, radiusZ)]
    }),
  )
}

/** What a player's line is laid out in: where it lies, which way it faces (the yaw of its frame), how big its cards are, and the width it may take before its cards overlap */
export type Line = { at: Place; yaw: number; scale: number; width: number }

/** The way along the frame of a yaw that a line runs (its x axis) and the way its player faces away from the middle, outward (its +z axis), in the table's frame */
const alongOf = (yaw: number): Place => ({ x: Math.cos(yaw), z: -Math.sin(yaw) })
const outwardOf = (yaw: number): Place => ({ x: Math.sin(yaw), z: Math.cos(yaw) })

/**
 * The line of every player, by id. The viewer's lies in front of them, as wide as the room their neighbours leave; an opponent's lies where its seat is, turned to face its player, and may take a share of the way to the next seat along the ring, so that two
 * lines never run into each other.
 */
export function lines(spots: ReadonlyMap<string, SeatSpot>, meId: string | null): Map<string, Line> {
  const R = LAYOUT_SETTINGS
  const scale = tableOf(spots.size).opponentScale
  const ids = [...spots.keys()]
  const seated = meId !== null && spots.has(meId)
  // the seats in turn order from the viewer, and how far each is from the next along the ring
  const first = seated ? ids.indexOf(meId) : 0
  const order = ids.map((_, i) => ids[(first + i) % ids.length]!)
  const apart = (a: string, b: string) => Math.hypot(spots.get(a)!.x - spots.get(b)!.x, spots.get(a)!.z - spots.get(b)!.z)
  const out = new Map<string, Line>()
  order.forEach((id, i) => {
    const spot = spots.get(id)!
    if (seated && id === meId) return
    const before = order[(i - 1 + order.length) % order.length]!
    const after = order[(i + 1) % order.length]!
    const room = order.length === 2 ? R.viewerWidth : Math.min(apart(id, before), apart(id, after)) * R.share
    out.set(id, { at: { x: spot.x, z: spot.z }, yaw: R.faceSeat ? spot.yaw : 0, scale, width: Math.min(R.viewerWidth, room) })
  })
  if (seated) {
    // the viewer's line stretches until it meets the nearest line beside it: the box of an opponent's line, turned as it is, taken as the rectangle that holds it
    let half = R.viewerWidth / 2
    for (const other of out.values()) {
      const depth = CARD.height * other.scale
      const along = alongOf(other.yaw)
      const reachX = (Math.abs(along.x) * other.width + Math.abs(along.z) * depth) / 2
      const reachZ = (Math.abs(along.z) * other.width + Math.abs(along.x) * depth) / 2
      // only a line that reaches the band of the viewer's line is in its way
      if (other.at.z + reachZ > R.viewerZ - CARD.height * R.viewerScale / 2) half = Math.min(half, Math.max(CARD.width * R.viewerScale, Math.abs(other.at.x) - reachX - 0.3))
    }
    out.set(meId, { at: { x: 0, z: R.viewerZ }, yaw: 0, scale: R.viewerScale, width: half * 2 })
  }
  return out
}

/** The gap between two cards of a line of `n` that has `width` to spread in: as wide as `gap` allows, closer when the line does not fit, and never closer than `closest`. */
export function lineGap(n: number, { scale, width }: Pick<Line, "scale" | "width">): number {
  const R = LAYOUT_SETTINGS
  const card = CARD.width * scale
  const widest = card * R.gap
  if (n <= 1) return widest
  return Math.max(card * R.closest, Math.min(widest, (width - card) / (n - 1)))
}

/** The slots of a line of `n` cards, in the frame of its place: a row centred on x = 0, the first on the left, each card a hair higher than the one before so that the ones that overlap never fight for a pixel. */
export function linePoses(n: number, line: Pick<Line, "scale" | "width">): Pose[] {
  return row(n, { gap: lineGap(n, line), rise: 0.012, scale: line.scale })
}

/** The cards set aside during a Flip Three: a small row beyond the line, toward the middle of the table, and toward the viewer for the viewer. It lies in the frame of its line. */
export function heldPlace(line: Line, viewer: boolean): Place {
  const R = LAYOUT_SETTINGS
  const drop = CARD.height * line.scale * R.heldDrop
  if (viewer) return { x: line.at.x, z: line.at.z + drop }
  // toward the middle of the table, from the line
  const length = Math.hypot(line.at.x, line.at.z) || 1
  return { x: line.at.x - (line.at.x / length) * drop, z: line.at.z - (line.at.z / length) * drop }
}

/** The slots of the cards set aside, in the frame of their place. */
export const heldPoses = (n: number, line: Pick<Line, "scale">): Pose[] => row(n, { gap: CARD.width * line.scale * LAYOUT_SETTINGS.heldScale * 1.1, rise: 0.012, scale: line.scale * LAYOUT_SETTINGS.heldScale })

/** Where the draw pile and the discard lie: either side of the middle of the table. */
export function pilePlaces(): { deck: Place; discard: Place } {
  const R = LAYOUT_SETTINGS
  return { deck: { x: -R.pilesX, z: R.pilesZ }, discard: { x: R.pilesX, z: R.pilesZ } }
}

/** Where the viewer's one button lies, Stay on a turn and Deal between two rounds: between the two piles, in the middle band of the table that no line or plate reaches and the cookie banner never covers. */
export function buttonPlace(): Place {
  const { deck, discard } = pilePlaces()
  return { x: (deck.x + discard.x) / 2, z: discard.z }
}

/** The width of the paper of a button, in world units */
export const BUTTON_WIDTH = 2.6

/** A rectangle of the table that is turned: its centre, half its width along its own x axis, half its depth along its own z axis, and the yaw of that frame (the frame of a seat: x runs along a line, +z points outward) */
export type Box = { x: number; z: number; halfWidth: number; halfDepth: number; yaw: number }

/** The four corners of a box, in the table's frame */
export function cornersOf({ x, z, halfWidth, halfDepth, yaw }: Box): Place[] {
  const along = alongOf(yaw)
  const outward = outwardOf(yaw)
  return [
    [-1, -1],
    [1, -1],
    [1, 1],
    [-1, 1],
  ].map(([a, b]) => ({ x: x + a! * halfWidth * along.x + b! * halfDepth * outward.x, z: z + a! * halfWidth * along.z + b! * halfDepth * outward.z }))
}

/** The turn of a text that would be more than a quarter turn from upright, back by half a turn: a plate is never read upside down */
export function uprightYaw(yaw: number): number {
  const turn = Math.atan2(Math.sin(yaw), Math.cos(yaw))
  return Math.abs(turn) <= Math.PI / 2 + 1e-9 ? turn : turn - Math.sign(turn) * Math.PI
}

/** What a plate occupies in its own frame (the aura's width, and from above the name to below the status), measured from its centre: along z, from -`lift` to `drop` */
const PLATE = { lift: SEAT_SETTINGS.nameLift + 0.45, drop: SEAT_SETTINGS.statusDrop + 0.3 }

/** Where the plate of a seat stands, and the yaw of its frame (the way its text reads: name, then score, then status, going down the frame's +z). It stands beyond the line, out from the middle of the table, clear of it by `plateGap`. */
export function plateAt(spot: SeatSpot, line: Line): Place & { yaw: number } {
  const R = LAYOUT_SETTINGS
  const yaw = R.textTurn ? uprightYaw(spot.yaw) : 0
  const out = outwardOf(spot.yaw)
  // how far the line's box reaches along the way out, and how far the plate reaches back toward the line: the name when the plate's own down points out, the status when it points in
  const along = alongOf(line.yaw)
  const across = outwardOf(line.yaw)
  const reach = (Math.abs(out.x * along.x + out.z * along.z) * line.width + Math.abs(out.x * across.x + out.z * across.z) * CARD.height * line.scale) / 2
  const folded = Math.cos(yaw - spot.yaw) < 0
  const back = folded ? PLATE.drop : PLATE.lift
  const distance = reach + R.plateGap + back
  return { x: line.at.x + out.x * distance, z: line.at.z + out.z * distance, yaw }
}

/** The plate's box: the aura as wide as the plate, from above the name to below the status */
export function plateBox(spot: SeatSpot, line: Line): Box {
  const place = plateAt(spot, line)
  const middle = (PLATE.drop - PLATE.lift) / 2
  const down = outwardOf(place.yaw)
  return { x: place.x + down.x * middle, z: place.z + down.z * middle, halfWidth: SEAT_SETTINGS.auraWidth / 2, halfDepth: (PLATE.drop + PLATE.lift) / 2, yaw: place.yaw }
}

/**
 * Where things stand on a table of `n` players, as boxes: the plate of each seat and its line (a line of three cards for an opponent and of four for the viewer, or all the room the line may take when `full`), the piles with their count and their hint,
 * and the button. The viewer is the first seat; a spectator (`seated` false) has none.
 */
export function tableBoxes(n: number, full = false, seated = true): Box[] {
  const R = LAYOUT_SETTINGS
  const ids = Array.from({ length: n }, (_, i) => String(i))
  const viewer = seated ? "0" : null
  const spots = seatSpots(ids, viewer)
  const placed = lines(spots, viewer)
  const out: Box[] = []
  for (const [id, spot] of spots) {
    const line = placed.get(id)!
    out.push(plateBox(spot, line))
    const nominal = CARD.width * line.scale * (1 + (id === viewer ? 3 : 2) * R.gap)
    out.push({ x: line.at.x, z: line.at.z, halfWidth: (full ? line.width : Math.min(nominal, line.width)) / 2, halfDepth: (CARD.height * line.scale) / 2, yaw: line.yaw })
  }
  const { deck, discard } = pilePlaces()
  const pile = (CARD.height * R.pileScale) / 2
  const half = (CARD.width * R.pileScale) / 2 + 0.6
  // the hint above the draw pile and its count below it; the discard has its pile alone
  out.push({ x: deck.x, z: deck.z, halfWidth: half, halfDepth: pile + 0.8, yaw: 0 })
  out.push({ x: discard.x, z: discard.z, halfWidth: (CARD.width * R.pileScale) / 2, halfDepth: pile, yaw: 0 })
  const button = buttonPlace()
  out.push({ x: button.x, z: button.z, halfWidth: BUTTON_WIDTH / 2, halfDepth: 0.5, yaw: 0 })
  return out
}

/** What the camera has to bring into the window, and to keep clear of what the platform draws over it (`fitCamera`): the corners of each box of the table (`tableBoxes`), at their nominal sizes. A longer line spreads, and may reach farther. */
export const tableQuads = (n: number, seated = true): Place[][] => tableBoxes(n, false, seated).map(cornersOf)

/** Where the cards are dealt from: above the draw pile, face down. */
export function dealtFrom(): Pose {
  const { deck } = pilePlaces()
  return onTable(deck.x, deck.z, { y: 1.6, face: "down", scale: LAYOUT_SETTINGS.pileScale })
}
