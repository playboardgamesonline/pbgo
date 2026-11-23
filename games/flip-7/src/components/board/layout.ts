import { type Between, boxOfRect, byPlayers, cornersOfBox, type Field, joinBoxes, onTable, plateAbove, plateBoxOf, type Pose, pointInFrame, polygonsOverlap, type Quad, row, seats as ringOf, type Spot, type TableBox } from "@pbgo/table"

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
  radiusX3: 5.83,
  radiusX8: 5.75,
  radiusZ3: 5.9,
  radiusZ8: 6.27,
  /** The size of the cards of the opponents, for a table of three and for a table of eight: a small table has big cards, a full one small ones */
  opponentScale3: 0.91,
  opponentScale8: 0.59,
  /** The viewer's line: how far toward them it lies, how big its cards are and how wide it may spread */
  viewerZ: 4.15,
  viewerScale: 1,
  viewerWidth: 13,
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
  pilesX: 2.54,
  pilesZ: 0,
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

/** The fewest and the most players of a table: the radii and the size of the cards are given at these two numbers and go between them in steps */
export const TABLE_PLAYERS: Between = [3, 8]

/**
 * Where the player after the viewer sits, in degrees clockwise from the viewer's seat, for a table of each number of players: 90 is the viewer's left side, 180 straight across. It is also how far from the viewer the first and the last opponent keep: the wide line of the
 * viewer needs the room, and the more players the less each of them needs. The other opponents are spread evenly between the first and the last (`seats` of the table kit).
 */
export const FIRST_OPPONENT: Readonly<Record<number, number>> = { 3: 145, 4: 90, 5: 90, 6: 66, 7: 62, 8: 60 }

/** The seat of each player around the table, the ring of the kit with the radii, the angles and the viewer's place of this game: the viewer in front, the others in turn order, the turn passing to the viewer's left. A spectator has no seat in front. */
export function seatSpots(ids: readonly string[], meId: string | null): Map<string, SeatSpot> {
  const R = LAYOUT_SETTINGS
  const viewer = ids.indexOf(meId ?? "")
  const ring = ringOf(ids.length, { radiusX: [R.radiusX3, R.radiusX8], radiusZ: [R.radiusZ3, R.radiusZ8], me: viewer < 0 ? null : viewer, first: FIRST_OPPONENT, players: TABLE_PLAYERS, viewerZ: R.viewerZ })
  return new Map(ids.map((id, i): [string, SeatSpot] => [id, ring[i]!]))
}

/** The scale of the cards of the opponents at a table of `count` players: a spectator looks at a table with one more chair, and nine chairs on the ring of eight are closer together than the cards allow, so theirs are a little smaller */
export function opponentScaleOf(count: number, seated: boolean): number {
  const R = LAYOUT_SETTINGS
  const scale = byPlayers(seated ? count : count + 1, [R.opponentScale3, R.opponentScale8], TABLE_PLAYERS)
  return !seated && count >= TABLE_PLAYERS[1] ? scale * 0.82 : scale
}

/** What a player's line is laid out in: where it lies, which way it faces (the yaw of its frame), how big its cards are, and the width it may take before its cards overlap */
export type Line = { at: Place; yaw: number; scale: number; width: number }

/** The frame of a seat, in which everything of the player is laid: the middle of its line and the way it faces. The top of the frame, its least z, is toward the middle of the table */
export const frameOf = (line: Pick<Line, "at" | "yaw">): SeatSpot => ({ x: line.at.x, z: line.at.z, yaw: line.yaw })

/**
 * The line of every player, by id. The viewer's lies in front of them, as wide as the room their neighbours leave; an opponent's lies where its seat is, turned to face its player, and may take a share of the way to the next seat along the ring, so that two
 * lines never run into each other.
 */
