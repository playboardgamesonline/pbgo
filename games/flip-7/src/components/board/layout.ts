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
  pilesX: 3,
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

/**
 * The strip of the table between the two piles, where the viewer's choices and the card to give lie. It is as deep as the piles and its three gaps are one length (`gap`): pile to pad, pad to pad, pad to discard, or pile to card, card to text, text to discard.
 * Hit and Stay (or Deal alone) stand in it on the viewer's turn, and an action card drawn with its prompt: the two never show at once.
 */
export const FLOOR = { gap: 0.3 }

export type Pad = { x: number; z: number; width: number; depth: number }

export type FloorPlan = {
  /** Hit on the left, Stay on its right, each the width of half the strip less the gaps, and as deep as the piles */
  hit: Pad
  stay: Pad
  /** Deal, for the dealer between two rounds: one pad across the room of the two */
  deal: Pad
  /** The action card drawn, face up, in the place of Hit and the size of the piles' cards */
  card: Place & { scale: number }
  /** The room for the words beside the card: its left edge, its width and its depth */
  prompt: Pad
  /** The whole strip, for the footprints */
  strip: Pad
}

export function floorPlan(): FloorPlan {
  const R = LAYOUT_SETTINGS
  const { deck, discard } = pilePlaces()
  const cardWidth = CARD.width * R.pileScale
  const depth = CARD.height * R.pileScale
  const left = deck.x + cardWidth / 2
  const right = discard.x - cardWidth / 2
  const g = FLOOR.gap
  const padWidth = (right - left - 3 * g) / 2
  const z = deck.z
  const hit = { x: left + g + padWidth / 2, z, width: padWidth, depth }
  const stay = { ...hit, x: hit.x + padWidth + g }
  const deal = { x: (left + right) / 2, z, width: 2 * padWidth + g, depth }
  const cardX = left + g + cardWidth / 2
  const textLeft = cardX + cardWidth / 2 + g
  const textWidth = right - g - textLeft
  return {
    hit,
    stay,
    deal,
    card: { x: cardX, z, scale: R.pileScale },
    prompt: { x: textLeft + textWidth / 2, z, width: textWidth, depth },
    strip: { x: (left + right) / 2, z, width: right - left, depth },
  }
}

/**
 * A sentence cut into lines of at most `max` characters, at the spaces, for lettering laid flat: a word longer than a line stays whole on a line of its own. The words are the game's, in the visitor's language, so the length is not known in advance.
 */
export function wrapWords(text: string, max: number): string[] {
  const lines: string[] = []
  let line = ""
  for (const word of text.split(/\s+/).filter(Boolean)) {
    if (line && Array.from(`${line} ${word}`).length > max) {
      lines.push(line)
      line = word
    } else line = line ? `${line} ${word}` : word
  }
  if (line) lines.push(line)
  return lines
}

/**
 * A sentence laid flat in a room of `width` by `depth`: the lines it breaks into and the size of the letters. It starts at the size asked for and shrinks the letters until the lines fit the depth (each line takes `1.25` times the height), never below `least`.
 * A letter is about 0.62 of its height wide.
 */
export function fitPrompt(text: string, width: number, depth: number, preferred = 0.42, least = 0.24): { lines: string[]; height: number; step: number } {
  let height = preferred
  for (;;) {
    const lines = wrapWords(text, Math.max(1, Math.floor(width / (height * 0.62))))
    const step = height * 1.25
    if (lines.length * step <= depth || height <= least) return { lines, height, step }
    height = Math.max(least, height - 0.02)
  }
}

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

/** How far a player's zone reaches past their cards on every side when there is room, in world units: generous, so a click or a tap needs no aim. Each side stops short of whatever is there: the plate, a pile, the buttons. */
export const ZONE_PADDING = 0.5

/** The widest a zone gets, in world units: the viewer's line may spread across the whole front of the table, and a zone as wide as that would be a band, not the place of a seat */
export const ZONE_MAX_WIDTH = 7

/** What a zone must keep clear of besides other zones: the two piles with their count and the strip between them (the plates of the seats are added by `zones`) */
export function fixedBoxes(): Box[] {
  const R = LAYOUT_SETTINGS
  const { deck, discard } = pilePlaces()
  const { strip } = floorPlan()
  const pile = (CARD.width * R.pileScale) / 2
  const depth = (CARD.height * R.pileScale) / 2
  return [
    { x: strip.x, z: strip.z, halfWidth: strip.width / 2, halfDepth: strip.depth / 2, yaw: 0 },
    { x: deck.x, z: deck.z, halfWidth: pile, halfDepth: depth + 0.8, yaw: 0 },
    { x: discard.x, z: discard.z, halfWidth: pile, halfDepth: depth, yaw: 0 },
  ]
}

