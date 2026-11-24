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
  radiusX2: 5.68,
  radiusX8: 6.41,
  radiusZ2: 7.37,
  radiusZ8: 8.64,
  /**
   * The size of every card on the table, a share of the card of the kit, for a table of two and for a table of eight: the grid of the viewer and those of the others, the draw pile, the discard, the card in hand and the columns that are thrown away are all one size, as at a
   * real table. A small table has big cards and a full one small ones (in steps in between). `crowded` is how much smaller they are again at a table of more chairs than the ring is tuned for, which only a spectator of eight has: nine chairs on a ring of eight
   */
  cardScale2: 0.81,
  cardScale8: 0.69,
  crowded: 0.82,
  /** How far toward the viewer their grid lies */
  viewerZ: 5.1,
  /** The step between two columns of a grid, as a share of the width of a card, and between two rows, as a share of its height: 1.1 leaves a gap of a tenth of a card between neighbours, both ways. Cards never overlap (`layout.test.ts` holds a margin): the figures stay
   * readable by the size of the cards */
  columnGap: 1.1,
  rowStep: 1.1,
  /** The draw pile and the discard, either side of the card in hand, in the middle of the table: how far each lies from it, in world units whatever the size of the cards (the word over each pile has a size of its own, and the two words must not touch), and how far toward the viewer */
  pilesX: 1.23,
  pilesZ: -0.45,
}

export const LAYOUT_FIELDS: Record<keyof typeof LAYOUT_SETTINGS, Field> = {
  radiusX2: ["ring radius x · 2 players", 3, 12, 0.1],
  radiusX8: ["ring radius x · 8 players", 3, 14, 0.1],
  radiusZ2: ["ring radius z · 2 players", 2, 8, 0.1],
  radiusZ8: ["ring radius z · 8 players", 2, 10, 0.1],
  cardScale2: ["card scale · 2 players", 0.2, 1.2, 0.01],
  cardScale8: ["card scale · 8 players", 0.2, 1, 0.01],
  crowded: ["card scale · nine chairs (x)", 0.4, 1, 0.01],
  viewerZ: ["viewer grid z", 0, 8, 0.05],
  columnGap: ["column step (cards)", 1.05, 1.4, 0.01],
  rowStep: ["row step (cards)", 1.05, 1.4, 0.01],
  pilesX: ["piles x", 1, 3, 0.05],
  pilesZ: ["piles z", -3, 3, 0.05],
}

/**
 * The width and height of a card of the game, in world units, and the radius of its corners. The faces of Sanity are 296 by 476, with a white contour 16 units wide whose outer corners are an arc of 25 units, transparent beyond it. The card has to be cut
 * where the contour is, or the transparent corner pixels of the picture lie on the card and read black: the table's default radius (6% of the smaller side, 18 units here) leaves a black crescent in each corner. The table draws a corner as a quadratic
 * curve, which at 45 degrees passes 6% of its radius nearer the corner than a circular arc of the same radius does (at 25 units a hairline of black is left there): a radius of 25 x (4 - 2 x the square root of 2), 29.3 units, puts the curve on the arc at
 * 45 degrees and inside it everywhere else.
 */
export const CARD = { width: 1.2, height: 1.93, radius: (1.2 * 29.3) / 296 }

/**
 * Where the player after the viewer sits, in degrees clockwise from the viewer's seat, for a table of each number of players (`first` of `seats`): the viewer's grid and plate need the room in front, and the more players the less each of them needs. It is also how far from
 * the viewer's seat the first and the last opponent keep: the others are spread evenly between them. At five and more players the seats on the viewer's left stand where they leave the log of the turns at the top left of the window clear, so that the camera can stand near.
 */
const FIRST_OPPONENT: Readonly<Record<number, number>> = { 2: 180, 3: 149, 4: 65, 5: 66, 6: 80, 7: 58, 8: 58 }

/** The chairs of a table: its players, and one more for a spectator, who has none in front (the ring of `seats` is that of the table with one more player) */
export const chairsOf = (players: number, seated = true) => (seated ? players : players + 1)

