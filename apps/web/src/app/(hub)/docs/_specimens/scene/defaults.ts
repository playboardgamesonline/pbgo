// What the light half of a specimen (its controls) and the heavy half (its scene) both need to know. Plain numbers only: this file imports no code (a type of the engine kit at the most), so the controls can read it without pulling in three.js.

import type { Drawing, LaidTile } from "@pbgo/engine-kit"
import type { TileName } from "./landscape"

/** The view the camera specimen starts from, and its reset returns to. The scene adds the point it looks at. */
export const CAMERA_VIEW = { tilt: 40, yaw: 0, distance: 15, fov: 34 }
export type CameraView = typeof CAMERA_VIEW

/** The cards of the viewer's hand on the small board, by the number of their face (`face` of the art). */
export const BOARD_HAND: readonly number[] = [2, 7, 12, 17, 22, 27]

/** The players a small board seats. */
export const BOARD_PLAYERS = [2, 3, 4, 5] as const

/** How dark the card specimen's shadow starts. The package's own default is a hair, and the shadow itself is a soft edge a few percent dark at the most, so the slider starts at its top, where the switch can just be seen to do something. */
export const SHADOW_START = 1

/** The cards of the pose-memory specimen: they start in the hand. */
export const MEMORY_CARDS: readonly number[] = [4, 9, 14, 19, 24]

/** The most cards the layouts specimen lays, and how many it starts with. */
export const LAYOUT_CARDS = { max: 12, start: 7 }

/** The layouts the toggle offers, in the order of the page. */
export const LAYOUTS = ["fan", "row", "pile", "grid"] as const
export type LayoutName = (typeof LAYOUTS)[number]

/** The pile specimen: the most cards the slider reaches, the count it starts at and the cards drawn from it. */
export const PILE_CARDS = { max: 30, start: 14 }

/** The players the seats specimen rings, from two to eight. */
export const SEAT_PLAYERS = { min: 2, max: 8, start: 4 }

/** The seat specimen: the seats it draws, and whose turn it can be (nobody, or one of them). */
export const SEAT_TURNS = ["none", "you", "left", "right"] as const
export type SeatTurn = (typeof SEAT_TURNS)[number]

/** A card drawn from the pile: its number, and how many cards the draw pile held when it was taken (that is where it left from). */
export type Drawn = { id: number; from: number }

/** The three fields of `CARD_SETTINGS` the flight specimen puts in the visitor's hands. */
export type FlightKnobs = { flightDuration: number; flightHeight: number; foldable: number }

/** The dice specimen: the fewest, the most and the starting number of dice, the shapes the chooser offers, and the faces they show before the first roll. */
export const DICE_COUNT = { min: 1, max: 6, start: 3 }
export const DICE_SHAPES = ["d6", "d8", "d10", "d12", "d20"] as const
export type DiceShape = (typeof DICE_SHAPES)[number]
/** How many faces each shape has. */
export const DICE_SIDES: Record<DiceShape, number> = { d6: 6, d8: 8, d10: 10, d12: 12, d20: 20 }
export const DICE_START: readonly number[] = [3, 5, 1, 6, 2, 4]

/** The three fields of `DIE_SETTINGS` the dice specimen puts in the visitor's hands. */
export type DiceKnobs = { restitution: number; throwSpeed: number; speed: number }

/** The text field specimen: the longest text it lets the player write, from the fewest to the most and where it starts. */
export const FIELD_LENGTH = { min: 8, max: 60, start: 24 }

/** The bets specimen: the most tricks a bet can name, the faces a bet can name (each is an option of a choice), and what a bid says: how many, of which face. */
export const BET_MOST = 7
export const BID_FACES: readonly { value: number; label: string }[] = [1, 2, 3, 4, 5, 6].map((value) => ({ value, label: String(value) }))
export type Bid = { count: number; face: number }

/** The pieces specimen: one piece of each shape in a row (its name, its shape, its width and where it stands), the most a stack can hold, and where the stack, the tile and the pawn that travels are. */
export const PIECE_ROW = [
  { id: "disc", shape: "disc", size: 0.85, x: -3.6 },
  { id: "square", shape: "square", size: 0.85, x: -2.2 },
  { id: "hex", shape: "hex", size: 0.9, x: -0.8 },
  { id: "cube", shape: "cube", size: 0.65, x: 0.7 },
  { id: "sphere", shape: "sphere", size: 0.7, x: 2.0 },
  { id: "pawn", shape: "pawn", size: 0.7, x: 3.3 },
] as const
export const PIECE_STACK = { max: 16, start: 7 }
export const STACK_AT = { x: -3.3, z: -1.5 }
export const TILE_AT = { x: -0.3, z: -1.5 }
export const PAWN_AT = { near: 2.2, far: 4.0, z: -1.5 }

