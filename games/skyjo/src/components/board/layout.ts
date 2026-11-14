import { type Field, onTable, type Pose, SEAT_SETTINGS, type Spot } from "@pbgo/table"

/** A seat at the table: where it stands and the yaw that turns what lies there to face its player: the viewer's seat is at yaw 0, a seat across from them at π, one on their left at -π/2 */
export type SeatSpot = Required<Spot>

/** A place on the table, in world units: x to the right, z toward the viewer */
export type Place = { x: number; z: number }

/**
 * The knobs of the layout, edited by the Layout folder of the debug panel (`scene.tsx` binds them with `useSettings`). The seats stand all around the table like the chairs of a real one, the viewer in front, and what lies at a seat (its grid of
 * 4 columns by 3 rows, its plate) turns to face the player who sits there. The ring is the one of Flip 7 (`seatAngle`, `seatAt`), for 2 to 8 seats.
 */
export const LAYOUT_SETTINGS = {
  /** The ellipse the grids of the seats are centred on, for a table of two and for a table of eight (in between, in steps). Its far end is the grid of the seat across, its sides those of the seats at the sides; the viewer's grid stands in front of it at
   * `viewerZ`. How far the camera stands is not a knob: it is fitted to the window (`fitCamera`) */
  radiusX2: 5.249,
  radiusX8: 3.82,
  radiusZ2: 4.2,
  radiusZ8: 6.117,
  /** The size of the cards of the opponents, for a table of two and for a table of eight: a small table has big cards, a full one small ones */
  opponentScale2: 0.655,
  opponentScale8: 0.414,
  /** The viewer's grid: how far toward them it lies and how big its cards are */
  viewerZ: 3.85,
  viewerScale: 0.738,
  /** The gap between two columns of a grid, as a share of the width of a card, and the step between two rows, as a share of its height: below 1 the rows overlap, so that the figure in the corner of each card stays readable */
  columnGap: 1.08,
  rowStep: 0.707,
  /** 1: the grid of an opponent turns to face its player (the cards of the seat across from the viewer are upside down for the viewer, as on a real table); 0: every grid reads upright from the viewer's side */
  faceSeat: 1,
  /** 1: the plate of a seat (name, score, status) turns with the seat, but never upside down: a text that would be turned more than a quarter turn from upright is turned back by half a turn; 0: every plate reads upright */
  textTurn: 1,
  /** The clear space between a grid and its plate, in world units */
  plateGap: 0.2,
  /** The draw pile and the discard, either side of the card in hand, in the middle of the table */
  pilesX: 1.423,
  pilesZ: 0.1,
  pileScale: 0.706,
  /** The card in hand lies between the piles, a little bigger than they are */
  heldScale: 0.839,
}

export const LAYOUT_FIELDS: Record<keyof typeof LAYOUT_SETTINGS, Field> = {
  radiusX2: ["ring radius x · 2 players", 3, 12, 0.1],
  radiusX8: ["ring radius x · 8 players", 3, 14, 0.1],
  radiusZ2: ["ring radius z · 2 players", 2, 8, 0.1],
  radiusZ8: ["ring radius z · 8 players", 2, 10, 0.1],
  opponentScale2: ["opponent card scale · 2", 0.2, 1.2, 0.01],
  opponentScale8: ["opponent card scale · 8", 0.2, 1, 0.01],
  viewerZ: ["viewer grid z", 0, 8, 0.05],
  viewerScale: ["viewer card scale", 0.3, 1.2, 0.01],
  columnGap: ["column gap (cards)", 1, 1.4, 0.01],
  rowStep: ["row step (cards)", 0.5, 1.1, 0.01],
  faceSeat: ["grids face their seat (0 off, 1 on)", 0, 1, 1],
  textTurn: ["plates turn with their seat (0 off, 1 on)", 0, 1, 1],
  plateGap: ["plate gap", 0, 2, 0.05],
  pilesX: ["piles x", 1, 3, 0.05],
  pilesZ: ["piles z", -3, 3, 0.05],
  pileScale: ["pile scale", 0.4, 1.4, 0.01],
  heldScale: ["card in hand scale", 0.4, 1.4, 0.01],
}

/** The width and height of a card of the game, in world units: the faces of Sanity are 296 by 476 */
export const CARD = { width: 1.2, height: 1.93 }

/** What grows with the table, for `n` players: from the values for two (the fewest) to those for eight (the most), in steps in between. */
export function tableOf(n: number) {
  const R = LAYOUT_SETTINGS
  const t = Math.min(1, Math.max(0, (n - 2) / 6))
  const between = (two: number, eight: number) => two + (eight - two) * t
  return {
    radiusX: between(R.radiusX2, R.radiusX8),
    radiusZ: between(R.radiusZ2, R.radiusZ8),
    opponentScale: between(R.opponentScale2, R.opponentScale8),
  }
}

