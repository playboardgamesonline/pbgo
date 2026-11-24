import { COLUMNS, ROWS } from "@skyjo/engine"
import { boxOfPoses, byPlayers, cornersOfBox, type Field, onAxis, onTable, PILE_LABEL_GAP, PILE_LABEL_HEIGHT, type Place, plateAbove, plateBoxOf, type Pose, pointInFrame, SEAT_SETTINGS, type SeatSettings, seats, type Spot, type TableBox } from "@pbgo/table"

/** A seat at the table: where it stands and the yaw that turns what lies there to face the middle, as the player who sits there sees it: the viewer's seat is at yaw 0, the one across at half a turn, one on their left at -π/2 */
export type SeatSpot = Required<Spot>

/**
 * The knobs of the layout, edited by the Layout folder of the debug panel (`scene.tsx` binds them with `useSettings`). The seats stand all around the table like the chairs of a real one, the viewer in front (`seats` of the table kit), and everything of a player stands in
 * the frame of their seat, turned as their name is: the plate above their grid, which is 4 columns by 3 rows.
 */
export const LAYOUT_SETTINGS = {
  /** The ellipse the grids of the seats are centred on, for a table of two and for a table of eight (in between, in steps). Its far end is the grid of the seat across, its sides those of the seats at the sides; the viewer's grid stands in front of it at `viewerZ`. How far the
   * camera stands is not a knob: it is fitted to the window (`fitCamera`) */
  radiusX2: 5.12,
  radiusX8: 5.56,
  radiusZ2: 6.24,
  radiusZ8: 7.33,
  /** The size of the cards of the opponents, for a table of two and for a table of eight: a small table has big cards, a full one small ones */
  opponentScale2: 0.62,
  opponentScale8: 0.46,
  /** The viewer's grid: how far toward them it lies and how big its cards are */
  viewerZ: 5.08,
  viewerScale: 0.66,
  /** The step between two columns of a grid, as a share of the width of a card, and between two rows, as a share of its height: 1.1 leaves a gap of a tenth of a card between neighbours, both ways. Cards never overlap (`layout.test.ts` holds a margin): the figures stay
   * readable by the size of the cards */
  columnGap: 1.1,
  rowStep: 1.1,
  /** The draw pile and the discard, either side of the card in hand, in the middle of the table */
  pilesX: 1.23,
  pilesZ: -0.03,
  pileScale: 0.818,
  /** The card in hand lies between the piles, a little bigger than they are */
  heldScale: 0.736,
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
  columnGap: ["column step (cards)", 1.05, 1.4, 0.01],
  rowStep: ["row step (cards)", 1.05, 1.4, 0.01],
  pilesX: ["piles x", 1, 3, 0.05],
  pilesZ: ["piles z", -3, 3, 0.05],
  pileScale: ["pile scale", 0.4, 1.4, 0.01],
  heldScale: ["card in hand scale", 0.4, 1.4, 0.01],
}

/**
 * The width and height of a card of the game, in world units, and the radius of its corners. The faces of Sanity are 296 by 476, with a white contour 16 units wide whose outer corners are an arc of 25 units, transparent beyond it. The card has to be cut
 * where the contour is, or the transparent corner pixels of the picture lie on the card and read black: the table's default radius (6% of the smaller side, 18 units here) leaves a black crescent in each corner. The table draws a corner as a quadratic
 * curve, which at 45 degrees passes 6% of its radius nearer the corner than a circular arc of the same radius does (at 25 units a hairline of black is left there): a radius of 25 x (4 - 2 x the square root of 2), 29.3 units, puts the curve on the arc at
 * 45 degrees and inside it everywhere else.
 */
export const CARD = { width: 1.2, height: 1.93, radius: (1.2 * 29.3) / 296 }

/**
 * Where the player after the viewer sits, in degrees clockwise from the viewer's seat, for a table of each number of players (`first` of `seats`): the viewer's wide grid needs the room, and the more players the less each of them needs. It is also how far from the viewer's
 * seat the first and the last opponent keep: the others are spread evenly between them.
 */
const FIRST_OPPONENT: Readonly<Record<number, number>> = { 2: 180, 3: 152, 4: 90, 5: 88, 6: 67, 7: 62, 8: 60 }

/** The size of a card of a grid, in world units */
export const cardSize = (scale: number) => ({ width: CARD.width * scale, height: CARD.height * scale })

/** The distance between two columns and between two rows of a grid of cards at `scale` (the centres) */
export function pitchOf(scale: number): { x: number; z: number } {
  const R = LAYOUT_SETTINGS
  return { x: CARD.width * scale * R.columnGap, z: CARD.height * scale * R.rowStep }
}

/** The whole grid of cards at `scale`: its width along its rows and its depth along its columns (the cards and the gaps between them) */
export function gridSize(scale: number): { width: number; depth: number } {
  const pitch = pitchOf(scale)
  const card = cardSize(scale)
  return { width: 3 * pitch.x + card.width, depth: 2 * pitch.z + card.height }
}

