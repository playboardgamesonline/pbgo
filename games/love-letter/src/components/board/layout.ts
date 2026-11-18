import { fan, type Field, onTable, type Pose, row, SEAT_SETTINGS, shifted, type Spot } from "@pbgo/table"

/** A seat at the table: where it stands and the yaw that turns what lies there to face its player: the viewer's seat is at yaw 0, a seat across from them at π, one on their left at -π/2 */
export type SeatSpot = Required<Spot>

/** A place on the table, in world units: x to the right, z toward the viewer */
export type Place = { x: number; z: number }

/** The width and height of a card of the game, in world units: the faces of Sanity are 760 by 1060 (38:53) */
export const CARD = { width: 1.2, height: (1.2 * 1060) / 760 }

/** The tilt of the camera from the vertical, in degrees (`CAMERA` of `camera.ts` stands at it): something that floats above the table is seen where the table lies `height × tan(tilt)` farther from the camera */
export const VIEW_TILT = 46

/**
 * The knobs of the layout, edited by the Layout folder of the debug panel (`scene.tsx` binds them with `useSettings`). The seats stand round the table like the chairs of a real one, the viewer in front. What a player has lies in their own frame, which faces
 * them: the play area nearest the middle of the table, then their hand, then their plate beyond both.
 */
export const LAYOUT_SETTINGS = {
  /** The ellipse the play areas of the opponents are centred on, for a table of two and for a table of six (in between, in steps). Its far end is the seat across, its sides those of the seats at the sides; the viewer's play area stands in front of it at
   * `viewerZ`. How far the camera stands is not a knob: it is fitted to the window (`fitCamera`) */
  radiusX2: 4.4,
  radiusX6: 5,
  radiusZ2: 3.5,
  radiusZ6: 4.2,
  /** The size of the cards of an opponent's play area, for a table of two and for a table of six: a small table has big cards, a full one small ones */
  areaScale2: 0.85,
  areaScale6: 0.62,
  /** The size of the plates (the avatar, the name and the tokens), for a table of two and for a table of six: a full table has smaller ones, which the seats beside each other need */
  plateScale2: 1,
  plateScale6: 0.84,
  /** The viewer's play area: how far toward them its middle lies, how big its cards are and how wide it may spread */
  viewerZ: 2.6,
  viewerAreaScale: 0.85,
  viewerWidth: 9,
  /** The hand: the viewer's is bigger than any other card of the table, an opponent's is a few small backs */
  viewerHandScale: 1.3,
  opponentHandScale: 0.5,
  /** The gap between the play area, the hand and the plate, in world units */
  blockGap: 0.25,
  /** How much of the distance to the next seat along the ring a play area may take as its width: below 1 two neighbours leave a gap between them */
  share: 0.92,
  /** The widest a gap between two cards of a play area may be, as a share of the width of a card, and the closest two may come: the medallion with the value is the left third of a face, so a card lies about a third over the one before it at the most */
  gap: 1.06,
  closest: 0.34,
  /** The gap between two cards of the viewer's hand, as a share of the width of a card, and between two of an opponent's backs, which lie over one another */
  handGap: 1.1,
  backsGap: 0.55,
  /** The viewer's hand is a fan that stands up toward them: how far each card leans toward the viewer (radians), how high it floats and how far the ends swing toward the viewer */
  handTilt: 0.55,
  handLift: 0.9,
  handCurve: 0.05,
  /** The deck on the left of the middle and the card set aside on its right, with the strip of the viewer's choices between them (the middle band of the table), and the three cards set aside face up at two players under the card set aside: where each lies and how big it is */
  deckX: -3.1,
  deckZ: 0.2,
  deckScale: 0.85,
  asideX: 3.1,
  asideZ: 0.2,
  asideScale: 0.6,
  faceUpX: 3.5,
  faceUpZ: 1.3,
  faceUpScale: 0.5,
}

export const LAYOUT_FIELDS: Record<keyof typeof LAYOUT_SETTINGS, Field> = {
  radiusX2: ["ring radius x · 2 players", 3, 12, 0.1],
  radiusX6: ["ring radius x · 6 players", 3, 14, 0.1],
  radiusZ2: ["ring radius z · 2 players", 2, 8, 0.1],
  radiusZ6: ["ring radius z · 6 players", 2, 10, 0.1],
  areaScale2: ["opponent area scale · 2", 0.3, 1.4, 0.01],
  areaScale6: ["opponent area scale · 6", 0.3, 1.2, 0.01],
  plateScale2: ["plate scale · 2 players", 0.4, 1.4, 0.01],
  plateScale6: ["plate scale · 6 players", 0.4, 1.4, 0.01],
  viewerZ: ["viewer area z", 0, 8, 0.05],
  viewerAreaScale: ["viewer area scale", 0.4, 1.6, 0.01],
  viewerWidth: ["viewer area width", 4, 20, 0.1],
  viewerHandScale: ["viewer hand scale", 0.6, 2, 0.01],
  opponentHandScale: ["opponent hand scale", 0.2, 1, 0.01],
  blockGap: ["gap between area, hand and plate", 0, 1, 0.01],
  share: ["area share of the ring", 0.4, 1.2, 0.01],
  gap: ["gap (cards)", 0.8, 1.4, 0.01],
  closest: ["closest (cards)", 0.05, 0.6, 0.01],
  handGap: ["hand gap (cards)", 0.8, 1.6, 0.01],
  backsGap: ["backs gap (cards)", 0.2, 1.4, 0.01],
  handTilt: ["hand tilt", 0, 1.2, 0.01],
  handLift: ["hand lift", 0, 3, 0.01],
  handCurve: ["hand curve", 0, 0.3, 0.005],
  deckX: ["deck x", -8, 0, 0.05],
  deckZ: ["deck z", -4, 4, 0.05],
  deckScale: ["deck scale", 0.4, 1.4, 0.01],
  asideX: ["set aside x", -8, 8, 0.05],
  asideZ: ["set aside z", -4, 4, 0.05],
  asideScale: ["set aside scale", 0.3, 1.2, 0.01],
  faceUpX: ["face up x", -8, 8, 0.05],
  faceUpZ: ["face up z", -4, 4, 0.05],
  faceUpScale: ["face up scale", 0.3, 1.2, 0.01],
}