/**
 * Where the seats stand around the table, as angles in degrees: 0 is in front of the viewer, and the angle grows clockwise as the camera sees it (90 is the left side, 180 straight across, 270 the right side). `FIRST_OPPONENT` is where the player after the
 * viewer sits, which is also how far from the viewer's seat the first and the last opponent keep: the wide grid of the viewer needs the room, and the more players the less each of them needs. The other opponents are spread evenly between the first and the last.
 */
const FIRST_OPPONENT: Readonly<Record<number, number>> = { 2: 180, 3: 145, 4: 90, 5: 90, 6: 66, 7: 62, 8: 60 }

/**
 * The angle of a seat on the ring, in degrees clockwise from the viewer's: `index` counts the players in turn order from the viewer (0), `count` is the number of players. Without a viewer (`seated` false, a spectator's view) the seats are the
 * ones of a table with one more player, the empty chair in front being the one that nobody has: nobody sits where the viewer would, and the front keeps the room for the piles and the buttons.
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
  const viewer = ids.indexOf(meId ?? "")
  const seated = viewer >= 0
  // a spectator looks at a table with one more chair, the empty one in front: its seats and its grids are those of that table
  const table = tableOf(seated ? ids.length : ids.length + 1)
  // nine chairs on the ring of eight are closer together than the plates allow: a spectator of a full table gets a wider ring
  const widen = !seated && ids.length >= 8 ? 1.25 : 1
  const radiusX = table.radiusX * widen
  const radiusZ = table.radiusZ * widen
  return new Map(
    ids.map((id, i): [string, SeatSpot] => {
      const index = seated ? (i - viewer + ids.length) % ids.length : i
      if (seated && index === 0) return [id, { x: 0, z: LAYOUT_SETTINGS.viewerZ, yaw: 0 }]
      return [id, seatAt(seatAngle(index, ids.length, seated), radiusX, radiusZ)]
    }),
  )
}

/** What a player's grid is laid out in: where its centre lies, which way it faces (the yaw of its frame) and how big its cards are */
export type Grid = { at: Place; yaw: number; scale: number }

/** The way along the frame of a yaw that a row runs (its x axis) and the way its player faces away from the middle, outward (its +z axis), in the table's frame */
const alongOf = (yaw: number): Place => ({ x: Math.cos(yaw), z: -Math.sin(yaw) })
const outwardOf = (yaw: number): Place => ({ x: Math.sin(yaw), z: Math.cos(yaw) })

/** The grid of every player, by id: the viewer's in front of them, an opponent's where its seat is, turned to face its player. */
export function grids(spots: ReadonlyMap<string, SeatSpot>, meId: string | null): Map<string, Grid> {
  const R = LAYOUT_SETTINGS
  const seated = meId !== null && spots.has(meId)
  // a spectator of a full table looks at nine chairs on the ring of eight: the cards of the opponents are a little smaller so that neighbours keep apart
  const { opponentScale: base } = tableOf(seated ? spots.size : spots.size + 1)
  const opponentScale = !seated && spots.size >= 8 ? base * 0.82 : base
  return new Map(
    [...spots].map(([id, spot]): [string, Grid] => [
      id,
      id === meId ? { at: { x: 0, z: R.viewerZ }, yaw: 0, scale: R.viewerScale } : { at: { x: spot.x, z: spot.z }, yaw: R.faceSeat ? spot.yaw : 0, scale: opponentScale },
    ]),
  )
}

/** The size of a card of a grid, in world units */
export const cardSize = (scale: number) => ({ width: CARD.width * scale, height: CARD.height * scale })

/** The distance between two columns and between two rows of a grid of cards at `scale` (the centres) */
export function pitchOf(scale: number): { x: number; z: number } {
  const R = LAYOUT_SETTINGS
  return { x: CARD.width * scale * R.columnGap, z: CARD.height * scale * R.rowStep }
}

/** The whole grid of cards at `scale`: its width along its rows and its depth along its columns */
export function gridSize(scale: number): { width: number; depth: number } {
  const pitch = pitchOf(scale)
  const card = cardSize(scale)
  return { width: 3 * pitch.x + card.width, depth: 2 * pitch.z + card.height }
}

/** Where the cell `position` (`column * 3 + row`) of a grid lies, in the frame of the grid: columns left to right, the first row farthest from its player, toward the middle of the table */
export function cellSpot(position: number, scale: number): Place {
  const pitch = pitchOf(scale)
  const column = Math.floor(position / 3)
  const row = position % 3
  return { x: (column - 1.5) * pitch.x, z: (row - 1) * pitch.z }
}