/** The counter specimen: the most the number can reach and where it starts, the longest and the shortest time a change takes to count, and where the three ways of showing the number stand. */
export const COUNTER_RANGE = { max: 99, start: 12 }
export const COUNTER_TIME = { min: 0.2, max: 3, start: 0.8 }
export const COUNTER_AT = { plain: -3.5, tile: 0, stack: 3.5 }

/** The track specimen: how many spaces the loop and the line have, how many spaces ahead of the red marker can be chosen, and where each marker starts. */
/** The bid specimen: how many bid cards the viewer has (a bid from none to five), the players at the table (the first is the viewer), and where the row and the bids lie. */
export const BID = { count: 6, scale: 0.8, gap: 1.2, z: 0.9, toward: 0.68 }
export const BID_PLAYERS = ["you", "basile", "camille"] as const
export type BidPlayer = (typeof BID_PLAYERS)[number]
/** What the view gives a board on a simultaneous step: the viewer's own bid, who else has bid, and what the others bid only once everybody has. */
export type BidView = { mine: number | null; others: { hasBid: boolean; bid: number | null }[] }

/** The numbers specimen: what the stepper counts, the faces to pick among, the range of the bet and where each starts. */
export const NUMBERS = { count: { min: 1, max: 12, start: 3 }, faces: 6, bet: { min: 0, max: 100, step: 5, start: 40 } }

/** The sketch specimen: the colours of its palette and the brushes it draws with (a brush is a part of the width of the sheet), the rules its drawing is kept under (a small sheet, so that a full one can be seen), and where the sheet that is drawn on and the one that shows what the others read lie, and their size. */
export const SKETCH_COLORS = ["Ink", "Red", "Blue", "Gold"] as const
export const SKETCH_BRUSHES = [
  { name: "Fine", width: 0.006 },
  { name: "Medium", width: 0.013 },
  { name: "Broad", width: 0.028 },
] as const
export const SKETCH_RULES = { colors: SKETCH_COLORS.length, widths: SKETCH_BRUSHES.length, strokes: 12, points: 2500, strokePoints: 400 }
export const SKETCH_SHEETS = {
  mine: { x: -3.5, z: 0.1, width: 5.8, height: 4.35 },
  others: { x: 4.4, z: -0.6, width: 3.6, height: 2.7 },
}
/** The pen the sketch specimen starts with: the first colour and the medium brush. */
export const SKETCH_PEN = { color: 0, width: 1 }

/** The road map specimen: the island's radius (19 hexagons), the size of its cells, the two players, what each of its tiles is and the number written on it (0: none, the desert), and what a player builds. */
export const ISLAND = { radius: 2, size: 1.55, gap: 0.06 }
export const ISLAND_PLAYERS = ["Red", "Blue"] as const
export type IslandPlayer = 0 | 1
export const ISLAND_TILES = ["mountains", "pasture", "forest", "field", "hills", "pasture", "hills", "field", "forest", "desert", "forest", "mountains", "forest", "mountains", "field", "pasture", "hills", "field", "pasture"] as const
export const ISLAND_NUMBERS: readonly number[] = [10, 2, 9, 12, 6, 4, 10, 9, 11, 0, 3, 8, 8, 3, 4, 5, 5, 6, 11]
export const ISLAND_BUILDS = ["settlement", "road"] as const
export type IslandBuild = (typeof ISLAND_BUILDS)[number]

/** The sheet specimen: where the scorecard lies and how big it is, the seed of its dice, and how many dice a roll has and how many rolls a turn. */
export const SHEET = { at: { x: -2.6, z: 0.1 }, width: 4.4, height: 5.9, seed: 7, dice: 5, rolls: 3 }

export const TIMER_SECONDS = { min: 5, max: 30, start: 12 }
/** What is left of the time in the three hourglasses that wait with no clock: most of it, half and little */
export const TIMER_REST = [0.85, 0.5, 0.15] as const
export const TRACK_LOOP = 20
export const TRACK_LINE = 11
export const TRACK_REACH = 6
export const TRACK_START = { red: 0, blue: 11, points: 0 }

/** The grid specimen: the size of the square board and the radius of the hexagonal one, how many steps a pawn can go, the cells that are walls (their numbers on each board) and the cell each pawn starts on. */
export const GRID = { columns: 6, rows: 6, radius: 2, range: 4 }
export const GRID_WALLS = { square: [8, 14, 20], hex: [6, 10, 14] }
export const GRID_START = { square: 25, hex: 7 }
export type GridKind = "square" | "hex"

