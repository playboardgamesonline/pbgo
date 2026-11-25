import { type Area, type AreaSeed, type Between, boxOfRect, byPlayers, cornersOfArea, cornersOfBox, type Field, growAreas, joinBoxes, onTable, plateAbove, plateBoxOf, type Pose, pointInFrame, polygonsOverlap, type Quad, row, seats as ringOf, type Spot, type TableBox } from "@pbgo/table"

/** A seat at the table: where it stands and the yaw that turns what lies there to face the middle, as the player who sits there sees it: the viewer's seat is at yaw 0, a seat across from them at π, one on their left at -π/2 */
export type SeatSpot = Required<Spot>

/** A place on the table, in world units: x to the right, z toward the viewer */
export type Place = { x: number; z: number }

/**
 * The knobs of the layout, edited by the Layout folder of the debug panel (`scene.tsx` binds them with `useSettings`). The seats stand all around the table like the chairs of a real one, the viewer in front, and everything of a seat (its plate, its line of cards,
 * the cards it sets aside) lies in the frame of the seat, which faces the middle of the table: from the middle outward, the plate (the name, then the total), the line, the cards set aside.
 */
export const LAYOUT_SETTINGS = {
  /** The ellipse the lines of the seats are centred on, for a table of three and for a table of eight (in between, in steps). Its far end is the line of the seat across, its sides those of the seats at the sides; the viewer's line stands in front of it
   * at `viewerZ`. How far the camera stands is not a knob: it is fitted to the window (`fitCamera`) */
  radiusX3: 5.8,
  radiusX8: 5.37,
  radiusZ3: 6.1,
  radiusZ8: 6.52,
  /**
   * The size of every card on the table, a share of the card of the game, for a table of three chairs and for a table of eight (in between, in steps): the viewer's line, the lines of the opponents, the cards set aside, the draw pile, the discard and the action card to give are
   * all of one size, as at a real table. A small table has bigger cards and room, a full one smaller ones. The two stickers that lie by a line are pictures sized in the cards of the line, so they follow
   */
  cardScale3: 0.93,
  cardScale8: 0.59,
  /** The viewer's line: how far toward them it lies and how wide it may spread */
  viewerZ: 3.9,
  viewerWidth: 13,
  /** How much of the distance to the next seat along the ring a line may take as its width: below 1 two neighbours leave a gap between them */
  share: 0.94,
  /** The widest a gap between two cards of a line may be, as a share of the width of a card: a line that does not fit its room draws its cards closer, over one another */
  gap: 1.06,
  /** The closest two cards of a line may come, as a share of the width of a card, so that the figure of each stays readable */
  closest: 0.22,
  /** The cards set aside (a Freeze or a Flip Three flipped during a Flip Three) lie in a row of their own beyond the line, the middle of the row this far from the middle of the line, in cards: 1 is a card's height, so a card of the row and a card of the line touch */
  heldDrop: 1.2,
  /** The draw pile and the discard, either side of the middle, with the viewer's one button between them: a little below the middle, so that the word over the draw pile clears the plate of the seat at its left at a table of three */
  pilesX: 2.38,
  pilesZ: 0.3,
}

export const LAYOUT_FIELDS: Record<keyof typeof LAYOUT_SETTINGS, Field> = {
  radiusX3: ["ring radius x · 3 players", 3, 12, 0.1],
  radiusX8: ["ring radius x · 8 players", 3, 14, 0.1],
  radiusZ3: ["ring radius z · 3 players", 2, 8, 0.1],
  radiusZ8: ["ring radius z · 8 players", 2, 10, 0.1],
  cardScale3: ["card scale · 3 players", 0.3, 1.4, 0.01],
  cardScale8: ["card scale · 8 players", 0.3, 1.2, 0.01],
  viewerZ: ["viewer line z", 0, 8, 0.05],
  viewerWidth: ["viewer line width", 4, 20, 0.1],
  share: ["line share of the ring", 0.4, 1.2, 0.01],
  gap: ["gap (cards)", 0.8, 1.4, 0.01],
  closest: ["closest (cards)", 0.05, 0.6, 0.01],
  heldDrop: ["set aside drop (cards)", 1, 2, 0.01],
  pilesX: ["piles x", 1.5, 5, 0.05],
  pilesZ: ["piles z", -3, 3, 0.05],
}