/** The slot of the cell `position` in the frame of its grid: a card lying face up or face down, a hair higher than the one above it so that cards that overlap never fight for a pixel. */
export function cellPose(position: number, up: boolean, scale: number): Pose {
  const { x, z } = cellSpot(position, scale)
  return onTable(x, z, { y: 0.03 + 0.004 * (position % 3), face: up ? "up" : "down", scale })
}

/** Where the cell `position` of a grid lies on the table, as a place and the yaw of its frame */
export function cellPlace(grid: Grid, position: number): Place & { yaw: number } {
  const local = cellSpot(position, grid.scale)
  const along = alongOf(grid.yaw)
  const out = outwardOf(grid.yaw)
  return { x: grid.at.x + local.x * along.x + local.z * out.x, z: grid.at.z + local.x * along.z + local.z * out.z, yaw: grid.yaw }
}

/** A rectangle of the table that is turned: its centre, half its width along its own x axis, half its depth along its own z axis, and the yaw of that frame (the frame of a seat: x runs along a row, +z points outward) */
export type Box = { x: number; z: number; halfWidth: number; halfDepth: number; yaw: number }

/** The box of the whole grid of a seat */
export function gridBox(grid: Grid): Box {
  const { width, depth } = gridSize(grid.scale)
  return { x: grid.at.x, z: grid.at.z, halfWidth: width / 2, halfDepth: depth / 2, yaw: grid.yaw }
}

/**
 * The zone of a cell that its player presses: the card plus a margin that fills the room between it and its neighbours, so that the twelve zones tile the whole grid, with no gap and no overlap. A column is `pitch.x` wide and the rows of a column are
 * `pitch.z` apart; the first row reaches up to the top edge of its card and the last down to the bottom edge of its card, which the rows above overlap.
 */
export function cellZone(grid: Grid, position: number): Box {
  const pitch = pitchOf(grid.scale)
  const card = cardSize(grid.scale)
  const row = position % 3
  const top = row === 0 ? card.height / 2 : pitch.z / 2
  const bottom = row === 2 ? card.height / 2 : pitch.z / 2
  const local = cellSpot(position, grid.scale)
  const along = alongOf(grid.yaw)
  const out = outwardOf(grid.yaw)
  const shift = (bottom - top) / 2
  const z = local.z + shift
  return {
    x: grid.at.x + local.x * along.x + z * out.x,
    z: grid.at.z + local.x * along.z + z * out.z,
    halfWidth: pitch.x / 2,
    halfDepth: (top + bottom) / 2,
    yaw: grid.yaw,
  }
}

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

/** Where the plate of a seat stands, and the yaw of its frame (the way its text reads: name, then score, then status, going down the frame's +z). It stands beyond the grid, out from the middle of the table, clear of it by `plateGap`. */
export function plateAt(spot: SeatSpot, grid: Grid): Place & { yaw: number } {
  const R = LAYOUT_SETTINGS
  const yaw = R.textTurn ? uprightYaw(spot.yaw) : 0
  const out = outwardOf(spot.yaw)
  // how far the grid's box reaches along the way out, and how far the plate reaches back toward the grid: the name when the plate's own down points out, the status when it points in
  const { width, depth } = gridSize(grid.scale)
  const along = alongOf(grid.yaw)
  const across = outwardOf(grid.yaw)
  const reach = (Math.abs(out.x * along.x + out.z * along.z) * width + Math.abs(out.x * across.x + out.z * across.z) * depth) / 2
  const folded = Math.cos(yaw - spot.yaw) < 0
  const back = folded ? PLATE.drop : PLATE.lift
  const distance = reach + R.plateGap + back
  return { x: grid.at.x + out.x * distance, z: grid.at.z + out.z * distance, yaw }
}