/** The cup specimens: the dice under each cup, how long a cup is shaken (milliseconds) before it comes down, and how long the dice are thrown for before the cup is put back. */
export const CUP_DICE = 5
export type PourPose = "rest" | "shaking" | "pouring"
export const CUP_TIMES = { shake: 1300, pour: 2400 }

/** The bag specimen: how many tokens of each kind the bag starts with, the seed of its stream, how many tokens the row holds, and the most one press draws. */
export const BAG_START = [6, 6, 6, 6] as const
export const BAG_SEED = 2024
export const BAG_ROW = 8

/** The drag specimen: the cards of the hand by the number the art paints, whether each may be played (the others can only be discarded), and where the two zones lie, their middle and their size. */
export const DRAG_HAND = [
  { card: 3, plays: false },
  { card: 12, plays: true },
  { card: 21, plays: true },
  { card: 8, plays: false },
  { card: 30, plays: true },
] as const
export const DRAG_ZONES = {
  play: { x: -2.4, z: -0.4, width: 5, depth: 2.9 },
  discard: { x: 3.7, z: -0.4, width: 2.3, depth: 2.9 },
} as const
export type DragZone = keyof typeof DRAG_ZONES
/** Where each card of the specimen is: in the hand, in a zone, or lying where it was let go. */
export type DragCards = { hand: number[]; play: number[]; discard: number[]; loose: { card: number; x: number; z: number }[] }
export const DRAG_START: DragCards = { hand: DRAG_HAND.map(({ card }) => card), play: [], discard: [], loose: [] }