/** What grows with the table, for `n` players: from the values for two (the fewest) to those for six (the most), in steps in between. */
export function tableOf(n: number) {
  const R = LAYOUT_SETTINGS
  const t = Math.min(1, Math.max(0, (n - 2) / 4))
  const between = (two: number, six: number) => two + (six - two) * t
  return {
    radiusX: between(R.radiusX2, R.radiusX6),
    radiusZ: between(R.radiusZ2, R.radiusZ6),
    areaScale: between(R.areaScale2, R.areaScale6),
    plateScale: between(R.plateScale2, R.plateScale6),
  }
}

/**
 * Where the seats stand around the table, as angles in degrees: 0 is in front of the viewer, and the angle grows clockwise as the camera sees it (90 is the left side, 180 straight across, 270 the right side). `FIRST_OPPONENT` is where the player after
 * the viewer sits, which is also how far from the viewer's seat the first and the last opponent keep: the wide block of the viewer needs the room, and the more players the less each of them needs. The other opponents are spread evenly between the first
 * and the last. At four and five players the side seats stand a little toward the viewer (72 degrees, a regular pentagon at five), not on the line across the table: there they would lie under the log of the turns that the platform draws at the top left of the window.
 */
const FIRST_OPPONENT: Readonly<Record<number, number>> = { 2: 180, 3: 145, 4: 72, 5: 72, 6: 66 }

/**
 * The angle of a seat on the ring, in degrees clockwise from the viewer's: `index` counts the players in turn order from the viewer (0), `count` is the number of players. Without a viewer (`seated` false, a spectator's view) the seats are the ones of a
 * table with one more player, the empty chair in front being the one that nobody has: nobody sits where the viewer would, and the front keeps the room for the deck and the strip.
 */
export function seatAngle(index: number, count: number, seated = true): number {
  if (!seated) return seatAngle(index + 1, count + 1)
  if (index === 0) return 0
  const first = FIRST_OPPONENT[Math.min(6, Math.max(2, count))]!
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
  const viewer = ids.indexOf(meId ?? "")
  const seated = viewer >= 0
  // a spectator sits at the places of a table with one more player, and so the ring is the size of that table's
  const { radiusX, radiusZ } = tableOf(seated ? ids.length : ids.length + 1)
  return new Map(
    ids.map((id, i): [string, SeatSpot] => {
      const index = seated ? (i - viewer + ids.length) % ids.length : i
      if (seated && index === 0) return [id, { x: 0, z: LAYOUT_SETTINGS.viewerZ, yaw: 0 }]
      return [id, seatAt(seatAngle(index, ids.length, seated), radiusX, radiusZ)]
    }),
  )
}

/** What a player's play area is laid out in: where it lies, which way it faces (the yaw of its frame), how big its cards are, the width it may take before its cards overlap, and how big the plate beyond it is drawn (the same for every seat of a table) */
export type Area = { at: Place; yaw: number; scale: number; width: number; plate: number }

/** The way along the frame of a yaw that a row runs (its x axis) and the way its player faces away from the middle, outward (its +z axis), in the table's frame */
const alongOf = (yaw: number): Place => ({ x: Math.cos(yaw), z: -Math.sin(yaw) })
const outwardOf = (yaw: number): Place => ({ x: Math.sin(yaw), z: Math.cos(yaw) })

/** A rectangle of the table that is turned: its centre, half its width along its own x axis, half its depth along its own z axis, and the yaw of that frame (the frame of a seat: x runs along a row, +z points outward) */
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

/** Whether two turned rectangles overlap, by the separating axis test: they only touch when they share an edge */
export function boxesOverlap(a: Box, b: Box): boolean {
  const pa = cornersOf(a)
  const pb = cornersOf(b)
  for (const box of [a, b]) {
    for (const axis of [alongOf(box.yaw), outwardOf(box.yaw)]) {
      const project = (points: Place[]) => points.map((p) => p.x * axis.x + p.z * axis.z)
      const [a0, a1, b0, b1] = [Math.min(...project(pa)), Math.max(...project(pa)), Math.min(...project(pb)), Math.max(...project(pb))]
      if (a1 <= b0 + 1e-9 || b1 <= a0 + 1e-9) return false
    }
  }
  return true
}

/**
 * The play area of every player, by id. The viewer's lies in front of them, as wide as the room their neighbours leave; an opponent's lies where its seat is, turned to face its player, and may take a share of the way to the next seat along the ring, so that
 * two areas never run into each other.
 */