/** The four columns of a whole grid, by number: what is laid out until a column is thrown away */
export const WHOLE_GRID: readonly number[] = Array.from({ length: COLUMNS }, (_, column) => column)

/**
 * Where the column `column` of a grid stands along the row of its seat, in the frame of the seat, when the columns `shown` are laid out: they are centred on the axis of the seat, a pitch apart, so a grid that lost a column closes over the gap and stays centred in its seat
 * zone (the plate above it keeps the box of the whole grid). A column that is not among `shown` keeps the place it has in a whole grid.
 */
export function columnSpot(column: number, scale: number, shown: readonly number[] = WHOLE_GRID): number {
  const { x } = pitchOf(scale)
  const rank = shown.indexOf(column)
  return rank < 0 ? (column - (COLUMNS - 1) / 2) * x : (rank - (shown.length - 1) / 2) * x
}

/** Where the cell `position` (`column * 3 + row`) of a grid lies, in the frame of its seat: columns left to right, the first row farthest from its player, toward the middle of the table. `shown` are the columns laid out (`columnSpot`), the whole grid by default */
export function cellSpot(position: number, scale: number, shown: readonly number[] = WHOLE_GRID): Place {
  const column = Math.floor(position / ROWS)
  const row = position % ROWS
  return { x: columnSpot(column, scale, shown), z: (row - (ROWS - 1) / 2) * pitchOf(scale).z }
}

/** The slot of the cell `position` in the frame of its seat: a card lying face up or face down, a hair higher than the one above it so that cards that overlap never fight for a pixel. */
export function cellPose(position: number, up: boolean, scale: number, shown: readonly number[] = WHOLE_GRID): Pose {
  const { x, z } = cellSpot(position, scale, shown)
  return onTable(x, z, { y: 0.03 + 0.004 * (position % ROWS), face: up ? "up" : "down", scale })
}

/**
 * The box of the whole grid of a seat in its frame (the twelve cards, as if no column had been thrown away: the plate stays where it is when the grid closes over a gap, the columns left are centred inside this box), brought onto the axis of the seat: the plate stands above it, centred on the line (`above` of a `Seat`). The cards lie flat, so no tilt.
 */
export function gridBox(scale: number): TableBox {
  const poses = Array.from({ length: 12 }, (_, position) => cellPose(position, true, scale))
  return onAxis(boxOfPoses(poses, CARD)!)
}

/** What a seat is laid out with: its frame (where it stands and the way it faces: `seats` of the table kit), how big its cards are and the box of its grid in that frame */
export type SeatLayout = { frame: SeatSpot; scale: number; above: TableBox }

/**
 * The seat of each player, by id: the viewer in front, the others on the ring in turn order, the turn passing to the viewer's left, each seat turned toward the middle of the table. A spectator looks at a table with one more chair, the empty one in front: its seats and its
 * cards are those of that table (the kit's `seats` does it), and nine chairs on the ring of eight, which are closer than the plates allow, get a wider ring and smaller cards.
 */
export function seatsOf(ids: readonly string[], meId: string | null): Map<string, SeatLayout> {
  const R = LAYOUT_SETTINGS
  const viewer = ids.indexOf(meId ?? "")
  const seated = viewer >= 0
  const ring = seats(ids.length, { radiusX: [R.radiusX2, R.radiusX8], radiusZ: [R.radiusZ2, R.radiusZ8], viewerZ: R.viewerZ, first: FIRST_OPPONENT, me: seated ? viewer : null })
  const base = byPlayers(seated ? ids.length : ids.length + 1, [R.opponentScale2, R.opponentScale8])
  const opponent = !seated && ids.length >= 8 ? base * 0.82 : base
  return new Map(
    ids.map((id, i): [string, SeatLayout] => {
      const scale = i === viewer ? R.viewerScale : opponent
      return [id, { frame: ring[i]!, scale, above: gridBox(scale) }]
    }),
  )
}

/** Where the cell `position` of a seat's grid lies on the table, as a place and the yaw of its frame; `shown` are the columns laid out (`columnSpot`), the whole grid by default */
export function cellPlace({ frame, scale }: SeatLayout, position: number, shown: readonly number[] = WHOLE_GRID): Place & { yaw: number } {
  return { ...pointInFrame(frame, cellSpot(position, scale, shown)), yaw: frame.yaw }
}

/** Where the draw pile, the card in hand and the discard lie: the piles either side of the middle of the table, the card in hand between them. */
export function pilePlaces(): { deck: Place; held: Place; discard: Place } {
  const R = LAYOUT_SETTINGS
  return { deck: { x: -R.pilesX, z: R.pilesZ }, held: { x: 0, z: R.pilesZ }, discard: { x: R.pilesX, z: R.pilesZ } }
}