/** The playground: the things that lie on its table, the parts of the table that can be switched on, and where it starts. */
export const PLAY_PIECES = ["disc", "square", "hex", "cube", "sphere", "pawn"] as const
export type PlayPiece = (typeof PLAY_PIECES)[number]
export const PLAY_PARTS = ["board", "track", "counter", "stepper", "slider", "timer", "bag", "cup", "dice", "fields", "sketch", "hand", "piles", "stack", "paper", "map", "sheet", "tiles", "seats", "scoreboard", "floor"] as const
export type PlayPart = (typeof PLAY_PARTS)[number]
export const PLAY_PART_NAMES: Record<PlayPart, string> = { board: "Board", track: "Track", counter: "Counter", stepper: "Stepper", slider: "Slider", timer: "Timer", bag: "Bag", cup: "Cup", dice: "Dice tray", fields: "Fields", sketch: "Sketch", hand: "Hand", piles: "Piles", stack: "Stack", paper: "Paper button", map: "Map", sheet: "Sheet", tiles: "Tiles", seats: "Seats", scoreboard: "Scoreboard", floor: "Floor buttons" }
export const PLAY_CUP_POSES = ["covering", "peeking", "lifted", "shaking", "rest", "pouring"] as const
export type PlayCupPose = (typeof PLAY_CUP_POSES)[number]
/** The playground's map: six cities, the roads between them (each the two cities it joins), where the map lies on the table and how far its cities are from the middle of it. */
export const PLAY_MAP = {
  names: ["Aix", "Brest", "Caen", "Dijon", "Evry", "Foix"],
  roads: [
    [0, 1],
    [1, 2],
    [2, 3],
    [3, 4],
    [4, 5],
    [5, 0],
    [0, 3],
    [1, 4],
  ] as readonly (readonly [number, number])[],
  at: { x: -12.6, z: -1.8 },
  radius: 2,
}
/** The playground's sheet: the marks a box can wear, where the sheet lies and how big it is, how many boxes it has across and down, and how far the camera backs off for it: it lies beyond the rest of the table, on the left. */
export const PLAY_MARKS = ["tick", "cross", "circle"] as const
export type PlayMark = (typeof PLAY_MARKS)[number]
export const PLAY_SHEET = { x: -11.4, z: 5.6, width: 4.2, height: 3.4, columns: 6, rows: 4, zoom: 32 }
/** The playground's tiles: where the middle cell of the table lies, where the tile in hand lies, how far the table goes from its middle, and how far the camera backs off for it: it lies beyond the rest of the table, on the right at the far side. */
export const PLAY_TILES = { origin: { x: 10.6, z: -6.2 }, hand: { x: 10.6, z: -10.8 }, table: { columns: 2, rows: 1 }, zoom: 32 }
/** The names of the players the playground seats, in the order of the seats. */
export const PLAY_NAMES = ["Alix", "Basile", "Camille", "Dana", "Eli", "Farah", "Gaspard", "Hana"] as const
/** How many players the seats ring takes, and the colour of each seat as a CSS expression of the page's own tokens (the table's scene and the scoreboard of the page read the same ones). */
export const PLAY_PLAYERS = { min: 2, max: 8 }
export const PLAY_SEAT_COLORS = [
  "var(--piece-red)",
  "color-mix(in oklab, var(--piece-navy) 82%, var(--piece-ink))",
  "color-mix(in oklab, var(--piece-gold) 72%, var(--piece-ink))",
  "var(--piece-ivory)",
  "var(--muted-foreground)",
  "var(--piece-navy)",
  "var(--success)",
  "var(--piece-gold)",
] as const
/** The shapes the board takes: the squares of a chessboard, the hexagons of a map, and a ring of spaces to walk round. */
export const BOARD_SHAPES = ["grid", "hex", "loop"] as const
export type BoardShape = (typeof BOARD_SHAPES)[number]
/** Where the hand lies: along the near edge of the table, or in the bottom left corner of the screen. */
export const HAND_PLACES = ["edge", "corner"] as const
export type HandPlace = (typeof HAND_PLACES)[number]
/** Where the draw and discard piles lie: along the near edge, or in the middle of the table. */
export const PILE_PLACES = ["edge", "middle"] as const
export type PilePlace = (typeof PILE_PLACES)[number]
/** A card held face down at a seat of the ring: the id it keeps when it is passed on, the number its face is painted from, the seat, and how many cards the draw pile held when it was dealt from it. */
export type PlayHeld = { id: number; card: number; seat: number; from?: number }
/** The most lines the log keeps. */
export const PLAY_LOG_MAX = 40
/** A card that is in the hand or on the discard pile and not on the table: the id it has everywhere (so that it keeps its name, and glides, when it changes places), the number its face is painted from, and, when it was just dealt from the draw pile, how many cards the pile held then (where it flies in from). */
export type PlayCard = { id: number; card: number; from?: number }
/** Where a card can be sent: the hand, the discard pile, a place on the table, or away. */
export type PlayPlace = "hand" | "discard" | "table" | "gone"
/** The glows a picked card can wear: one part each, and all four. */
export const PLAY_GLOWS = ["none", "halo", "outline", "frame", "sparkle", "all"] as const
export type PlayGlow = (typeof PLAY_GLOWS)[number]
/** The playground's cards: how many the draw pile starts with, and the most the hand holds. */
export const PLAY_DECK = { size: 30, hand: 10 }
/** The playground's stack of pieces: the most it holds and where its count starts. */
export const PLAY_STACK = { max: 24, start: 8 }
/** What the playground puts on the table for the visitor to move: a card (by the number its face is painted from) or a piece (a shape, and a colour of the palette). */
export type PlayThing =
  | { id: number; kind: "card"; card: number; x: number; z: number; face: "up" | "down"; /** How many cards the draw pile held when this one was dealt from it: where it flies in from */ from?: number }
  | { id: number; kind: "piece"; shape: PlayPiece; paint: number; x: number; z: number; fromBag: boolean; /** How many pieces the stack held when this one was taken from it */ fromStack?: number }