export function lines(spots: ReadonlyMap<string, SeatSpot>, meId: string | null): Map<string, Line> {
  const R = LAYOUT_SETTINGS
  const seated = meId !== null && spots.has(meId)
  const scale = opponentScaleOf(spots.size, seated)
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
    // the viewer's line stretches until it meets the nearest thing beside it: the line of an opponent and its plate, each as the shape it covers on the table
    let half = R.viewerWidth / 2
    const band = { min: R.viewerZ - (CARD.height * R.viewerScale) / 2, max: R.viewerZ + (CARD.height * R.viewerScale) / 2 }
    for (const other of out.values()) {
      for (const shape of [shapeOf(cardsBox(other), other), shapeOf(plateBox(other), other)]) {
        // only a shape that reaches the band of the viewer's line is in its way
        if (Math.max(...shape.map((corner) => corner.z)) > band.min && Math.min(...shape.map((corner) => corner.z)) < band.max) half = Math.min(half, Math.max(CARD.width * R.viewerScale, Math.min(...shape.map((corner) => Math.abs(corner.x))) - 0.3))
      }
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

/** The slots of a line of `n` cards, in the frame of its seat: a row centred on x = 0, the first on the left, each card a hair higher than the one before so that the ones that overlap never fight for a pixel. */
export function linePoses(n: number, line: Pick<Line, "scale" | "width">): Pose[] {
  return row(n, { gap: lineGap(n, line), rise: 0.012, scale: line.scale })
}

/** How far beyond the middle of the line, away from the middle of the table, the cards set aside lie, in the frame of the seat */
const heldZ = (line: Pick<Line, "scale">): number => CARD.height * line.scale * LAYOUT_SETTINGS.heldDrop

/** The slots of the cards set aside during a Flip Three, in the frame of their seat: a small row beyond the line, on the side of the player, away from the middle of the table, where the plate is not */
export const heldPoses = (n: number, line: Pick<Line, "scale">): Pose[] =>
  row(n, { gap: CARD.width * line.scale * LAYOUT_SETTINGS.heldScale * 1.1, z: heldZ(line), rise: 0.012, scale: line.scale * LAYOUT_SETTINGS.heldScale })

/** The box of the line of a seat at the room it may take, in the frame of the seat: what the plate stands above (the `above` of the seat) */
export const cardsBox = (line: Pick<Line, "scale" | "width">, width: number = line.width): TableBox => boxOfRect({ x: 0, z: 0, width, depth: CARD.height * line.scale })

/** The box of the cards set aside, three at the most side by side, in the frame of the seat */
export const heldBox = (line: Pick<Line, "scale">): TableBox =>
  boxOfRect({ x: 0, z: heldZ(line), width: 3 * CARD.width * line.scale * LAYOUT_SETTINGS.heldScale * 1.1, depth: CARD.height * line.scale * LAYOUT_SETTINGS.heldScale })

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
  /** The action card drawn, face up, at the left of the strip, beside the draw pile, the size of the piles' cards */
  card: Place & { scale: number }
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
  const z = deck.z
  const pad = { x: (left + right) / 2, z, width: right - left - 2 * g, depth }
  const cardX = left + g + cardWidth / 2
  return {
    pad,
    card: { x: cardX, z, scale: R.pileScale },
    strip: { x: (left + right) / 2, z, width: right - left, depth },
  }
}

/** How far the count under the draw pile reaches past the edge of the pile, and the room the word over it (Hit) takes beyond its far edge, in world units: what the pile keeps clear on its two sides */
const PILE_COUNT = 0.8
const PILE_WORD = 1.3

/**
 * What lies on the table that is not a seat, as the boxes the seats keep clear of, in the world: the strip between the piles (the pad and the card to give), the draw pile with its count under it and the word over it, and the discard.
 */
export function fixedBoxes(): { name: string; box: TableBox }[] {
  const R = LAYOUT_SETTINGS
  const { deck, discard } = pilePlaces()
  const { strip } = floorPlan()
  const half = (CARD.width * R.pileScale) / 2
  const depth = (CARD.height * R.pileScale) / 2
  return [
    { name: "strip", box: boxOfRect({ x: strip.x, z: strip.z, width: strip.width, depth: strip.depth }) },
    { name: "draw pile", box: { minX: deck.x - half, maxX: deck.x + half, minZ: deck.z - depth - PILE_WORD, maxZ: deck.z + depth + PILE_COUNT } },
    { name: "discard", box: { minX: discard.x - half, maxX: discard.x + half, minZ: discard.z - depth, maxZ: discard.z + depth } },
  ]
}

const WORLD: Spot = { x: 0, z: 0 }
const fixedShapes = (): { name: string; shape: Quad }[] => fixedBoxes().map(({ name, box }) => ({ name, shape: cornersOfBox(box, WORLD) }))

/** How far a player's area reaches past their cards on every side when there is room, in world units: generous, so a click or a tap needs no aim. Each side stops short of whatever is there: the plate of another seat, a pile, the buttons. */
export const ZONE_PADDING = 0.5

/** The widest an area gets, in world units: the viewer's line may spread across the whole front of the table, and an area as wide as that would be a band, not the place of a seat */
export const ZONE_MAX_WIDTH = 7

/** The area of a seat that a press counts in: a box in the frame of the seat, which the `Hotspot` of the seat stands on */
export type Area = { frame: SeatSpot; box: TableBox }

/** Where a `Hotspot` stands for an area: the middle of its box on the table, the yaw of its frame, and its size */
export function areaPlace({ frame, box }: Area): { at: Spot; width: number; depth: number } {
  const middle = pointInFrame(frame, { x: (box.minX + box.maxX) / 2, z: (box.minZ + box.maxZ) / 2 })
  return { at: { ...middle, yaw: frame.yaw }, width: box.maxX - box.minX, depth: box.maxZ - box.minZ }
}

const areaShape = ({ frame, box }: Area): Quad => cornersOfBox(box, frame)

/** A box grown by a padding on each of its four sides (in the frame: left, right, toward the middle of the table, away from it) */
function padded(box: TableBox, [left, right, inner, outer]: readonly number[]): TableBox {
  return { minX: box.minX - left!, maxX: box.maxX + right!, minZ: box.minZ - inner!, maxZ: box.maxZ + outer! }
}

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
 * The area of a seat that the viewer presses to give it a card: ONE area per player, their play area: the cards, the plate with the name inside it, and a generous padding all round. A press anywhere in it, on the cards, the padding or the name, gives the player the card.
 * Each side of the padding grows to `ZONE_PADDING` and stops short of whatever `avoid` holds there (the plates of the other seats, the piles, the buttons), so the area is as large as the room lets it be.
 */
export function zoneBox(line: Line, avoid: readonly Quad[], share = 1): TableBox {
  const core = playArea(line, avoid, share > 0.3)
  const shape = (box: TableBox) => shapeOf(box, line)
  // a thing the play area is already a hair from is kept clear as it is; the others with a little room to spare
  const room = avoid.map((other) => ({ other, by: polygonsOverlap(shape(core), other, 0.02) ? 0 : 0.02 }))
  const pad = [0, 0, 0, 0].map((_, side) => {
    let value = ZONE_PADDING * share
    const only = (amount: number) => padded(core, [0, 1, 2, 3].map((i) => (i === side ? amount : 0)))
    while (value > 0 && room.some(({ other, by }) => polygonsOverlap(shape(only(value)), other, by))) value = Math.max(0, value - 0.05)
    return value
  })
  // the sides together, at the corners: all of the padding shrinks until nothing is touched
  let box = padded(core, pad)
  for (let i = 0; i < 40 && avoid.some((other) => polygonsOverlap(shape(box), other)); i++) {
    for (let k = 0; k < 4; k++) pad[k] = pad[k]! * 0.85
    box = padded(core, pad)
  }
  return box
}

/** The plate of every seat on the table, by id, as the shape it covers */
const plateShapes = (placed: ReadonlyMap<string, Line>): Map<string, Quad> => new Map([...placed].map(([id, line]) => [id, shapeOf(plateBox(line), line)] as const))

/**
 * The area of every seat, by id, for a table in which the lines lie as `placed` says. Where two areas overlap, the padding of both shrinks, a little at a time, until they only touch; with no padding an area is the cards alone, which no other line overlaps.
 */
export function zones(placed: ReadonlyMap<string, Line>): Map<string, Area> {
  const plates = plateShapes(placed)
  const ids = [...placed.keys()]
  const fixed = fixedShapes().map(({ shape }) => shape)
  // what an area keeps clear of: the plates of the other seats, which are theirs, the piles and the buttons
  const avoidOf = (id: string) => [...ids.filter((other) => other !== id).map((other) => plates.get(other)!), ...fixed]
  const share = new Map(ids.map((id) => [id, 1]))
  const build = (id: string): Area => ({ frame: frameOf(placed.get(id)!), box: zoneBox(placed.get(id)!, avoidOf(id), share.get(id)) })
  const out = new Map(ids.map((id) => [id, build(id)] as const))
  for (let pass = 0; pass < 60; pass++) {
    let touched = false
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        if (!polygonsOverlap(areaShape(out.get(ids[i]!)!), areaShape(out.get(ids[j]!)!))) continue
        touched = true
        for (const id of [ids[i]!, ids[j]!]) {
          share.set(id, share.get(id)! * 0.9)
          out.set(id, build(id))
        }
      }
    }
    if (!touched) break
  }
  // last resort, with no padding left: the area narrows along its line, never below its plate
  for (let pass = 0; pass < 100; pass++) {
    let touched = false
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        if (!polygonsOverlap(areaShape(out.get(ids[i]!)!), areaShape(out.get(ids[j]!)!))) continue
        touched = true
        for (const id of [ids[i]!, ids[j]!]) {
          const { frame, box } = out.get(id)!
          const plate = plateBox(placed.get(id)!)
          const half = Math.max((plate.maxX - plate.minX) / 2, ((box.maxX - box.minX) / 2) * 0.97)
          out.set(id, { frame, box: { ...box, minX: -half, maxX: half } })
        }
      }
    }
    if (!touched) break
  }
  return out
}