/** Where the cards of a seat lie, as the box a zone is built around, in the frame of the line: the line's room (at the widest `ZONE_MAX_WIDTH`) by the height of a card, and, when the room is free of `avoid`, the small row of the cards set aside beside it */
function cardsBox(line: Line, viewer: boolean, avoid: readonly Box[], withHeld = true): Box {
  const own: Box = { x: line.at.x, z: line.at.z, halfWidth: Math.min(line.width, ZONE_MAX_WIDTH) / 2, halfDepth: (CARD.height * line.scale) / 2, yaw: line.yaw }
  const place = heldPlace(line, viewer)
  const held: Box = { x: place.x, z: place.z, halfWidth: (3 * CARD.width * line.scale * LAYOUT_SETTINGS.heldScale * 1.1) / 2, halfDepth: (CARD.height * line.scale * LAYOUT_SETTINGS.heldScale) / 2, yaw: line.yaw }
  if (!withHeld || avoid.some((box) => boxesOverlap(held, box))) return own
  const along = alongOf(line.yaw)
  const out = outwardOf(line.yaw)
  const points = [...cornersOf(own), ...cornersOf(held)]
  const u = points.map((p) => p.x * along.x + p.z * along.z)
  const v = points.map((p) => p.x * out.x + p.z * out.z)
  const [u0, u1, v0, v1] = [Math.min(...u), Math.max(...u), Math.min(...v), Math.max(...v)]
  const [mu, mv] = [(u0 + u1) / 2, (v0 + v1) / 2]
  const merged: Box = { x: along.x * mu + out.x * mv, z: along.z * mu + out.z * mv, halfWidth: (u1 - u0) / 2, halfDepth: (v1 - v0) / 2, yaw: line.yaw }
  // the rectangle that holds both is bigger than the two together: it must not run into anything either
  return avoid.some((box) => boxesOverlap(merged, box)) ? own : merged
}

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

/**
 * The zone of a seat that the viewer presses to give it a card: the player's cards (their line, and the cards set aside when they have room) and a generous padding all round, and nothing else. The plate, with the name, is NOT in it: it stands beside the zone,
 * outside, and is never covered. Each side of the padding grows to `ZONE_PADDING` and stops short of whatever `avoid` holds there (the plates, the piles, the buttons), so the zone is as large as the room lets it be.
 */
export function zoneBox(line: Line, viewer: boolean, avoid: readonly Box[], share = 1): Box {
  // with no padding left to give, the zone is the cards alone: the box that holds the cards set aside as well may be what runs into a neighbour
  const core = cardsBox(line, viewer, avoid, share > 0.3)
  // a thing the cards are already a hair from is kept clear as it is; the others with a little room to spare
  const room = avoid.map((box) => (boxesOverlap(core, clear(box)) ? box : clear(box)))
  const pad = [0, 0, 0, 0].map((_, side) => {
    let value = ZONE_PADDING * share
    const only = (amount: number) => padded(core, [0, 1, 2, 3].map((i) => (i === side ? amount : 0)))
    while (value > 0 && room.some((box) => boxesOverlap(only(value), box))) value = Math.max(0, value - 0.05)
    return value
  })
  // the sides together, at the corners: all of the padding shrinks until nothing is touched
  let box = padded(core, pad)
  for (let i = 0; i < 40 && avoid.some((other) => boxesOverlap(box, other)); i++) {
    for (let k = 0; k < 4; k++) pad[k] = pad[k]! * 0.85
    box = padded(core, pad)
  }
  return box
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
 * The zone of every seat, by id, for a table in which the seats stand as `spots` and `placed` say. Where two zones overlap, the padding of both shrinks, a little at a time, until they only touch; with no padding a zone is the cards alone, which no other line overlaps.
 */
export function zones(spots: ReadonlyMap<string, SeatSpot>, placed: ReadonlyMap<string, Line>, meId: string | null = null): Map<string, Box> {
  const plates = [...spots].map(([id, spot]) => plateBox(spot, placed.get(id)!))
  const avoid = [...plates, ...fixedBoxes()]
  const ids = [...spots.keys()]
  const share = new Map(ids.map((id) => [id, 1]))
  const build = (id: string) => zoneBox(placed.get(id)!, id === meId, avoid, share.get(id))
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
  return out
}

/** The zone of every seat of a table of `n` players, in turn order from the viewer (the first is the viewer's), for the tests that keep them apart from each other and from the piles */
export function zoneBoxes(n: number, seated = true): Box[] {
  const ids = Array.from({ length: n }, (_, i) => String(i))
  const viewer = seated ? "0" : null
  const spots = seatSpots(ids, viewer)
  const all = zones(spots, lines(spots, viewer), viewer)
  return ids.map((id) => all.get(id)!)
}

/**
 * Where things stand on a table of `n` players, as boxes: the plate of each seat and its line (a line of three cards for an opponent and of four for the viewer, or all the room the line may take when `full`), the piles with their count, and the strip between them (Hit and Stay, or the action card to give). The viewer is the first seat; a spectator (`seated` false) has none.
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
  // the draw pile with its count below it; the discard has its pile alone
  out.push({ x: deck.x, z: deck.z, halfWidth: (CARD.width * R.pileScale) / 2, halfDepth: pile + 0.8, yaw: 0 })
  out.push({ x: discard.x, z: discard.z, halfWidth: (CARD.width * R.pileScale) / 2, halfDepth: pile, yaw: 0 })
  const { strip } = floorPlan()
  out.push({ x: strip.x, z: strip.z, halfWidth: strip.width / 2, halfDepth: strip.depth / 2, yaw: 0 })
  return out
}

/** What the camera has to bring into the window, and to keep clear of what the platform draws over it (`fitCamera`): the corners of each box of the table (`tableBoxes`), at their nominal sizes, and the zones that the viewer presses to give a card (`zoneBoxes`), which reach a little past the plates and must never lie under a box of the platform. A longer line spreads, and may reach farther. */
export const tableQuads = (n: number, seated = true): Place[][] => [...tableBoxes(n, false, seated), ...zoneBoxes(n, seated)].map(cornersOf)

/** Where the cards are dealt from: above the draw pile, face down. */
export function dealtFrom(): Pose {
  const { deck } = pilePlaces()
  return onTable(deck.x, deck.z, { y: 1.6, face: "down", scale: LAYOUT_SETTINGS.pileScale })
}