export function areas(spots: ReadonlyMap<string, SeatSpot>, meId: string | null): Map<string, Area> {
  const R = LAYOUT_SETTINGS
  const ids = [...spots.keys()]
  const seated = meId !== null && spots.has(meId)
  const { areaScale: scale, plateScale: plate } = tableOf(seated ? spots.size : spots.size + 1)
  // the seats in turn order from the viewer, and how far each is from the next along the ring
  const first = seated ? ids.indexOf(meId) : 0
  const order = ids.map((_, i) => ids[(first + i) % ids.length]!)
  const apart = (a: string, b: string) => Math.hypot(spots.get(a)!.x - spots.get(b)!.x, spots.get(a)!.z - spots.get(b)!.z)
  const out = new Map<string, Area>()
  order.forEach((id, i) => {
    const spot = spots.get(id)!
    if (seated && id === meId) return
    const before = order[(i - 1 + order.length) % order.length]!
    const after = order[(i + 1) % order.length]!
    // the one opponent of a viewer sits across and has the room the viewer has; two seats with no viewer are neighbours, and share the way between them
    const room = seated && order.length === 2 ? R.viewerWidth : Math.min(apart(id, before), apart(id, after)) * R.share
    out.set(id, { at: { x: spot.x, z: spot.z }, yaw: spot.yaw, scale, width: Math.min(R.viewerWidth, room), plate })
  })
  if (seated) {
    // the viewer's area stretches until it meets the nearest block beside it: the box of an opponent's area, turned as it is, taken as the rectangle that holds it
    let half = R.viewerWidth / 2
    for (const other of out.values()) {
      const depth = CARD.height * other.scale
      const along = alongOf(other.yaw)
      const reachX = (Math.abs(along.x) * other.width + Math.abs(along.z) * depth) / 2
      const reachZ = (Math.abs(along.z) * other.width + Math.abs(along.x) * depth) / 2
      // only an area that reaches the band of the viewer's is in its way
      if (other.at.z + reachZ > R.viewerZ - (CARD.height * R.viewerAreaScale) / 2) half = Math.min(half, Math.max(CARD.width * R.viewerAreaScale, Math.abs(other.at.x) - reachX - 0.3))
    }
    out.set(meId, { at: { x: 0, z: R.viewerZ }, yaw: 0, scale: R.viewerAreaScale, width: half * 2, plate })
  }
  return out
}

/** The gap between two cards of an area of `n` that has `width` to spread in: as wide as `gap` allows, closer when the area does not fit, and never closer than `closest`, so that the value of each card stays in sight. */
export function areaGap(n: number, { scale, width }: Pick<Area, "scale" | "width">): number {
  const R = LAYOUT_SETTINGS
  const card = CARD.width * scale
  const widest = card * R.gap
  if (n <= 1) return widest
  return Math.max(card * R.closest, Math.min(widest, (width - card) / (n - 1)))
}

/** The slots of an area of `n` cards, in the frame of its place: a row centred on x = 0, the first (the oldest) on the left, each card a hair higher than the one before so that the ones that overlap never fight for a pixel. */
export function areaPoses(n: number, area: Pick<Area, "scale" | "width">): Pose[] {
  return row(n, { gap: areaGap(n, area), rise: 0.012, scale: area.scale })
}

/** What a plate occupies in its own frame (the aura's width, and from above the name to below the status), measured from its centre: along z, from -`lift` to `drop` */
const PLATE = { lift: SEAT_SETTINGS.nameLift + 0.55, drop: SEAT_SETTINGS.lineDrop + 0.2 }

/** How deep a plate is, from above the name to below the status, at full size */
const PLATE_DEPTH = PLATE.lift + PLATE.drop

/**
 * What hangs off the right of a name on a plate, the favor tokens (a stack of discs, then the count), in world units from the name's right edge: the plate is centred on all of it, the avatar, the name and the tokens, not on the name alone, so the seat
 * stands half of it to the left of the middle of its box. `scene.tsx` places the stack and the count inside it.
 */
export const PLATE_TRAILING = 1.45

/** How wide a letter of a name is, in the display font in capitals, as a share of the lettering's height */
const PLATE_LETTER = 0.7 * SEAT_SETTINGS.nameHeight

/** How wide a plate is taken to be, the avatar, a name of `PLATE_LETTERS` letters and the favor tokens side by side, centred: what a zone must hold of it. A longer name (the platform draws twelve letters at the most) reaches past it. */
export const PLATE_LETTERS = 6
export const PLATE_WIDTH = SEAT_SETTINGS.avatarGap + SEAT_SETTINGS.avatarSize + PLATE_LETTERS * PLATE_LETTER + PLATE_TRAILING

/**
 * The width of a name as the table draws it, in world units, at the size of a plate: `em` is the width of its text over the height of its lettering, as the browser measures it. The kit paints a lettering at 140 pixels over a canvas pixel of `height / 155`
 * world units (`TableText`), and a name is `nameHeight` tall.
 */
export const nameWidth = (em: number) => (em * 140 * SEAT_SETTINGS.nameHeight) / 155

/**
 * How much smaller than its table says a plate is drawn so that what it shows, the avatar, a name `width` wide and the favor tokens, fits the box the layout keeps for it: 1 for a name that fits it, less for a longer one (the platform draws twelve letters
 * at the most, in capitals as wide as a W). The name, the avatar and the tokens shrink together, about the same centre.
 */
export function plateFit(width: number): number {
  return Math.min(1, PLATE_WIDTH / (SEAT_SETTINGS.avatarGap + SEAT_SETTINGS.avatarSize + width + PLATE_TRAILING))
}