/** The plate's box: the aura as wide as the plate, from above the name to below the status */
export function plateBox(spot: SeatSpot, grid: Grid): Box {
  const place = plateAt(spot, grid)
  const middle = (PLATE.drop - PLATE.lift) / 2
  const down = outwardOf(place.yaw)
  return { x: place.x + down.x * middle, z: place.z + down.z * middle, halfWidth: SEAT_SETTINGS.auraWidth / 2, halfDepth: (PLATE.drop + PLATE.lift) / 2, yaw: place.yaw }
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

/** Where the draw pile, the card in hand and the discard lie: the piles either side of the middle of the table, the card in hand between them. */
export function pilePlaces(): { deck: Place; held: Place; discard: Place } {
  const R = LAYOUT_SETTINGS
  return { deck: { x: -R.pilesX, z: R.pilesZ }, held: { x: 0, z: R.pilesZ }, discard: { x: R.pilesX, z: R.pilesZ } }
}

/** One gap, the same between a pile and a pad, between two pads and between a pad and the text: the pads, the piles and the words of the middle of the table are laid out with it. */
export const FLOOR = { gap: 0.3, padDepth: 0.85 }

export type Pad = { x: number; z: number; width: number; depth: number }

export type FloorPlan = {
  /** Draw (under the draw pile) and Take (under the discard), on the viewer's choice; Throw away (under the discard) when they hold a card they drew */
  draw: Pad
  take: Pad
  throwAway: Pad
  /** Deal, for the dealer between two rounds: one pad across the room of the two */
  deal: Pad
  /** The room for the instruction written flat on the table, above the piles and the card in hand and the count of the draw pile */
  prompt: Pad
  /** The whole middle, for the footprints: the piles, the card in hand, the pads and the instruction */
  strip: Pad
}

export function floorPlan(): FloorPlan {
  const R = LAYOUT_SETTINGS
  const { deck, discard } = pilePlaces()
  const pile = CARD.height * R.pileScale
  const g = FLOOR.gap
  // the pads are as wide as the room between the middles of the two piles, less a gap
  const width = 2 * R.pilesX - g
  const z = R.pilesZ + pile / 2 + g + FLOOR.padDepth / 2
  const draw = { x: deck.x, z, width, depth: FLOOR.padDepth }
  const take = { x: discard.x, z, width, depth: FLOOR.padDepth }
  const promptWidth = 4 * R.pilesX
  const promptDepth = 0.9
  const prompt = { x: 0, z: R.pilesZ - pile / 2 - g - promptDepth / 2, width: promptWidth, depth: promptDepth }
  const top = prompt.z - promptDepth / 2
  const bottom = z + FLOOR.padDepth / 2
  return {
    draw,
    take,
    throwAway: { ...take },
    deal: { x: 0, z, width: 2 * width + g, depth: FLOOR.padDepth },
    prompt,
    strip: { x: 0, z: (top + bottom) / 2, width: 2 * R.pilesX + CARD.width * R.pileScale, depth: bottom - top },
  }
}

/** A sentence cut into lines of at most `max` characters, at the spaces, for lettering laid flat: a word longer than a line stays whole on a line of its own. The words are the game's, in the visitor's language, so the length is not known in advance. */
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

/** A sentence laid flat in a room of `width` by `depth`: the lines it breaks into and the size of the letters. It starts at the size asked for and shrinks the letters until the lines fit the depth (each line takes `1.25` times the height), never below `least`. A letter is about 0.62 of its height wide. */
export function fitPrompt(text: string, width: number, depth: number, preferred = 0.38, least = 0.22): { lines: string[]; height: number; step: number } {
  let height = preferred
  for (;;) {
    const lines = wrapWords(text, Math.max(1, Math.floor(width / (height * 0.62))))
    const step = height * 1.25
    if (lines.length * step <= depth || height <= least) return { lines, height, step }
    height = Math.max(least, height - 0.02)
  }
}

/**
 * Where things stand on a table of `n` players, as boxes: the plate and the grid of each seat, the piles and the card in hand, the pads and the instruction. The viewer is the first seat; a spectator (`seated` false) has none.
 */
export function tableBoxes(n: number, seated = true): Box[] {
  const R = LAYOUT_SETTINGS
  const ids = Array.from({ length: n }, (_, i) => String(i))
  const viewer = seated ? "0" : null
  const spots = seatSpots(ids, viewer)
  const placed = grids(spots, viewer)
  const out: Box[] = []
  for (const [id, spot] of spots) {
    const grid = placed.get(id)!
    out.push(plateBox(spot, grid), gridBox(grid))
  }
  const { deck, held, discard } = pilePlaces()
  const pile = (CARD.height * R.pileScale) / 2
  out.push({ x: deck.x, z: deck.z, halfWidth: (CARD.width * R.pileScale) / 2, halfDepth: pile, yaw: 0 })
  out.push({ x: discard.x, z: discard.z, halfWidth: (CARD.width * R.pileScale) / 2, halfDepth: pile, yaw: 0 })
  out.push({ x: held.x, z: held.z, halfWidth: (CARD.width * R.heldScale) / 2, halfDepth: (CARD.height * R.heldScale) / 2, yaw: 0 })
  const { strip } = floorPlan()
  out.push({ x: strip.x, z: strip.z, halfWidth: strip.width / 2, halfDepth: strip.depth / 2, yaw: 0 })
  return out
}

/** What the camera has to bring into the window, and to keep clear of what the platform draws over it (`fitCamera`): the corners of each box of the table (`tableBoxes`). */
export const tableQuads = (n: number, seated = true): Place[][] => tableBoxes(n, seated).map(cornersOf)

/** Where the cards are dealt from: above the draw pile, face down. */
export function dealtFrom(): Pose {
  const { deck } = pilePlaces()
  return onTable(deck.x, deck.z, { y: 1.6, face: "down", scale: LAYOUT_SETTINGS.pileScale })
}