/** The scenes the playground starts from, the first being the one it opens on. */
export const PRESET_IDS = ["card", "board", "trick", "dice", "everything", "empty"] as const
export type PresetId = (typeof PRESET_IDS)[number]
export type PlayState = {
  /** The scene this table began as (`play/presets.ts`): what Reset puts back and what the address names */
  scene: PresetId
  things: PlayThing[]
  nextId: number
  selected: number | null
  parts: Record<PlayPart, boolean>
  counter: number
  /** What the stepper and the slider hold */
  stepper: number
  slider: number
  /** The clock of the timer: when it ends on the page's own clock (null: none runs, it waits full) */
  clock: { endsAt: number | null }
  marker: number
  cup: PlayCupPose
  dice: { shape: DiceShape; count: number; values: number[]; rolls: number }
  bag: { counts: number[]; rng: number; drawn: number }
  text: string
  bet: number | null
  face: number | null
  /** The sketch: what is drawn on its paper, as the engine would keep it, and the pen */
  sketch: { strokes: Drawing; color: number; width: number }
  /** The glow of the picked card */
  glow: PlayGlow
  /** The hand: its cards, and how they are laid out */
  hand: { cards: PlayCard[]; layout: LayoutName }
  /** The draw pile counts how many cards were drawn from its deck; the discard pile holds the cards let go on it */
  piles: { drawn: number; discard: PlayCard[] }
  /** How many pieces the stack holds */
  stack: number
  /** How many times the paper was pressed */
  presses: number
  /** The seat whose plate was pressed to pick that player, or null */
  seat: number | null
  /** The map: which roads were claimed, and the city that was picked */
  map: { claimed: boolean[]; city: number | null }
  /** The sheet: the mark in each box, or none, and the mark a press writes */
  sheet: { marks: (PlayMark | null)[]; mark: PlayMark }
  /** The tiles: the ones that are laid, which tile of the box is in hand and how many times it was turned */
  tiles: { laid: LaidTile<TileName>[]; index: number; spin: number }
  players: number
  /** The board: its shape, whether it is the middle of the table (and larger) or at the side, and how many times a piece has hopped across it */
  board: { shape: BoardShape; centre: boolean; hops: number }
  /** Where the hand and the piles lie */
  layout: { hand: HandPlace; piles: PilePlace }
  /** The seat whose turn it is */
  turn: number
  /** The score: the round's points and the banked totals of each seat, and the round that is played */
  score: { round: number; points: number[]; total: number[] }
  /** The cards the other seats hold face down */
  held: PlayHeld[]
  /** The floor buttons: whether each seat has its zone to press, and whether they are all disabled */
  floor: { zones: boolean; disabled: boolean }
  /** What happened, the newest first */
  log: string[]
  above: boolean
  zoom: number
  /** How far the camera leans from straight above, in degrees: the more, the more the table is seen from the side. */
  tilt: number
}
/** What the scene tells the controls: the things the pointer did on the table. */
export type PlayActions = {
  select: (id: number | null) => void
  move: (id: number, x: number, z: number) => void
  remove: (id: number) => void
  draw: () => void
  peek: () => void
  write: (text: string) => void
  count: (value: number) => void
  slide: (value: number) => void
  bet: (value: number) => void
  pick: (face: number) => void
  /** The strokes a player finished on the sheet */
  ink: (strokes: Drawing) => void
  /** A card is sent to the hand, the discard pile, a place on the table, or away */
  place: (id: number, to: PlayPlace, at?: { x: number; z: number }) => void
  /** The top card of the draw pile is pressed */
  deal: () => void
  /** The top of the stack is pressed: a piece comes off it */
  take: () => void
  /** A road of the map is pressed: it is claimed, or let go when it was claimed already */
  claim: (road: number) => void
  /** A city of the map is pressed: it is picked, or nobody when it was the one picked */
  visit: (city: number | null) => void
  /** A box of the sheet is pressed: it gets the picked mark, or loses it when it held that mark already */
  mark: (box: number) => void
  /** A free cell of the tiles' table is pressed: the tile in hand is laid there when it fits, as it is turned */
  layTile: (place: number) => void
  /** The tile in hand is pressed: it turns a quarter */
  turnTile: () => void
  /** The plate of a seat is pressed: that player is picked, or nobody when it was the one picked already */
  pickSeat: (seat: number | null) => void
  /** The paper is pressed */
  press: () => void
  /** A zone of the floor is pressed: the seat gets a card */
  give: (seat: number) => void
  /** Hit is pressed: the seat whose turn it is gets a card and a point */
  hit: () => void
  /** Stay is pressed: the seat whose turn it is banks its round's points, and the turn passes */
  stay: () => void
  /** Deal is pressed: a card to every seat */
  dealRound: () => void
  /** A piece hops to the next cell of the board */
  hop: () => void
  /** A card is added to the table, and a piece of a shape */
  addCard: () => void
  addPiece: (shape: PlayPiece) => void
  /** The picked card is turned over (or the first on the table) */
  flip: () => void
}
/** The ranges of the playground's stepper and slider, and where they start. */
export const PLAY_NUMBERS = { stepper: { min: 0, max: 20, start: 3 }, slider: { min: 0, max: 100, step: 5, start: 40 } }
/** How long a step of the playground's timer lasts, in seconds. */
export const PLAY_CLOCK = { seconds: 12 }
/** Where the playground's sketch lies and how big it is, and how far the camera backs off for it: it lies beyond the rest of the table, on the right. */
export const PLAY_SKETCH = { x: 11.4, z: 6.2, width: 4.8, height: 3.6, zoom: 32 }
/** How many things the table holds at the most, how many tokens the track has, and the most the counter reaches. */
export const PLAY_LIMITS = { things: 24, spaces: 8, counter: 99, dice: 6, zoom: { min: 14, max: 34, start: 22 }, tilt: { min: 0, max: 60, start: 34 } }