/** What a plate occupies once it is drawn at the size of its table (`plateScale` of `tableOf`): how wide and deep it is, and the room of its tokens, in world units */
const plateSize = ({ plate }: Pick<Area, "plate">) => ({ width: PLATE_WIDTH * plate, depth: PLATE_DEPTH * plate, trailing: PLATE_TRAILING * plate, middle: ((PLATE.drop - PLATE.lift) / 2) * plate })

/** The turn of a text that would be more than a quarter turn from upright, back by half a turn: a plate is never read upside down */
export function uprightYaw(yaw: number): number {
  const turn = Math.atan2(Math.sin(yaw), Math.cos(yaw))
  return Math.abs(turn) <= Math.PI / 2 + 1e-9 ? turn : turn - Math.sign(turn) * Math.PI
}

/**
 * What a player's hand is laid out in: where its first card lies, the way it faces (the yaw of its seat), how big its cards are, whether it is the viewer's, and the side of the seat's own x axis that an opponent's backs grow toward from the first one
 * (the viewer's hand is a fan centred on its place).
 */
export type Hand = { at: Place; yaw: number; scale: number; viewer: boolean; side: 1 | -1 }

/**
 * The side of its plate that an opponent's hand lies on, as a sign along the x axis of the seat's frame: the side toward the viewer where the seat's row runs across the depth of the table, so that the hand of a seat at the left or the right is
 * below its plate on the screen, away from the corners where the platform draws its boxes; and the right of the table for the seat across.
 */
function handSide(yaw: number): 1 | -1 {
  const along = alongOf(yaw)
  if (Math.abs(along.z) > 1e-6) return along.z > 0 ? 1 : -1
  return along.x > 0 ? 1 : -1
}

/**
 * What the viewer's fan covers of the table as the camera sees it, along the way out from the middle (the depth of the viewer's frame): where the middle of it is seen relative to the hand's place, and half of its depth. A card of the fan leans toward the viewer
 * by `handTilt` and floats `handLift` above the table: its top edge floats higher and farther from the viewer than its bottom edge, and a point `y` above the table is seen where the table lies `y × tan(VIEW_TILT)` farther from the camera. So the fan is seen
 * higher up the window than the place it lies on, and is deeper than the card is: the play area before it and the plate beyond it are placed by what is seen, so that the hand never covers what the player laid down.
 */
export function fanSeen(scale: number): { middle: number; half: number } {
  const R = LAYOUT_SETTINGS
  const tan = Math.tan((VIEW_TILT * Math.PI) / 180)
  return { middle: -R.handLift * tan, half: ((CARD.height * scale) / 2) * (Math.cos(R.handTilt) + Math.sin(R.handTilt) * tan) + FAN_MARGIN }
}

/** The room added on each side of what the fan covers, in world units: the model of `fanSeen` is the camera's as if it stood far away (the lines of sight are parallel), and the real one, which stands about twenty units off, sees the fan up to a tenth of a unit lower */
const FAN_MARGIN = 0.15

/**
 * The hand of a player. The viewer's lies beyond their play area, between the area and the plate, centred, and is seen clear of both. An opponent's lies beside their plate, on the row that the plate is on, so that the block of a seat is no deeper than its area and its plate: the
 * first back a gap from the plate, the others growing away from it. It takes the frame of its seat.
 */
export function handOf(area: Area, viewer: boolean): Hand {
  const R = LAYOUT_SETTINGS
  const out = outwardOf(area.yaw)
  if (viewer) {
    const seen = fanSeen(R.viewerHandScale)
    // the fan is seen from `middle - half` to `middle + half` of its place: it lies where its near edge, as seen, is a gap from the play area
    const drop = (CARD.height * area.scale) / 2 + R.blockGap + seen.half - seen.middle
    return { at: { x: area.at.x + out.x * drop, z: area.at.z + out.z * drop }, yaw: area.yaw, scale: R.viewerHandScale, viewer, side: 1 }
  }
  const along = alongOf(area.yaw)
  const side = handSide(area.yaw)
  const scale = R.opponentHandScale
  const rowZ = (CARD.height * area.scale) / 2 + R.blockGap + plateSize(area).depth / 2
  const dx = side * (plateSize(area).width / 2 + R.blockGap + (CARD.width * scale) / 2)
  return { at: { x: area.at.x + out.x * rowZ + along.x * dx, z: area.at.z + out.z * rowZ + along.z * dx }, yaw: area.yaw, scale, viewer, side }
}

/** The slots of an opponent's hand, in the frame of its place: a row of backs growing away from the plate, the first beside it, so that a back does not move when another is drawn. */
export function backsPoses(n: number, hand: Pick<Hand, "scale" | "side">): Pose[] {
  const spread = CARD.width * hand.scale * LAYOUT_SETTINGS.backsGap
  return row(n, { gap: spread, face: "down", rise: 0.012, scale: hand.scale }).map((pose) => shifted(pose, { x: (hand.side * Math.max(0, n - 1) * spread) / 2 }))
}

/** The slots of a hand laid face up once a round that ended on a comparison has revealed it, in the frame of its place: a row of faces growing away from the plate, at the scale of the hand. */
export function revealedPoses(n: number, hand: Pick<Hand, "scale" | "side">): Pose[] {
  const spread = CARD.width * hand.scale * LAYOUT_SETTINGS.handGap
  return row(n, { gap: spread, rise: 0.012, scale: hand.scale }).map((pose) => shifted(pose, { x: (hand.side * Math.max(0, n - 1) * spread) / 2 }))
}