/** One gap, the same between a pile and the room over it: the middle of the table is laid out with it. */
export const FLOOR = { gap: 0.3, padDepth: 0.85 }

export type Pad = { x: number; z: number; width: number; depth: number }

export type FloorPlan = {
  /** Deal, for the dealer between two rounds: the one button of the table, over the piles (an action with no object on the table) */
  deal: Pad
  /** The room over the piles and the card in hand, kept clear: the instruction is said by the ticker, and nothing is written on the table. The word over a pile (the action label) floats over it, and the deal button lies here */
  above: Pad
  /** The whole middle, for the footprints: the piles, the count under each, the card in hand and the room over them */
  strip: Pad
}

export function floorPlan(): FloorPlan {
  const R = LAYOUT_SETTINGS
  const pile = CARD.height * R.pileScale
  const g = FLOOR.gap
  const across = 2 * R.pilesX + CARD.width * R.pileScale
  const aboveDepth = 1.25
  const above = { x: 0, z: R.pilesZ - pile / 2 - g - aboveDepth / 2, width: 4 * R.pilesX, depth: aboveDepth }
  const top = above.z - aboveDepth / 2
  // each pile writes its count under it: its middle `PILE_LABEL_GAP` under the pile's edge, the letters `PILE_LABEL_HEIGHT` tall
  const bottom = R.pilesZ + pile / 2 + PILE_LABEL_GAP + PILE_LABEL_HEIGHT / 2
  return {
    deal: { x: 0, z: above.z, width: across, depth: FLOOR.padDepth },
    above,
    strip: { x: 0, z: (top + bottom) / 2, width: across, depth: bottom - top },
  }
}

/** The corners of a rectangle on the table whose sides run along x and z, going round */
const rectOf = ({ x, z, width, depth }: Pad): Place[] => [
  { x: x - width / 2, z: z - depth / 2 },
  { x: x + width / 2, z: z - depth / 2 },
  { x: x + width / 2, z: z + depth / 2 },
  { x: x - width / 2, z: z + depth / 2 },
]

/** How much farther from its grid a plate stands here than the kit's default gap (`plateGap` of `SEAT_SETTINGS`): twelve bright cards lie right under the name and the score, which need room around them to be read */
export const PLATE_AIR = 0.25

/** The settings of Skyjo's plates: the kit's, as the debug panel has them, with the plate `PLATE_AIR` farther from the grid. A `Seat` is given them and the layout works its boxes out with the same */
export const plateSettings = (): SeatSettings => ({ ...SEAT_SETTINGS, plateGap: SEAT_SETTINGS.plateGap + PLATE_AIR })

/** What a seat's plate covers of the table, in its frame: the plate that stands above the grid (`plateAbove`), from the top of the name to the foot of the info line, as wide as the kit takes a plate to be */
export const plateBox = ({ above }: SeatLayout): TableBox => {
  const settings = plateSettings()
  return plateBoxOf(plateAbove(above, settings), settings)
}

/** Everything that lies on a table of `n` players, as the polygons the camera and the tests look at (the corners of each, going round) */
export type TableParts = {
  /** The plate and the grid of each seat, in seat order, turned as the seat is */
  plates: Place[][]
  grids: Place[][]
  deck: Place[]
  discard: Place[]
  held: Place[]
  /** The whole middle: the piles, their counts, the card in hand and the room over them */
  strip: Place[]
}

/** The table of `n` players as polygons: the plate and the grid of each seat, the piles and the card in hand, and the strip of the middle. The viewer is the first seat; a spectator (`seated` false) has none. */
export function tableParts(n: number, seated = true): TableParts {
  const R = LAYOUT_SETTINGS
  const ids = Array.from({ length: n }, (_, i) => String(i))
  const placed = seatsOf(ids, seated ? "0" : null)
  const seatList = ids.map((id) => placed.get(id)!)
  const { deck, held, discard } = pilePlaces()
  const card = (place: Place, scale: number): Place[] => rectOf({ x: place.x, z: place.z, width: CARD.width * scale, depth: CARD.height * scale })
  return {
    plates: seatList.map((seat) => cornersOfBox(plateBox(seat), seat.frame)),
    grids: seatList.map((seat) => cornersOfBox(seat.above, seat.frame)),
    deck: card(deck, R.pileScale),
    discard: card(discard, R.pileScale),
    held: card(held, R.heldScale),
    strip: rectOf(floorPlan().strip),
  }
}

/** What the camera has to bring into the window, and to keep clear of what the platform draws over it (`fitCamera`): the plate and the grid of each seat, the piles and the card in hand, the strip of the middle. */
export function tableQuads(n: number, seated = true): Place[][] {
  const { plates, grids, deck, discard, held, strip } = tableParts(n, seated)
  return [...plates, ...grids, deck, discard, held, strip]
}