/** The width and height of a card of the game, in world units: the faces of Sanity are 326 by 512 */
export const CARD = { width: 1.2, height: 1.88 }

/** The fewest and the most players of a table: the radii and the size of the cards are given at these two numbers and go between them in steps */
export const TABLE_PLAYERS: Between = [3, 8]

/**
 * Where the player after the viewer sits, in degrees clockwise from the viewer's seat, for a table of each number of players: 90 is the viewer's left side, 180 straight across. It is also how far from the viewer the first and the last opponent keep: the wide line of the
 * viewer needs the room, and the more players the less each of them needs. The other opponents are spread evenly between the first and the last (`seats` of the table kit).
 */
export const FIRST_OPPONENT: Readonly<Record<number, number>> = { 3: 136, 4: 90, 5: 87, 6: 69, 7: 60, 8: 60 }

/** The seat of each player around the table, the ring of the kit with the radii, the angles and the viewer's place of this game: the viewer in front, the others in turn order, the turn passing to the viewer's left. A spectator has no seat in front. */
export function seatSpots(ids: readonly string[], meId: string | null): Map<string, SeatSpot> {
  const R = LAYOUT_SETTINGS
  const viewer = ids.indexOf(meId ?? "")
  const ring = ringOf(ids.length, { radiusX: [R.radiusX3, R.radiusX8], radiusZ: [R.radiusZ3, R.radiusZ8], me: viewer < 0 ? null : viewer, first: FIRST_OPPONENT, players: TABLE_PLAYERS, viewerZ: R.viewerZ })
  return new Map(ids.map((id, i): [string, SeatSpot] => [id, ring[i]!]))
}

/** The chairs of a table: its players, and one more for a spectator, who has none in front (the ring of `seats` is that of the table with one more player) */
export const chairsOf = (players: number, seated = true): number => (seated ? players : players + 1)

/** The chairs of the fullest table, for what is laid out for a table whose size is not said: the smallest cards */
const FULL_TABLE = TABLE_PLAYERS[1]

/** The size of every card that lies on a table of `chairs` chairs: the same for the lines of the viewer and of the opponents, the cards set aside, the draw pile, the discard and the action card to give, smaller as the table fills (in steps from three chairs to eight) */
export const cardScaleOf = (chairs: number): number => byPlayers(chairs, [LAYOUT_SETTINGS.cardScale3, LAYOUT_SETTINGS.cardScale8], TABLE_PLAYERS)

/** What a player's line is laid out in: where it lies, which way it faces (the yaw of its frame), how big its cards are (those of every card of the table), and the width it may take before its cards overlap */
export type Line = { at: Place; yaw: number; scale: number; width: number }

/** The frame of a seat, in which everything of the player is laid: the middle of its line and the way it faces. The top of the frame, its least z, is toward the middle of the table */
export const frameOf = (line: Pick<Line, "at" | "yaw">): SeatSpot => ({ x: line.at.x, z: line.at.z, yaw: line.yaw })

/**
 * The line of every player, by id. The viewer's lies in front of them, as wide as the room their neighbours leave; an opponent's lies where its seat is, turned to face its player, and may take a share of the way to the next seat along the ring, so that two
 * lines never run into each other. Every line has the cards of the table's one size (`cardScaleOf`).
 */