/** The slots of the viewer's hand, in the frame of its place: a fan that stands up toward them, the first card on the left. A card held up (`raised`, -1: none) lifts toward them. */
export function fanPoses(n: number, hand: Pick<Hand, "scale">, raised = -1): Pose[] {
  const R = LAYOUT_SETTINGS
  return fan(n, { gap: CARD.width * hand.scale * R.handGap, y: R.handLift, rise: 0.006, curve: R.handCurve, tilt: R.handTilt, roll: 0.04, scale: hand.scale }).map((slot, i) => (i === raised ? shifted(slot, { y: 0.35, z: -0.2 }) : slot))
}

/** How far from the spot of a seat, along the way out, the middle of its plate lies: beyond the hand as seen for the viewer, beyond the play area for an opponent, whose hand lies beside the plate. */
function plateDistance(area: Area, hand: Hand): number {
  const R = LAYOUT_SETTINGS
  const edge = (CARD.height * area.scale) / 2 + R.blockGap
  const half = plateSize(area).depth / 2
  return hand.viewer ? edge + 2 * fanSeen(hand.scale).half + R.blockGap + half : edge + half
}

/**
 * Where the plate of a seat stands, and the yaw of its frame (the way its text reads: name, then the info line, going down the frame's +z). It stands beyond the cards, out from the middle of the table, clear of them by `blockGap`. The seat is drawn
 * with its avatar and its name centred on this place and the tokens hanging off the right of the name, so the place is half the room of the tokens (`PLATE_TRAILING`, at the size of the plate) left of the middle of the box (as read) and `middle` along the plate's own down from it: what is seen is centred in the box.
 */
export function plateAt(spot: SeatSpot, area: Area, hand: Hand, fit = 1): Place & { yaw: number } {
  const yaw = uprightYaw(spot.yaw)
  const out = outwardOf(spot.yaw)
  const down = outwardOf(yaw)
  const along = alongOf(yaw)
  // a plate drawn smaller for a long name (`plateFit`) keeps its centre in the middle of its box
  const { middle, trailing } = plateSize({ plate: area.plate * fit })
  const distance = plateDistance(area, hand)
  return {
    x: area.at.x + out.x * distance - down.x * middle - (along.x * trailing) / 2,
    z: area.at.z + out.z * distance - down.z * middle - (along.z * trailing) / 2,
    yaw,
  }
}

/** The plate's box: the aura as wide as the plate, from above the name to below the status */
export function plateBox(spot: SeatSpot, area: Area, hand: Hand): Box {
  const out = outwardOf(spot.yaw)
  const distance = plateDistance(area, hand)
  const { width, depth } = plateSize(area)
  return { x: area.at.x + out.x * distance, z: area.at.z + out.z * distance, halfWidth: width / 2, halfDepth: depth / 2, yaw: uprightYaw(spot.yaw) }
}

/** The box of a play area of `n` cards (at the most as wide as its room), in the frame of its place */
export function areaBox(area: Area, n: number): Box {
  const card = CARD.width * area.scale
  const width = Math.min(area.width, card + Math.max(0, n - 1) * areaGap(n, area))
  return { x: area.at.x, z: area.at.z, halfWidth: Math.max(card, width) / 2, halfDepth: (CARD.height * area.scale) / 2, yaw: area.yaw }
}

/**
 * The box of a hand of `n` cards, in the frame of its place, as the camera sees it: the viewer's fan is centred on its place across and is seen over the depth that `fanSeen` gives, an opponent's backs lie flat and grow away from the plate, so the middle of
 * the row is `n - 1` half spreads from the first back
 */
export function handBox(hand: Hand, n: number): Box {
  const card = CARD.width * hand.scale
  const spread = card * (hand.viewer ? LAYOUT_SETTINGS.handGap : LAYOUT_SETTINGS.backsGap)
  const shift = hand.viewer ? 0 : (hand.side * Math.max(0, n - 1) * spread) / 2
  const along = alongOf(hand.yaw)
  const out = outwardOf(hand.yaw)
  const seen = hand.viewer ? fanSeen(hand.scale) : { middle: 0, half: (CARD.height * hand.scale) / 2 }
  const width = (card + Math.max(0, n - 1) * spread) / 2
  return { x: hand.at.x + along.x * shift + out.x * seen.middle, z: hand.at.z + along.z * shift + out.z * seen.middle, halfWidth: width, halfDepth: seen.half, yaw: hand.yaw }
}

/** Where the deck, the card set aside beside it and the cards set aside face up lie. */
export function middlePlaces(): { deck: Place; aside: Place; faceUp: Place } {
  const R = LAYOUT_SETTINGS
  return { deck: { x: R.deckX, z: R.deckZ }, aside: { x: R.asideX, z: R.asideZ }, faceUp: { x: R.faceUpX, z: R.faceUpZ } }
}

/** The slots of the three cards set aside face up at two players, in the frame of their place. */
export const faceUpPoses = (n: number): Pose[] => row(n, { gap: CARD.width * LAYOUT_SETTINGS.faceUpScale * 1.1, rise: 0.012, scale: LAYOUT_SETTINGS.faceUpScale })