/** The area of every seat of a table of `n` players, in turn order from the viewer (the first is the viewer's), for the tests that keep them apart from each other and from the piles */
export function zoneAreas(n: number, seated = true): Area[] {
  const ids = Array.from({ length: n }, (_, i) => String(i))
  const viewer = seated ? "0" : null
  const all = zones(lines(seatSpots(ids, viewer), viewer))
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
  return [...out, ...fixedShapes()]
}

/** What the camera centres the window on (`fitCamera`): the corners of each shape of the table (`tableShapes`), at their nominal sizes, what is drawn. A longer line spreads, and may reach farther than this. */
export const seenQuads = (n: number, seated = true): Quad[] => tableShapes(n, false, seated).map(({ shape }) => shape)

/** What the camera has to have in the window too, without it weighing on the centre (`fitCamera`): the areas that the viewer presses to give a card (`zoneAreas`), which reach a little past the plates and must never lie under a box of the platform. */
export const reachQuads = (n: number, seated = true): Quad[] => zoneAreas(n, seated).map(areaShape)

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

/** Where the cards are dealt from: above the draw pile, face down. */
export function dealtFrom(): Pose {
  const { deck } = pilePlaces()
  return onTable(deck.x, deck.z, { y: 1.6, face: "down", scale: LAYOUT_SETTINGS.pileScale })
}