/** The chairs of the fullest table that has a ring of its own, for what is laid out for a table whose size is not said: the smallest cards */
const FULL_TABLE = 8

/**
 * The size of every card that lies on a table of `chairs` chairs, a share of the card of the kit: the cards of every grid, the viewer's and the others', the draw pile, the discard, the card in hand and the columns thrown away, as at a real table. Smaller as the
 * table fills, in steps from the table of two to the table of eight, and smaller again by `crowded` for a table of more chairs than that (a spectator of eight: nine chairs on a widened ring).
 */
export function cardScaleOf(chairs: number): number {
  const R = LAYOUT_SETTINGS
  return byPlayers(chairs, [R.cardScale2, R.cardScale8]) * (chairs > FULL_TABLE ? R.crowded : 1)
}

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

/** What a seat is laid out with: its frame (where it stands and the way it faces: `seats` of the table kit), how big its cards are (those of every seat of the table: `cardScaleOf`) and the box of its grid in that frame */
export type SeatLayout = { frame: SeatSpot; scale: number; above: TableBox }

/**
 * The seat of each player, by id: the viewer in front, the others on the ring in turn order, the turn passing to the viewer's left, each seat turned toward the middle of the table. A spectator looks at a table with one more chair, the empty one in front: its seats and its
 * cards are those of that table (the kit's `seats` does it), and nine chairs on the ring of eight, which are closer than the plates allow, get a wider ring and smaller cards. Every seat of a table has cards of one size (`cardScaleOf`), the viewer's too.
 */
export function seatsOf(ids: readonly string[], meId: string | null): Map<string, SeatLayout> {
  const R = LAYOUT_SETTINGS
  const viewer = ids.indexOf(meId ?? "")
  const seated = viewer >= 0
  const ring = seats(ids.length, { radiusX: [R.radiusX2, R.radiusX8], radiusZ: [R.radiusZ2, R.radiusZ8], viewerZ: R.viewerZ, first: FIRST_OPPONENT, me: seated ? viewer : null })
  const scale = cardScaleOf(chairsOf(ids.length, seated))
  return new Map(ids.map((id, i): [string, SeatLayout] => [id, { frame: ring[i]!, scale, above: gridBox(scale) }]))
}

/** Where the cell `position` of a seat's grid lies on the table, as a place and the yaw of its frame; `shown` are the columns laid out (`columnSpot`), the whole grid by default */
export function cellPlace({ frame, scale }: SeatLayout, position: number, shown: readonly number[] = WHOLE_GRID): Place & { yaw: number } {
  return { ...pointInFrame(frame, cellSpot(position, scale, shown)), yaw: frame.yaw }
}

/** Where the draw pile, the card in hand and the discard lie: the piles either side of the middle of the table, the card in hand between them. The three cards are as big as every card of the table (`cardScaleOf`), and the piles lie `pilesX` from the card in hand whatever their size */
export function pilePlaces(): { deck: Place; held: Place; discard: Place } {
  const R = LAYOUT_SETTINGS
  return { deck: { x: -R.pilesX, z: R.pilesZ }, held: { x: 0, z: R.pilesZ }, discard: { x: R.pilesX, z: R.pilesZ } }
}

/** Where a card that comes in with a move flies in from when it comes from the draw pile, the discard or the card in hand: above the place where that lies, as big as every card of the table (a card from a cell sets out from `cellOrigin`) */
export function flightFrom(origin: "deck" | "discard" | "held", chairs = FULL_TABLE): Pose {
  const scale = cardScaleOf(chairs)
  const { deck, held, discard } = pilePlaces()
  switch (origin) {
    case "deck":
      return onTable(deck.x, deck.z, { y: 1.4, face: "down", scale })
    case "discard":
      return onTable(discard.x, discard.z, { y: 0.4, face: "up", scale })
    case "held":
      return onTable(held.x, held.z, { y: 0.8, face: "up", scale })
  }
}