/** The box of the deck with its count under it, of the card set aside, and of the cards set aside face up (three of them) */
export function middleBoxes(faceUp: boolean): Box[] {
  const R = LAYOUT_SETTINGS
  const { deck, aside, faceUp: up } = middlePlaces()
  const boxes: Box[] = [
    { x: deck.x, z: deck.z + 0.4, halfWidth: (CARD.width * R.deckScale) / 2, halfDepth: (CARD.height * R.deckScale) / 2 + 0.4, yaw: 0 },
    { x: aside.x, z: aside.z, halfWidth: (CARD.width * R.asideScale) / 2, halfDepth: (CARD.height * R.asideScale) / 2, yaw: 0 },
  ]
  if (faceUp) boxes.push({ x: up.x, z: up.z, halfWidth: (CARD.width * R.faceUpScale * 3.2) / 2, halfDepth: (CARD.height * R.faceUpScale) / 2, yaw: 0 })
  return boxes
}

/**
 * The strip in the middle of the table, between the deck and the card set aside, where the viewer is told what to do and where the controls of the moment lie, one thing at a time: the sentence, then one pad (Play, Deal), two (Swap and Keep), or the nine
 * characters a Guard can name. It lies well above the bottom band of the window that the banner of the cookie settings covers, and clear of everything else on the table: `layout.test.ts` and `camera.test.ts` hold both.
 */
export const STRIP = {
  /** Half the width of the strip: the deck lies left of it and the card set aside right of it */
  half: 2.4,
  /** The sentence: where it is centred along z, how wide it may run and how tall its lettering is at most */
  sentence: { z: -1.6, width: 4.7, height: 0.42 },
  /** One pad, centred in the strip: Play, Deal */
  pad: { z: 0.2, width: 2.8, depth: 1.1 },
  /** Two pads side by side: Swap on the left, Keep on the right */
  pair: { z: 0.2, width: 2.3, depth: 1.0, gap: 0.2 },
  /** The nine characters a Guard can name, as small faces in two rows (five, then four, centred), in the order of their value: how big each is (a share of a card of the table), how many are in each row, the gap between two and where the first row lies along z */
  guess: { scale: 0.62, rows: [5, 4] as readonly number[], gap: 0.1, z: -0.55 },
}

/** A pad on the table: where it lies and how big it is, in world units, along x and z */
export type Pad = { x: number; z: number; width: number; depth: number }

/** The pad of a single control: Play, Deal */
export const padPlace = (): Pad => ({ x: 0, ...STRIP.pad })

/** The two pads of a Chancellor's keep: Swap on the left, Keep on the right */
export function pairPlaces(): [Pad, Pad] {
  const { z, width, depth, gap } = STRIP.pair
  const x = (width + gap) / 2
  return [
    { x: -x, z, width, depth },
    { x, z, width, depth },
  ]
}

/** Where the nine characters a Guard can name lie, row by row from the left (the order of `guessable`): each a small face, `width` by `depth` on the table */
export function guessPlaces(count = 9): Pad[] {
  const { scale, rows, gap, z } = STRIP.guess
  const width = CARD.width * scale
  const depth = CARD.height * scale
  return rows
    .flatMap((n, row) => Array.from({ length: n }, (_, i) => ({ x: (i - (n - 1) / 2) * (width + gap), z: z + row * (depth + gap), width, depth })))
    .slice(0, count)
}

/** The slots of the nine small faces, in the frame of the table */
export const guessPoses = (count = 9): Pose[] => guessPlaces(count).map((place) => onTable(place.x, place.z, { scale: STRIP.guess.scale }))

/** The box that holds the sentence and every pad of the strip, whichever is drawn */
export function stripBox(): Box {
  const pads = [padPlace(), ...pairPlaces(), ...guessPlaces()]
  const top = Math.min(STRIP.sentence.z - STRIP.sentence.height, ...pads.map((pad) => pad.z - pad.depth / 2))
  const bottom = Math.max(...pads.map((pad) => pad.z + pad.depth / 2))
  return { x: 0, z: (top + bottom) / 2, halfWidth: STRIP.half, halfDepth: (bottom - top) / 2, yaw: 0 }
}

/**
 * A sentence laid on the table in a strip `width` wide: on one line when its lettering, at about `LETTER` of its height for each letter, fits at `height`; else broken at the space nearest the middle into two lines; else the largest size at which the longer of the two
 * lines fits, never less than half of `height`.
 */
export function fitSentence(text: string, width: number, height: number): { lines: string[]; height: number } {
  const parts = text.trim().split(/\s+/).filter(Boolean)
  const whole = parts.join(" ")
  const across = (line: string) => Array.from(line).length * SENTENCE_LETTER
  if (parts.length <= 1 || across(whole) * height <= width) return { lines: whole === "" ? [] : [whole], height: Math.min(height, whole === "" ? height : width / across(whole)) }
  // the break nearest the middle of the sentence, in letters
  let best: string[] = [whole]
  let gap = Infinity
  for (let i = 1; i < parts.length; i++) {
    const left = parts.slice(0, i).join(" ")
    const right = parts.slice(i).join(" ")
    const spread = Math.abs(Array.from(left).length - Array.from(right).length)
    if (spread < gap) {
      gap = spread
      best = [left, right]
    }
  }
  const longest = Math.max(...best.map(across))
  return { lines: best, height: Math.max(height / 2, Math.min(height, width / longest)) }
}

/** How wide a letter of a sentence on the table is, as a share of its height: the body font in bold, wide enough for the capitals and the digits too */
const SENTENCE_LETTER = 0.58

