import { boxAbove, boxOfRect, byPlayers, cornersOfBox, type Field, frameBoxOfPoses, HELD_FAN_SETTINGS, heldFan, heldLeftPose, heldShadow, joinBoxes, onAxis, onTable, padBox, type Plate, plateAbove, plateBoxOf, type Pose, row, SCREEN_HAND_SETTINGS, seats as ringOf, shifted, type Spot, type TableBox } from "@pbgo/table"

/** A seat at the table: where the line of a player starts and the yaw that turns what lies in it to face the middle of the table, as the player who sits there sees it: the viewer's seat is at yaw 0, a seat across from them at π, one on their left at -π/2 */
export type SeatSpot = Required<Spot>

/** A place on the table, in world units: x to the right, z toward the viewer */
export type Place = { x: number; z: number }

/** The width and height of a card of the game, in world units: the faces of Sanity are 760 by 1060 (38:53) */
export const CARD = { width: 1.2, height: (1.2 * 1060) / 760 }

/** The tilt of the camera from the vertical, in degrees (`CAMERA` of `camera.ts` stands at it): the hands that stand up are seen where the table lies `height × tan(tilt)` farther from the camera */
export const VIEW_TILT = 46

/** The most cards a hand holds: three, while a Chancellor is read */
export const HAND_MAX = 3

/**
 * The knobs of the layout, edited by the Layout folder of the debug panel (`scene.tsx` binds them with `useSettings`). Every player is one line along the axis of their seat, which faces the middle of the table: from the middle outward their plate (the name, the favor tokens),
 * the play area (the cards they played or discarded this round, in a row) and their hand. The ring is where each line starts, its outer end, the hand's foot. The hands are the kit's (the Held hands folder for the others', the Hand folder for the viewer's, which is held on the screen).
 */
export const LAYOUT_SETTINGS = {
  /** The ellipse the lines of the opponents start on, for a table of two and for a table of six (in between, in steps). Its far end is the seat across, its sides those of the seats at the sides. How far the camera stands is not a knob: it is fitted to the window (`fitCamera`) */
  radiusX2: 6.4,
  radiusX6: 7.4,
  radiusZ2: 5.6,
  radiusZ6: 7.2,
  /**
   * Where the player after the viewer sits, in degrees clockwise from the viewer's seat as the camera sees the table (0: in front, 90: the viewer's left, 180: straight across), for a table of three to six players (two sit across). It is also how far from the viewer
   * the first and the last opponent keep: the viewer's own line needs the room, and the more players the less each of them needs. The other opponents are spread evenly between the first and the last. At four and five players the side seats stand about at the sides,
   * a little toward the viewer, not on the line across the table: there they would lie under the log of the turns that the platform draws at the top left of the window.
   */
  first3: 142,
  first4: 88,
  first5: 86,
  first6: 76,
  /** How far toward the viewer the foot of their own line lies (their hand is held on the screen, so it is where the hand would be) */
  viewerZ: 5.0,
  /** The size of the cards of an opponent's play area and the width its row may spread over, for a table of two and for a table of six: a small table has big cards and room, a full one small ones */
  areaScale2: 0.85,
  areaScale6: 0.62,
  areaWidth2: 6.4,
  areaWidth6: 2.4,
  /** The viewer's play area: how big its cards are and how wide it may spread */
  viewerAreaScale: 0.72,
  viewerAreaWidth: 3.2,
  /** The clear space between the play area and the hand of a line, in world units. The plate stands `plateGap` of the kit beyond the two */
  blockGap: 0.25,
  /** The widest a gap between two cards of a play area may be, as a share of the width of a card, and the closest two may come: the medallion with the value is the left third of a face, so a card lies about a third over the one before it at the most */
  gap: 1.06,
  closest: 0.34,
  /** The room round a player's cards and plate that a press counts in, in world units */
  hotspotPadding: 0.04,
  /**
   * The deck on the left of the middle, with the columns of the cards that are done with right beside it, to its right (`MIDDLE`), and the card set aside under it, and at two players the three cards set aside face up under that: where each lies and how big it is. The top
   * of the deck is the top of the columns
   */
  deckX: -3.2,
  deckZ: -0.2,
  deckScale: 0.85,
  asideX: -3.2,
  asideZ: 1.95,
  asideScale: 0.6,
  faceUpX: -3.2,
  faceUpZ: 2.92,
  faceUpScale: 0.5,
}