/** Where a card that comes in from a cell of a grid sets out: the cell as the grid is laid out now (`shown`), a little above it, as big as the cards of the grid, which are every card of the table */
export function cellOrigin(seat: SeatLayout, position: number, up: boolean, shown: readonly number[] = WHOLE_GRID): Pose {
  const cell = cellPlace(seat, position, shown)
  return onTable(cell.x, cell.z, { y: 0.3, face: up ? "up" : "down", yaw: cell.yaw, scale: seat.scale })
}

/** Where a stack that was thrown away lands: on the discard, at the height `y` of the card it lies on, as big as every card of the table (the stack neither grows nor shrinks on its way) */
export const landingOn = (y: number, chairs = FULL_TABLE) => ({ ...pilePlaces().discard, y, scale: cardScaleOf(chairs) })

/** The slot, in the frame of the discard, of its card number `index` from the bottom: a hair above the one under it, face down for the depth of the pile and face up for the cards that show, as big as every card of the table */
export const discardPose = (index: number, up: boolean, chairs = FULL_TABLE): Pose => onTable(0, 0, { y: 0.03 + 0.02 * index, face: up ? "up" : "down", lean: `discard-${index}`, scale: cardScaleOf(chairs) })

/** The slot of the card in hand, in the frame of the middle between the piles, as big as every card of the table */
export const heldPose = (up: boolean, chairs = FULL_TABLE): Pose => onTable(0, 0, { y: 0.2, face: up ? "up" : "down", scale: cardScaleOf(chairs) })

/** One gap, the same between a pile and the room over it: the middle of the table is laid out with it. */
export const FLOOR = { gap: 0.3, padDepth: 0.85 }

/** How wide the count under a pile is, in world units (three digits of the table's lettering, which has a size of its own whatever the cards): at a table whose cards are narrower than that, the middle is as wide as the counts are */
export const COUNT_WIDTH = 0.8

export type Pad = { x: number; z: number; width: number; depth: number }

export type FloorPlan = {
  /** Deal, for the dealer between two rounds: the one button of the table, over the piles (an action with no object on the table) */
  deal: Pad
  /** The room over the piles and the card in hand, kept clear: the instruction is said by the ticker, and nothing is written on the table. The word over a pile (the action label) floats over it, and the deal button lies here */
  above: Pad
  /** The whole middle, for the footprints: the piles, the count under each, the card in hand and the room over them */
  strip: Pad
}

/** The middle of a table of `chairs` chairs: the piles are as big as every card of the table, so the room that holds them narrows and shortens as the table fills */
export function floorPlan(chairs = FULL_TABLE): FloorPlan {
  const R = LAYOUT_SETTINGS
  const scale = cardScaleOf(chairs)
  const pile = CARD.height * scale
  const g = FLOOR.gap
  const piles = R.pilesX
  const across = 2 * piles + Math.max(CARD.width * scale, COUNT_WIDTH)
  const aboveDepth = 1.25
  const above = { x: 0, z: R.pilesZ - pile / 2 - g - aboveDepth / 2, width: 4 * piles, depth: aboveDepth }
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
  const ids = Array.from({ length: n }, (_, i) => String(i))
  const placed = seatsOf(ids, seated ? "0" : null)
  const seatList = ids.map((id) => placed.get(id)!)
  const chairs = chairsOf(n, seated)
  const scale = cardScaleOf(chairs)
  const { deck, held, discard } = pilePlaces()
  const card = (place: Place): Place[] => rectOf({ x: place.x, z: place.z, width: CARD.width * scale, depth: CARD.height * scale })
  return {
    plates: seatList.map((seat) => cornersOfBox(plateBox(seat), seat.frame)),
    grids: seatList.map((seat) => cornersOfBox(seat.above, seat.frame)),
    deck: card(deck),
    discard: card(discard),
    held: card(held),
    strip: rectOf(floorPlan(chairs).strip),
  }
}

/** What the camera has to bring into the window, and to keep clear of what the platform draws over it (`fitCamera`): the plate and the grid of each seat, the piles and the card in hand, the strip of the middle. */
export function tableQuads(n: number, seated = true): Place[][] {
  const { plates, grids, deck, discard, held, strip } = tableParts(n, seated)
  return [...plates, ...grids, deck, discard, held, strip]
}