/** How far a player's zone reaches past what it holds on every side when there is room, in world units: generous, so a click or a tap needs no aim. Each side stops short of whatever is there: another seat's plate, the deck. */
export const ZONE_PADDING = 0.5

/** The least a zone is wide, in world units: a play area with no card in it is still a place to press */
export const ZONE_LEAST_WIDTH = 3

/** What a zone must keep clear of besides other zones: the deck, the card set aside, the cards set aside face up and the strip of the controls */
export const fixedBoxes = (faceUp: boolean): Box[] => [...middleBoxes(faceUp), stripBox()]

/** A box grown by `by` on every side: what a zone keeps clear of, with a little room to spare */
const clear = (box: Box, by = 0.02): Box => ({ ...box, halfWidth: box.halfWidth + by, halfDepth: box.halfDepth + by })

/** A box grown by a padding on each of its four sides (in its own frame: left, right, toward the middle of the table, away from it) */
function padded(box: Box, [left, right, inner, outer]: readonly number[]): Box {
  const along = alongOf(box.yaw)
  const out = outwardOf(box.yaw)
  const du = (right! - left!) / 2
  const dv = (outer! - inner!) / 2
  return {
    x: box.x + along.x * du + out.x * dv,
    z: box.z + along.z * du + out.z * dv,
    halfWidth: box.halfWidth + (left! + right!) / 2,
    halfDepth: box.halfDepth + (inner! + outer!) / 2,
    yaw: box.yaw,
  }
}

/** The smallest rectangle, in the frame of `yaw`, that holds all the boxes */
function around(boxes: Box[], yaw: number): Box {
  const along = alongOf(yaw)
  const out = outwardOf(yaw)
  const points = boxes.flatMap(cornersOf)
  const u = points.map((p) => p.x * along.x + p.z * along.z)
  const v = points.map((p) => p.x * out.x + p.z * out.z)
  const [u0, u1, v0, v1] = [Math.min(...u), Math.max(...u), Math.min(...v), Math.max(...v)]
  const [mu, mv] = [(u0 + u1) / 2, (v0 + v1) / 2]
  return { x: along.x * mu + out.x * mv, z: along.z * mu + out.z * mv, halfWidth: (u1 - u0) / 2, halfDepth: (v1 - v0) / 2, yaw }
}

/**
 * The zone of a seat that the viewer presses to choose a player: for an opponent ONE zone, their play area, their hand and their plate with the name inside it, and a generous padding all round: a press anywhere in it, on the cards, the padding or the name,
 * chooses the player. For the viewer the zone is their play area and what lies beside it: their hand is made of cards that are pressed on their own, so the zone stops short of it. Each side of the padding grows to `ZONE_PADDING` and stops short of whatever
 * `avoid` holds there (the plates of the other seats, the deck), so the zone is as large as the room lets it be.
 */
export function zoneBox(core: Box, avoid: readonly Box[], share = 1): Box {
  const wide = core.halfWidth * 2 < ZONE_LEAST_WIDTH ? { ...core, halfWidth: ZONE_LEAST_WIDTH / 2 } : core
  // a thing the core is already a hair from is kept clear as it is; the others with a little room to spare
  const room = avoid.map((box) => (boxesOverlap(wide, clear(box)) ? box : clear(box)))
  const pad = [0, 0, 0, 0].map((_, side) => {
    let value = ZONE_PADDING * share
    const only = (amount: number) => padded(wide, [0, 1, 2, 3].map((i) => (i === side ? amount : 0)))
    while (value > 0 && room.some((box) => boxesOverlap(only(value), box))) value = Math.max(0, value - 0.05)
    return value
  })
  // the sides together, at the corners: all of the padding shrinks until nothing is touched
  let box = padded(wide, pad)
  for (let i = 0; i < 40 && avoid.some((other) => boxesOverlap(box, other)); i++) {
    for (let k = 0; k < 4; k++) pad[k] = pad[k]! * 0.85
    box = padded(wide, pad)
  }
  return box
}

/** Every box of a table of `n` players, by seat: the plate, the play area, the hand and the zone's core, for the viewer (`seated`) or for a spectator */
type Block = { plate: Box; area: Box; hand: Box; core: Box }

/** The block of every seat, by id, for a table in which the seats stand as `spots` and `placed` say, with the play area and the hand holding `cards` and `held` cards (the nominal count of a table, or the most it may hold when `full`). */
function blocks(spots: ReadonlyMap<string, SeatSpot>, placed: ReadonlyMap<string, Area>, meId: string | null, nominal: { area: number; hand: number }, full: boolean): Map<string, Block> {
  return new Map(
    [...spots].map(([id, spot]) => {
      const area = placed.get(id)!
      const viewer = id === meId
      const hand = handOf(area, viewer)
      const plate = plateBox(spot, area, hand)
      const areaB = full ? { ...areaBox(area, 99), halfWidth: area.width / 2 } : areaBox(area, nominal.area)
      const handB = handBox(hand, nominal.hand)
      // the zone's core: an opponent's area, hand and plate; the viewer's area alone
      const core = viewer ? areaB : around([areaB, handB, plate], spot.yaw)
      return [id, { plate, area: areaB, hand: handB, core }] as const
    }),
  )
}

/**
 * The zone of every seat, by id, for a table in which the seats stand as `spots` and `placed` say. Where two zones overlap, the padding of both shrinks, a little at a time, until they only touch; with no padding a zone is its core, which no other
 * block overlaps.
 */