export function lines(spots: ReadonlyMap<string, SeatSpot>, meId: string | null): Map<string, Line> {
  const R = LAYOUT_SETTINGS
  const seated = meId !== null && spots.has(meId)
  const scale = cardScaleOf(chairsOf(spots.size, seated))
  const ids = [...spots.keys()]
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
    out.set(id, { at: { x: spot.x, z: spot.z }, yaw: spot.yaw, scale, width: Math.min(R.viewerWidth, room) })
  })
  if (seated) {
    // the viewer's line stretches until it meets the nearest thing beside it: the line of an opponent, its plate and the cards it sets aside, each as the shape it covers on the table
    let half = R.viewerWidth / 2
    const band = { min: R.viewerZ - (CARD.height * scale) / 2, max: R.viewerZ + (CARD.height * scale) / 2 }
    for (const other of out.values()) {
      for (const shape of [shapeOf(cardsBox(other), other), shapeOf(plateBox(other), other), shapeOf(heldBox(other), other)]) {
        // only a shape that reaches the band of the viewer's line is in its way
        if (Math.max(...shape.map((corner) => corner.z)) > band.min && Math.min(...shape.map((corner) => corner.z)) < band.max) half = Math.min(half, Math.max(CARD.width * scale, Math.min(...shape.map((corner) => Math.abs(corner.x))) - 0.3))
      }
    }
    out.set(meId, { at: { x: 0, z: R.viewerZ }, yaw: 0, scale, width: half * 2 })
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

/** The slots of a line of `n` cards, in the frame of its seat: a row centred on x = 0, the first on the left, each card a hair higher than the one before so that the ones that overlap never fight for a pixel. */
export function linePoses(n: number, line: Pick<Line, "scale" | "width">): Pose[] {
  return row(n, { gap: lineGap(n, line), rise: 0.012, scale: line.scale })
}

/** How far beyond the middle of the line, away from the middle of the table, the cards set aside lie, in the frame of the seat */
const heldZ = (line: Pick<Line, "scale">): number => CARD.height * line.scale * LAYOUT_SETTINGS.heldDrop

/** The cards set aside during a Flip Three: three at the most, a Freeze or a Flip Three each */
const HELD_MAX = 3

/** The slots of the cards set aside during a Flip Three, in the frame of their seat: a row beyond the line, on the side of the player, away from the middle of the table, where the plate is not. The cards are the size of those of the line and spread as they do, closer when the line is narrow */
export const heldPoses = (n: number, line: Pick<Line, "scale" | "width">): Pose[] => row(n, { gap: lineGap(n, line), z: heldZ(line), rise: 0.012, scale: line.scale })

/** The box of the line of a seat at the room it may take, in the frame of the seat: what the plate stands above (the `above` of the seat) */
export const cardsBox = (line: Pick<Line, "scale" | "width">, width: number = line.width): TableBox => boxOfRect({ x: 0, z: 0, width, depth: CARD.height * line.scale })

/** The box of the cards set aside, three at the most side by side, in the frame of the seat */
export const heldBox = (line: Pick<Line, "scale" | "width">): TableBox => boxOfRect({ x: 0, z: heldZ(line), width: Math.min(line.width, CARD.width * line.scale * (1 + (HELD_MAX - 1) * LAYOUT_SETTINGS.gap)), depth: CARD.height * line.scale })

/** The box of the plate of a seat, in its frame: the kit's plate, which stands on the side of the line that faces the middle of the table, centred on it, clear of it by `plateGap` */
export const plateBox = (line: Pick<Line, "scale" | "width">): TableBox => plateBoxOf(plateAbove(cardsBox(line)))

/** The corners of a box of the frame of a seat, on the table */
const shapeOf = (box: TableBox, line: Pick<Line, "at" | "yaw">): Quad => cornersOfBox(box, frameOf(line))

/** Where the draw pile and the discard lie: either side of the middle of the table. */
export function pilePlaces(): { deck: Place; discard: Place } {
  const R = LAYOUT_SETTINGS
  return { deck: { x: -R.pilesX, z: R.pilesZ }, discard: { x: R.pilesX, z: R.pilesZ } }
}

/**
 * The strip of the table between the two piles, where the viewer's one button and the card to give lie. It is as deep as the piles and its gaps are one length (`gap`): pile to pad and pad to discard, or pile to card and card to discard.
 * Stay (or Deal) stands in it across its width, and an action card drawn: the two never show at once. Hit is no pad: it is the draw pile, whose top card is pressed.
 */
export const FLOOR = { gap: 0.3 }

export type Pad = { x: number; z: number; width: number; depth: number }

export type FloorPlan = {
  /** The pad of the action that has no object: Stay on the viewer's turn, Deal for the dealer between two rounds. It lies across the strip, one gap from each pile, and as deep as the piles */
  pad: Pad
  /** The action card drawn, face up, at the left of the strip, beside the draw pile, the size of every card of the table */
  card: Place & { scale: number }
  /** The whole strip, for the footprints */
  strip: Pad
}

/** The floor between the piles of a table of `chairs` chairs, whose piles are of the size of every card of the table */
export function floorPlan(chairs: number = FULL_TABLE): FloorPlan {
  const scale = cardScaleOf(chairs)
  const { deck, discard } = pilePlaces()
  const cardWidth = CARD.width * scale
  const depth = CARD.height * scale
  const left = deck.x + cardWidth / 2
  const right = discard.x - cardWidth / 2
  const g = FLOOR.gap
  const z = deck.z
  const pad = { x: (left + right) / 2, z, width: right - left - 2 * g, depth }
  const cardX = left + g + cardWidth / 2
  return {
    pad,
    card: { x: cardX, z, scale },
    strip: { x: (left + right) / 2, z, width: right - left, depth },
  }
}

/**
 * How far the strip lies to the right of its place between the two piles while the discard has no card, which is the whole first round: the draw pile and the pad, with no discard beside them, lie centred on the table, half a card and a gap to the right of where they stand once the discard
 * is there. The board puts them in a `Glide` that is shifted by this much and brings them to their places when the first card reaches the discard, and the cards are dealt from above the pile where it lies (`dealtFrom`). Shifted, the pile (with its count and its word) and the pad stay inside the room
 * that the two piles and the strip keep clear of the seats (`fixedBoxes`), so the camera and the press areas are as they are, which `layout.test.ts` holds.
 */
export function stripShift(chairs: number = FULL_TABLE): number {
  return (CARD.width * cardScaleOf(chairs) + FLOOR.gap) / 2
}

/**
 * How far the count under the draw pile reaches past the edge of the pile, and the room the word over it (Hit) takes beyond its far edge, in world units: what the pile keeps clear on its two sides. The word stands up the screen from the far edge of the pile, its arrow
 * and its lettering a billboard, and a pile of cards is thick, which lifts it: as the camera sees them they take about as much of the table as 1.9 units of depth, and the room is 2.25 so that a plate never stands right against the lettering
 */
const PILE_COUNT = 0.8
const PILE_WORD = 2.25

/**
 * What lies on the table that is not a seat, as the boxes the seats keep clear of, in the world: the strip between the piles (the pad and the card to give), the draw pile with its count under it and the word over it, and the discard. The piles of a table of `chairs` chairs
 * are of the size of every card of it.
 */
export function fixedBoxes(chairs: number = FULL_TABLE): { name: string; box: TableBox }[] {
  const scale = cardScaleOf(chairs)
  const { deck, discard } = pilePlaces()
  const { strip } = floorPlan(chairs)
  const half = (CARD.width * scale) / 2
  const depth = (CARD.height * scale) / 2
  return [
    { name: "strip", box: boxOfRect({ x: strip.x, z: strip.z, width: strip.width, depth: strip.depth }) },
    { name: "draw pile", box: { minX: deck.x - half, maxX: deck.x + half, minZ: deck.z - depth - PILE_WORD, maxZ: deck.z + depth + PILE_COUNT } },
    { name: "discard", box: { minX: discard.x - half, maxX: discard.x + half, minZ: discard.z - depth, maxZ: discard.z + depth } },
  ]
}

const WORLD: Spot = { x: 0, z: 0 }
const fixedShapes = (chairs: number): { name: string; shape: Quad }[] => fixedBoxes(chairs).map(({ name, box }) => ({ name, shape: cornersOfBox(box, WORLD) }))

/** How far a player's area reaches past their cards on every side when there is room, in world units: generous, so a click or a tap needs no aim. Each side stops short of whatever is there: the plate of another seat, a pile, the buttons. */
export const ZONE_PADDING = 0.5

/** The widest an area gets, in world units: the viewer's line may spread across the whole front of the table, and an area as wide as that would be a band, not the place of a seat */
export const ZONE_MAX_WIDTH = 7

/**
 * The play area of a seat, in its frame: the line's room (at the widest `ZONE_MAX_WIDTH`) by the height of a card, the cards set aside when the box that holds them too is free of `avoid`, and the plate with the name, wherever it stands beyond the line. The plate is inside:
 * it is part of the area, so a press on the name counts.
 */
function playArea(line: Line, avoid: readonly Quad[], withHeld = true): TableBox {
  const R = LAYOUT_SETTINGS
  // with no padding left to give (`withHeld` false), the line counts at the room of a few cards: the room the line may take is wider than the cards that lie on it, and may reach the next seat's area
  const room = withHeld ? Math.min(line.width, ZONE_MAX_WIDTH) : Math.min(line.width, CARD.width * line.scale * (1 + 3 * R.gap))
  const own = cardsBox(line, room)
  const plate = plateBox(line)
  const withCards = withHeld ? joinBoxes([own, heldBox(line), plate])! : joinBoxes([own, plate])!
  return avoid.some((shape) => polygonsOverlap(shapeOf(withCards, line), shape)) ? joinBoxes([own, plate])! : withCards
}

/**
 * The area of every seat, by id, for a table of `chairs` chairs in which the lines lie as `placed` says: ONE area per player that the viewer presses to give them a card, their play area (`playArea`: the cards, the plate with the name inside it) and a generous padding all round
 * (`ZONE_PADDING`), a press anywhere in it, on the cards, the padding or the name, gives. Each side of the padding stops short of whatever the area keeps clear of, the plates of the other seats, the piles and the buttons, and where two areas overlap the padding of both gives back
 * until they only touch (`growAreas` of the table kit); with no padding left an area narrows along its line, never below its plate.
 */
export function zones(placed: ReadonlyMap<string, Line>, chairs: number = FULL_TABLE): Map<string, Area> {
  const plates = plateShapes(placed)
  const ids = [...placed.keys()]
  const fixed = fixedShapes(chairs).map(({ shape }) => shape)
  const seeds = new Map<string, AreaSeed>()
  for (const [id, line] of placed) {
    // what an area keeps clear of: the plates of the other seats, which are theirs, the piles and the buttons
    const avoid = [...ids.filter((other) => other !== id).map((other) => plates.get(other)!), ...fixed]
    seeds.set(id, { frame: frameOf(line), core: (share) => playArea(line, avoid, share > 0.3), avoid, plate: plateBox(line) })
  }
  return growAreas(seeds, ZONE_PADDING)
}

/** The plate of every seat on the table, by id, as the shape it covers */
const plateShapes = (placed: ReadonlyMap<string, Line>): Map<string, Quad> => new Map([...placed].map(([id, line]) => [id, shapeOf(plateBox(line), line)] as const))

/** The area of every seat of a table of `n` players, in turn order from the viewer (the first is the viewer's), for the tests that keep them apart from each other and from the piles */
export function zoneAreas(n: number, seated = true): Area[] {
  const ids = Array.from({ length: n }, (_, i) => String(i))
  const viewer = seated ? "0" : null
  const all = zones(lines(seatSpots(ids, viewer), viewer), chairsOf(n, seated))
  return ids.map((id) => all.get(id)!)
}

/**
 * Where things stand on a table of `n` players, as the shapes they cover on it: the plate of each seat and its line (a line of three cards for an opponent and of four for the viewer, or all the room the line may take when `full`), the draw pile with its count and the word
 * over it, the discard and the strip between the piles (Stay or the action card to give). The viewer is the first seat; a spectator (`seated` false) has none.
 */
export function tableShapes(n: number, full = false, seated = true): { name: string; shape: Quad }[] {
  const R = LAYOUT_SETTINGS
  const ids = Array.from({ length: n }, (_, i) => String(i))
  const viewer = seated ? "0" : null
  const placed = lines(seatSpots(ids, viewer), viewer)
  const out: { name: string; shape: Quad }[] = []
  for (const id of ids) {
    const line = placed.get(id)!
    out.push({ name: `plate of seat ${id}`, shape: shapeOf(plateBox(line), line) })
    const nominal = CARD.width * line.scale * (1 + (id === viewer ? 3 : 2) * R.gap)
    out.push({ name: `line of seat ${id}`, shape: shapeOf(cardsBox(line, full ? line.width : Math.min(nominal, line.width)), line) })
  }
  return [...out, ...fixedShapes(chairsOf(n, seated))]
}

/** The cards set aside of every seat of a table of `n` players, as the shapes they cover on it, in turn order from the viewer: three of them, the most there are, spread as the line spreads. They are not always there, so they are not in `tableShapes`, but nothing else may lie where they do */
export function heldShapes(n: number, seated = true): { name: string; shape: Quad }[] {
  const ids = Array.from({ length: n }, (_, i) => String(i))
  const viewer = seated ? "0" : null
  const placed = lines(seatSpots(ids, viewer), viewer)
  return ids.map((id) => ({ name: `cards set aside of seat ${id}`, shape: shapeOf(heldBox(placed.get(id)!), placed.get(id)!) }))
}

/** What the camera centres the window on (`fitCamera`): the corners of each shape of the table (`tableShapes`), at their nominal sizes, what is drawn. A longer line spreads, and may reach farther than this. */
export const seenQuads = (n: number, seated = true): Quad[] => tableShapes(n, false, seated).map(({ shape }) => shape)

/**
 * What the camera has to have in the window too, without it weighing on the centre (`fitCamera`): the areas that the viewer presses to give a card (`zoneAreas`), which reach a little past the plates and must never lie under a box of the platform, and the cards set aside
 * of every seat (`heldShapes`), wherever they would lie, so that a Freeze or a Flip Three that waits is never cut by the window, whatever the size of the table.
 */
export const reachQuads = (n: number, seated = true): Quad[] => [...zoneAreas(n, seated).map(cornersOfArea), ...heldShapes(n, seated).map(({ shape }) => shape)]

/** Everything the camera has to bring into the window, what is seen and what is reached */
export const tableQuads = (n: number, seated = true): Quad[] => [...seenQuads(n, seated), ...reachQuads(n, seated)]

/** The turn of a text that would be more than a quarter turn from upright, back by half a turn: a sticker is never read upside down */
export function uprightYaw(yaw: number): number {
  const turn = Math.atan2(Math.sin(yaw), Math.cos(yaw))
  return Math.abs(turn) <= Math.PI / 2 + 1e-9 ? turn : turn - Math.sign(turn) * Math.PI
}

/** Where a sticker lies, in world units: its centre, its width, the turn that makes it read upright from the viewer's side and the lean that makes it look thumped down by a hand */
export type StickerPlace = Place & { width: number; yaw: number; tilt: number }

/** How wide each sticker is, in cards of the line it lies by (a card is `CARD.width` wide, times the scale of the line) */
const STICKER_CARDS = { bust: 2.6, bonus: 3.4 }

/**
 * The two stickers of a seat. The BUST! stamp lies across the middle of the line, over its grey cards. The "+15 point bonus" badge lies on the side of the line away from the middle of the table, on the edge of its cards (on their middle it would hide the cards it celebrates,
 * and the plate stands on the other side). Both read upright from the viewer's side whoever's line they lie by (`uprightYaw`) and grow and shrink with the line. `bustAspect` and `bonusAspect` are the width over the height of the two pictures.
 */
export function stickerPlaces(line: Line, bustAspect: number, bonusAspect: number): { bust: StickerPlace; bonus: StickerPlace } {
  const card = CARD.width * line.scale
  const yaw = uprightYaw(line.yaw)
  const bonusWidth = STICKER_CARDS.bonus * card
  const lift = (CARD.height * line.scale) / 2 + bonusWidth / bonusAspect / 3
  const bonus = pointInFrame(frameOf(line), { x: 0, z: lift })
  return {
    bust: { x: line.at.x, z: line.at.z, width: STICKER_CARDS.bust * card, yaw, tilt: -0.16 },
    bonus: { x: bonus.x, z: bonus.z, width: bonusWidth, yaw, tilt: 0.1 },
  }
}

/** Where the cards are dealt from: above the draw pile where it lies (`shift`, how far the strip is moved from its place, `stripShift` or none), face down, the size of every card of a table of `chairs` chairs. */
export function dealtFrom(chairs: number = FULL_TABLE, shift = 0): Pose {
  const { deck } = pilePlaces()
  return onTable(deck.x + shift, deck.z, { y: 1.6, face: "down", scale: cardScaleOf(chairs) })
}