export const LAYOUT_FIELDS: Record<keyof typeof LAYOUT_SETTINGS, Field> = {
  radiusX2: ["ring radius x · 2 players", 3, 12, 0.1],
  radiusX6: ["ring radius x · 6 players", 3, 14, 0.1],
  radiusZ2: ["ring radius z · 2 players", 2, 10, 0.1],
  radiusZ6: ["ring radius z · 6 players", 2, 10, 0.1],
  first3: ["first opponent · 3 players", 90, 180, 1],
  first4: ["first opponent · 4 players", 60, 180, 1],
  first5: ["first opponent · 5 players", 50, 180, 1],
  first6: ["first opponent · 6 players", 40, 180, 1],
  viewerZ: ["viewer line z", 0, 10, 0.05],
  areaScale2: ["opponent area scale · 2", 0.3, 1.4, 0.01],
  areaScale6: ["opponent area scale · 6", 0.3, 1.2, 0.01],
  areaWidth2: ["opponent area width · 2", 1, 12, 0.1],
  areaWidth6: ["opponent area width · 6", 1, 12, 0.1],
  viewerAreaScale: ["viewer area scale", 0.4, 1.6, 0.01],
  viewerAreaWidth: ["viewer area width", 2, 20, 0.1],
  blockGap: ["gap between area and hand", 0, 1, 0.01],
  gap: ["gap (cards)", 0.8, 1.4, 0.01],
  closest: ["closest (cards)", 0.05, 0.6, 0.01],
  hotspotPadding: ["press room round a player", 0, 1, 0.01],
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

/** The chairs of a table: its players, and one more for a spectator, who has none in front (the ring of `seats` is that of the table with one more player) */
export const chairsOf = (players: number, seated = true) => (seated ? players : players + 1)

/** What grows with the table, for `chairs` chairs: from the value for two (the fewest) to the value for six (the most), in steps in between */
const between = (chairs: number, two: number, six: number) => byPlayers(chairs, [two, six], [2, 6])

/** The seat of each player around the table: the viewer in front, the others on the ring in turn order, the turn passing to the viewer's left. A spectator (`meId` null) sits at the places of a table with one more player. The ring is `seats` of the kit */
export function seats(ids: readonly string[], meId: string | null): Map<string, SeatSpot> {
  const R = LAYOUT_SETTINGS
  const viewer = ids.indexOf(meId ?? "")
  const ring = ringOf(ids.length, { radiusX: [R.radiusX2, R.radiusX6], radiusZ: [R.radiusZ2, R.radiusZ6], players: [2, 6], first: { 2: 180, 3: R.first3, 4: R.first4, 5: R.first5, 6: R.first6 }, viewerZ: R.viewerZ, me: viewer < 0 ? null : viewer })
  return new Map(ids.map((id, i): [string, SeatSpot] => [id, ring[i]!]))
}

/** What a play area is laid out in: how big its cards are and the width its row may take before its cards overlap more */
export type Area = { scale: number; width: number }

/** The play area of a seat of a table of `chairs` chairs: the viewer's, or an opponent's, which is smaller as the table fills */
export function areaOf(chairs: number, viewer: boolean): Area {
  const R = LAYOUT_SETTINGS
  if (viewer) return { scale: R.viewerAreaScale, width: R.viewerAreaWidth }
  return { scale: between(chairs, R.areaScale2, R.areaScale6), width: between(chairs, R.areaWidth2, R.areaWidth6) }
}

/** The gap between two cards of an area of `n` that has `width` to spread in: as wide as `gap` allows, closer when the area does not fit, and never closer than `closest`, so that the value of each card stays in sight */
export function areaGap(n: number, { scale, width }: Area): number {
  const R = LAYOUT_SETTINGS
  const card = CARD.width * scale
  const widest = card * R.gap
  if (n <= 1) return widest
  return Math.max(card * R.closest, Math.min(widest, (width - card) / (n - 1)))
}

/** The slots of an area of `n` cards, in the frame of the seat, on its axis and in `playBox` (`z` is the middle of that box): a row, the first (the oldest) on the left, each card a hair higher than the one before so that the ones that overlap never fight for a pixel */
export function areaPoses(n: number, area: Area, z: number): Pose[] {
  return row(n, { gap: areaGap(n, area), rise: 0.012, scale: area.scale }).map((pose) => shifted(pose, { z }))
}

/** The slots of the cards another player holds, a small fan of backs that stands, in the frame of their seat: `heldFan` of the kit. The small round shadow under them is `HELD_SHADOW` */
export function heldLayout(n: number, seat: SeatSpot): Pose[] {
  return heldFan(n, seat.yaw, CARD)
}

/** The small round shadow under an opponent's hand: how far it reaches for `n` cards, and how dark it is */
export const HELD_SHADOW = heldShadow()

/** Where a card played from an opponent's hand of `count` flies from: the left end of the fan, as the viewer sees it (`heldLeftPose`), the hand still the size it was */
export function heldFrom(seat: SeatSpot, count: number): Pose {
  return heldLeftPose(seat, (n) => heldLayout(n, seat), count)
}

/**
 * The viewer's hand, held at the bottom left of the screen as Courtisans holds its own (`ScreenHand`): the kit's numbers, but for the room it may take, which stops short of the viewer's play area in front of the middle of the table, so that a hand of three cards (a
 * Chancellor's) packs its cards closer instead of covering what the player laid down
 */
export const HAND_SETTINGS = { ...SCREEN_HAND_SETTINGS, room: 0.28 }

/** The slots of a hand laid face up once a round that ended on a comparison has revealed it, in the frame of its seat: a row of faces where the hand stood, the size of the cards that were held */
export function revealedPoses(n: number, line: Line): Pose[] {
  const scale = HELD_FAN_SETTINGS.scale
  const z = (line.hand.minZ + line.hand.maxZ) / 2
  return row(n, { gap: CARD.width * scale * 1.1, rise: 0.012, scale }).map((pose) => shifted(pose, { z }))
}

/** What the viewer's hand takes of the line of their seat: nothing, since it is held on the screen and not on the table, so its place on the line is the foot of it, where the seat is, and their play area and their name stand where an opponent's do */
const VIEWER_HAND: TableBox = { minX: -1, maxX: 1, minZ: 0, maxZ: 0 }

/**
 * How far the favor tokens reach beyond the right edge of the box a plate is taken to cover (`plateBoxOf`: the avatar and six letters): the lettering of a longer name goes on to the right of that box, up to twelve letters, and the stack of discs hangs off the
 * right edge of the lettering, about 0.6 wide. What a plate covers of the table reaches that far to the right of the player who sits there, in world units.
 */
export const PLATE_TRAILING = 1.45

/** What a plate covers of the table, in the frame of its seat: the avatar, the lettering and the favor tokens beside it */
export function plateCover(plate: Plate): TableBox {
  const box = plateBoxOf(plate)
  return { ...box, maxX: box.maxX + PLATE_TRAILING }
}

/** Everything of one player on the table, in the frame of their seat (x to the right of the player who sits there, the least z toward the middle of the table): the boxes of their hand, their play area, their cards together, their plate and the area a press counts in */
export type Line = {
  seat: SeatSpot
  viewer: boolean
  area: Area
  /** The hand of every size from one card to `HAND_MAX` together, as the camera sees it, so that nothing moves as cards are played and drawn. The viewer's takes no room: it is held on the screen */
  hand: TableBox
  /** The room of the play area: on the axis, on the middle's side of the hand, `blockGap` clear of it */
  play: TableBox
  /** The hand and the play area together, which the plate of the seat stands above (`above` of a `Seat`) */
  cards: TableBox
  /** Where the plate stands, from `plateAbove` of the kit, and what it covers with the tokens beside the name */
  plate: Plate
  plateBox: TableBox
  /** The area a press counts in, to choose the player: their cards and their plate, with `hotspotPadding` all round */
  press: TableBox
}

/** The line of the player in `seat` at a table of `chairs` chairs, whether they are the viewer or not. The plate stands above the play area and the hand joined; the play area is above the hand */
export function lineOf(seat: SeatSpot, viewer: boolean, chairs: number): Line {
  const R = LAYOUT_SETTINGS
  const area = areaOf(chairs, viewer)
  const hand = viewer ? VIEWER_HAND : onAxis(joinBoxes(Array.from({ length: HAND_MAX }, (_, i) => frameBoxOfPoses(heldLayout(i + 1, seat), CARD, seat, { tilt: VIEW_TILT })))!)
  const play = boxAbove(hand, { width: area.width, depth: CARD.height * area.scale }, R.blockGap, 0)
  const cards = onAxis(joinBoxes([hand, play])!)
  const plate = plateAbove(cards)
  const plateBox = plateCover(plate)
  const press = padBox(joinBoxes([cards, plateBox])!, [R.hotspotPadding, R.hotspotPadding, R.hotspotPadding, R.hotspotPadding])
  return { seat, viewer, area, hand, play, cards, plate, plateBox, press }
}

/** The line of every player, by id, for the seats of `seats` */
export function lines(ids: readonly string[], meId: string | null): Map<string, Line> {
  const ring = seats(ids, meId)
  const chairs = chairsOf(ids.length, ids.includes(meId ?? ""))
  return new Map(ids.map((id): [string, Line] => [id, lineOf(ring.get(id)!, id === meId, chairs)]))
}

/** The lines of a table of `n` players, in turn order from the viewer (the first is the viewer's), for the tests and the camera; a spectator (`seated` false) has no seat in front */
export function tableLines(n: number, seated = true): Line[] {
  const ids = Array.from({ length: n }, (_, i) => String(i))
  return [...lines(ids, seated ? "0" : null).values()]
}

/** Where the deck, the card set aside under it and the cards set aside face up under that lie */
export function middlePlaces(): { deck: Place; aside: Place; faceUp: Place } {
  const R = LAYOUT_SETTINGS
  return { deck: { x: R.deckX, z: R.deckZ }, aside: { x: R.asideX, z: R.asideZ }, faceUp: { x: R.faceUpX, z: R.faceUpZ } }
}

/** The slots of the three cards set aside face up at two players, in the frame of their place */
export const faceUpPoses = (n: number): Pose[] => row(n, { gap: CARD.width * LAYOUT_SETTINGS.faceUpScale * 1.1, rise: 0.012, scale: LAYOUT_SETTINGS.faceUpScale })

/**
 * The middle of the table. The deck is on the left, and right beside it, to its right, lie the cards of the round that are done with (`tableCards` of `middle.ts`): one column for each value, from the Spy (0) to the Princess (9), side by side in ascending order, the copies of a
 * value one under the other so that each stays in sight. Above the columns the faces of a reveal show for the time it takes to read them (a Priest's look, a Baron's comparison, a King's trade); below them lie, one thing at a time, the Deal button for the player who deals and
 * the nine characters a Guard can name, in a row. Under the deck lie the card set aside and, at two players, the three set aside face up. It all lies well above the bottom band of the window that the banner of the cookie settings covers, and clear of the plates, the areas
 * and the hands of every table: `layout.test.ts` and `camera.test.ts` hold both. The table writes no sentence: what to do is said by the ticker.
 */
export const MIDDLE = {
  /**
   * The columns: where the centre of the first one lies along x, how big each card is (a share of a card of the table), the gap between two columns (a share of a card's width), how many values there are (a column for each, from 0) and how far each copy lies under the one
   * before it, as a share of a card's height (a third of a face keeps its banner, its name and the medallion with the value in sight). `copies` is the most there are of one value, the Guards: the room under a column is made for them. They start along z where the deck does: the
   * top edge of the first card of each column is the top edge of the deck
   */
  columns: { x: -2.2, scale: 0.5, gap: 0.1, values: 10, cascade: 0.31, copies: 6 },
  /** The Deal button, centred, below the columns */
  deal: { z: 1.85, width: 2.8, depth: 0.8 },
  /** The nine characters a Guard can name, as small faces in one row below the columns, centred, in the order of their value: how big each is (a share of a card of the table), the gap between two and where the row lies along z */
  guess: { scale: 0.42, gap: 0.08, z: 1.85 },
  /** The faces of a reveal, above the columns: one in the middle, two a little more than a card apart, how high they lie and how big they are */
  reveal: { z: -1.9, y: 0.2, scale: 0.72, apart: 1.7 },
}

/** A thing lying on the table: where it lies and how big it is, in world units, along x and z */
export type Pad = { x: number; z: number; width: number; depth: number }

/** The place of the Deal button */
export const dealPlace = (): Pad => ({ x: 0, ...MIDDLE.deal })

/** Where the nine characters a Guard can name lie, from the left (the order of `GUESSES`): each a small face, `width` by `depth` on the table */
export function guessPlaces(count = 9): Pad[] {
  const { scale, gap, z } = MIDDLE.guess
  const width = CARD.width * scale
  const depth = CARD.height * scale
  return Array.from({ length: count }, (_, i) => ({ x: (i - (count - 1) / 2) * (width + gap), z, width, depth }))
}

/** The slots of the nine small faces, in the frame of the table */
export const guessPoses = (count = 9): Pose[] => guessPlaces(count).map((place) => onTable(place.x, place.z, { scale: MIDDLE.guess.scale }))

/** Where the faces of a reveal of `count` cards lie, in the frame of the table, side by side */
export const revealPoses = (count: number): Pose[] => Array.from({ length: count }, (_, i) => onTable((i - (count - 1) / 2) * MIDDLE.reveal.apart, MIDDLE.reveal.z, { y: MIDDLE.reveal.y, scale: MIDDLE.reveal.scale }))

/** How wide a card of the columns is, how tall, how far one column lies from the next (the gap between two included) and where the columns start along z: the top edge of the deck, as it is while the debug panel moves it */
function columnSizes() {
  const { scale, gap } = MIDDLE.columns
  const width = CARD.width * scale
  const { deckZ, deckScale } = LAYOUT_SETTINGS
  return { width, height: CARD.height * scale, pitch: width * (1 + gap), top: deckZ - (CARD.height * deckScale) / 2 }
}

/**
 * The slots of the cards that are done with, one for each value of `values` (the values printed on the cards, in the order the cards are given): each lies in the column of its value, the first of a value at the top of it and each copy `cascade` of a card's height under the
 * one before it, a hair higher so that the ones that overlap never fight for a pixel. Which column a card is in depends on its value alone and its row on how many cards of that value come before it, so a card that joins never moves another sideways
 */
export function columnPoses(values: readonly number[]): Pose[] {
  const { x, scale, cascade } = MIDDLE.columns
  const { height, pitch, top } = columnSizes()
  const rows = new Map<number, number>()
  return values.map((value) => {
    const row = rows.get(value) ?? 0
    rows.set(value, row + 1)
    return shifted(onTable(x + value * pitch, top + height / 2 + row * cascade * height, { scale }), { y: row * 0.012 })
  })
}

/** The box of all the columns at their fullest: every value, and the most copies of one under it */
export function columnsBox(): TableBox {
  const { x, values, cascade, copies } = MIDDLE.columns
  const { width, height, pitch, top } = columnSizes()
  return { minX: x - width / 2, maxX: x + (values - 1) * pitch + width / 2, minZ: top, maxZ: top + height + (copies - 1) * cascade * height }
}

/** The box of the Deal button, of the row of the nine characters and of the faces of a reveal (two at the most): each lies where `MIDDLE` says, one at a time, and the room is kept for all */
export function controlBoxes(): { deal: TableBox; guess: TableBox; reveal: TableBox } {
  const pad = dealPlace()
  const faces = guessPlaces()
  const faceWidth = CARD.width * MIDDLE.reveal.scale
  return {
    deal: boxOfRect(pad),
    guess: { minX: faces[0]!.x - faces[0]!.width / 2, maxX: faces[faces.length - 1]!.x + faces[faces.length - 1]!.width / 2, minZ: MIDDLE.guess.z - faces[0]!.depth / 2, maxZ: MIDDLE.guess.z + faces[0]!.depth / 2 },
    reveal: boxOfRect({ x: 0, z: MIDDLE.reveal.z, width: MIDDLE.reveal.apart + faceWidth, depth: CARD.height * MIDDLE.reveal.scale }),
  }
}

/** The boxes of the middle of the table, in the world: the deck with its count under it, the card set aside, the cards set aside face up (three of them), the columns, and the room of the controls */
export function middleBoxes(faceUp: boolean): TableBox[] {
  const R = LAYOUT_SETTINGS
  const { deck, aside, faceUp: up } = middlePlaces()
  const controls = controlBoxes()
  const boxes: TableBox[] = [
    boxOfRect({ x: deck.x, z: deck.z + 0.4, width: CARD.width * R.deckScale, depth: CARD.height * R.deckScale + 0.8 }),
    boxOfRect({ x: aside.x, z: aside.z, width: CARD.width * R.asideScale, depth: CARD.height * R.asideScale }),
  ]
  if (faceUp) boxes.push(boxOfRect({ x: up.x, z: up.z, width: CARD.width * R.faceUpScale * 3.2, depth: CARD.height * R.faceUpScale }))
  boxes.push(columnsBox(), controls.deal, controls.guess, controls.reveal)
  return boxes
}

/** The corners on the table of a box drawn in the frame of a seat, going round: what the camera has to bring into the window, and what the tests lay over one another */
export const quadOf = (box: TableBox, seat: Spot): Place[] => cornersOfBox(box, seat)

/** The corners of a box of the world (a seat's frame at the origin, unturned) */
const worldQuad = (box: TableBox): Place[] => cornersOfBox(box, { x: 0, z: 0, yaw: 0 })

/** A box on the other side of the table: the same distance from the middle line, turned the other way */
const mirrored = (box: TableBox): TableBox => ({ minX: -box.maxX, maxX: -box.minX, minZ: box.minZ, maxZ: box.maxZ })

/**
 * What the camera centres the window on (`fitCamera`): the plate and the play area of every seat, at their nominal sizes, and the middle of the table with its mirror image, what is drawn. An opponent's hand is left out: it is in the area of its seat (`reachQuads`), the
 * camera keeps it in the window, and it is too small a thing for the platform's boxes to be measured on. The middle band is read as a whole that is the same on both sides (the deck on one, the card set aside and the three set aside face up on the other), so that the scene stays in the middle of the window whatever lies in either half of it. A longer row of cards spreads
 * only as far as its play area, which is always the room of the biggest.
 */
export function seenQuads(n: number, seated = true): Place[][] {
  const middle = middleBoxes(n === 2)
  return [
    ...tableLines(n, seated).flatMap((line) => [line.plateBox, line.play].map((box) => quadOf(box, line.seat))),
    ...middle.map(worldQuad),
    ...middle.map((box) => worldQuad(mirrored(box))),
  ]
}

/** What the camera has to have in the window too, without it weighing on the centre: the areas that the viewer presses to choose a player, which reach a little past the plates, and must never lie under a box of the platform */
export const reachQuads = (n: number, seated = true): Place[][] => tableLines(n, seated).map((line) => quadOf(padBox(line.press, [REACH_MARGIN, REACH_MARGIN, REACH_MARGIN, REACH_MARGIN]), line.seat))

/** How far past the area of a seat the camera keeps the window, in world units: the cards of a hand that stands are seen a little higher than the flat model of the camera's fit puts them, and the viewer's finger has no aim to lose */
const REACH_MARGIN = 0.5

/** Where the cards are dealt from: above the deck, face down */
export function dealtFrom(): Pose {
  const { deck } = middlePlaces()
  return onTable(deck.x, deck.z, { y: 1.6, face: "down", scale: LAYOUT_SETTINGS.deckScale })
}