export function zones(spots: ReadonlyMap<string, SeatSpot>, placed: ReadonlyMap<string, Area>, meId: string | null = null): Map<string, Box> {
  const all = blocks(spots, placed, meId, { area: 3, hand: 3 }, false)
  const faceUp = spots.size === 2
  const ids = [...spots.keys()]
  // what a zone keeps clear of: the plates and the hands of the other seats, which are theirs, and the middle of the table
  const avoidOf = (id: string) => [...ids.filter((other) => other !== id).flatMap((other) => [all.get(other)!.plate, all.get(other)!.hand]), ...fixedBoxes(faceUp)]
  const share = new Map(ids.map((id) => [id, 1]))
  const build = (id: string) => zoneBox(all.get(id)!.core, avoidOf(id), share.get(id))
  const out = new Map(ids.map((id) => [id, build(id)] as const))
  for (let pass = 0; pass < 60; pass++) {
    let touched = false
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        if (!boxesOverlap(out.get(ids[i]!)!, out.get(ids[j]!)!)) continue
        touched = true
        for (const id of [ids[i]!, ids[j]!]) {
          share.set(id, share.get(id)! * 0.9)
          out.set(id, build(id))
        }
      }
    }
    if (!touched) break
  }
  // last resort, with no padding left: the zone narrows along its row, never below its plate
  for (let pass = 0; pass < 100; pass++) {
    let touched = false
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        if (!boxesOverlap(out.get(ids[i]!)!, out.get(ids[j]!)!)) continue
        touched = true
        for (const id of [ids[i]!, ids[j]!]) {
          const box = out.get(id)!
          out.set(id, { ...box, halfWidth: Math.max(all.get(id)!.core.halfWidth * 0.5, box.halfWidth * 0.97) })
        }
      }
    }
    if (!touched) break
  }
  return out
}

/** The zone of every seat of a table of `n` players, in turn order from the viewer (the first is the viewer's), for the tests that keep them apart from each other and from the middle */
export function zoneBoxes(n: number, seated = true): Box[] {
  const ids = Array.from({ length: n }, (_, i) => String(i))
  const viewer = seated ? "0" : null
  const spots = seatSpots(ids, viewer)
  const all = zones(spots, areas(spots, viewer), viewer)
  return ids.map((id) => all.get(id)!)
}

/**
 * Where things stand on a table of `n` players, as boxes: the plate of each seat, its play area (three cards, or all the room it may take when `full`) and its hand (two cards), and the deck with its count, the card set aside and, at two players, the three
 * cards set aside face up, and the strip of the controls. The viewer is the first seat; a spectator (`seated` false) has none.
 */
export function tableBoxes(n: number, full = false, seated = true): Box[] {
  const ids = Array.from({ length: n }, (_, i) => String(i))
  const viewer = seated ? "0" : null
  const spots = seatSpots(ids, viewer)
  const placed = areas(spots, viewer)
  const all = blocks(spots, placed, viewer, { area: 3, hand: 2 }, full)
  return [...[...all.values()].flatMap((block) => [block.plate, block.area, block.hand]), ...middleBoxes(n === 2), stripBox()]
}

/** A box on the other side of the table: the same distance from the middle line, turned the other way */
const mirrored = (box: Box): Box => ({ ...box, x: -box.x, yaw: -box.yaw })

/**
 * What the camera centres the window on (`fitCamera`): the corners of the plate and the play area of every seat, at their nominal sizes, the viewer's hand, and the middle of the table with its mirror image, what is drawn. The middle band is read as a
 * whole that is the same on both sides (the deck on one, the card set aside and the three set aside face up on the other), so that the scene stays in the middle of the window whatever lies in either half of it. An opponent's hand is left out: it is in the
 * zone of its seat (`reachQuads`), the camera keeps it in the window, and it is too small a thing for the platform's boxes to be measured on. A longer area spreads, and may reach farther than this.
 */
export function seenBoxes(n: number, seated = true): Box[] {
  const ids = Array.from({ length: n }, (_, i) => String(i))
  const viewer = seated ? "0" : null
  const spots = seatSpots(ids, viewer)
  const all = blocks(spots, areas(spots, viewer), viewer, { area: 3, hand: 2 }, false)
  const middle = middleBoxes(n === 2)
  return [...[...all].flatMap(([id, block]) => (id === viewer ? [block.plate, block.area, block.hand] : [block.plate, block.area])), ...middle, ...middle.map(mirrored)]
}

export const seenQuads = (n: number, seated = true): Place[][] => seenBoxes(n, seated).map(cornersOf)

/** What the camera has to have in the window too, without it weighing on the centre: the zones that the viewer presses to choose a player (`zoneBoxes`), which hold the hands of the opponents and reach a little past the plates, and must never lie under a box of the platform. */
export const reachQuads = (n: number, seated = true): Place[][] => zoneBoxes(n, seated).map(cornersOf)

/** Everything the camera has to bring into the window, what is seen and what is reached */
export const tableQuads = (n: number, seated = true): Place[][] => [...seenQuads(n, seated), ...reachQuads(n, seated)]

/** Where the cards are dealt from: above the deck, face down. */
export function dealtFrom(): Pose {
  const { deck } = middlePlaces()
  return onTable(deck.x, deck.z, { y: 1.6, face: "down", scale: LAYOUT_SETTINGS.deckScale })
}
