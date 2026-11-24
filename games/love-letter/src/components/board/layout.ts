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
  radiusX2: 5.8,
  radiusX6: 6.7,
  radiusZ2: 4.4,
  radiusZ6: 6.4,
  /**
   * Where the player after the viewer sits, in degrees clockwise from the viewer's seat as the camera sees the table (0: in front, 90: the viewer's left, 180: straight across), for a table of three to six players (two sit across). It is also how far from the viewer
   * the first and the last opponent keep: the viewer's own line needs the room, and the more players the less each of them needs. The other opponents are spread evenly between the first and the last. At four and five players the side seats stand about at the sides,
   * a little toward the viewer, not on the line across the table: there they would lie under the log of the turns that the platform draws at the top left of the window.
   */
  first3: 154,
  first4: 80,
  first5: 86,
  first6: 80,
  /** How far toward the viewer the foot of their own line lies (their hand is held on the screen, so it is where the hand would be) */
  viewerZ: 4.2,
  /**
   * The size of every card on the table, a share of the card of the kit, for a table of two and for a table of six: the deck, the cards set aside, the cards of the columns, those of the play areas and in front of the players, and the hands that the opponents hold
   * are all of one size, as at a real table. A small table has bigger cards and room, a full one smaller ones (in steps in between). The viewer's hand, held on the screen, and the faces that are shown to be read (a Priest's look, a Baron's comparison, a King's trade) are not on the table and have sizes of their own
   */
  cardScale2: 0.55,
  cardScale6: 0.45,
  /** The width an opponent's play area may spread over, for a table of two and for a table of six, and the viewer's */
  areaWidth2: 2.6,
  areaWidth6: 2.0,
  viewerAreaWidth: 2.6,
  /** The clear space between the play area and the hand of a line, in world units. The plate stands `plateGap` of the kit beyond the two */
  blockGap: 0.12,
  /** The widest a gap between two cards of a play area may be, as a share of the width of a card, and the closest two may come: the medallion with the value is the left third of a face, so a card lies about a third over the one before it at the most */
  gap: 1.06,
  closest: 0.34,
  /** The room round a player's cards and plate that a press counts in, in world units */
  hotspotPadding: 0.02,
  /**
   * The deck on the left of the middle, with the columns of the cards that are done with to its right (`MIDDLE`), the first cards of the columns lying as high as the deck, and the cards set aside at the start of a round in one column on its left (`MIDDLE.aside`): where
   * the deck lies, along x for a table of two and for a table of six (in steps in between) and along z. A table of two is nearer the middle: the cards set aside, which stand beyond the deck, would lie under the log of the turns that the platform draws at the top left of the
   * window, and the camera would have to stand back. At a full table the seats at the sides of the middle leave the deck less room: it stands where the cards set aside clear them.
   */
  deckX2: -2.3,
  deckX6: -3.05,
  deckZ: -0.85,
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
  cardScale2: ["card scale · 2 players", 0.3, 1.4, 0.01],
  cardScale6: ["card scale · 6 players", 0.3, 1.2, 0.01],
  areaWidth2: ["opponent area width · 2", 1, 12, 0.1],
  areaWidth6: ["opponent area width · 6", 1, 12, 0.1],
  viewerAreaWidth: ["viewer area width", 2, 20, 0.1],
  blockGap: ["gap between area and hand", 0, 1, 0.01],
  gap: ["gap (cards)", 0.8, 1.4, 0.01],
  closest: ["closest (cards)", 0.05, 0.6, 0.01],
  hotspotPadding: ["press room round a player", 0, 1, 0.01],
  deckX2: ["deck x · 2 players", -8, 0, 0.05],
  deckX6: ["deck x · 6 players", -8, 0, 0.05],
  deckZ: ["deck z", -4, 4, 0.05],
}

/** The chairs of a table: its players, and one more for a spectator, who has none in front (the ring of `seats` is that of the table with one more player) */
export const chairsOf = (players: number, seated = true) => (seated ? players : players + 1)

/** The chairs of the fullest table, for what is laid out for a table whose size is not said: the narrowest room, the one that keeps clear of the seats at the sides of the middle, and the smallest cards */
const FULL_TABLE = 6

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

/** The size of every card that lies on a table of `chairs` chairs: the same for the deck, the cards set aside, the cards of the columns and those of the play areas, smaller as the table fills */
export const cardScaleOf = (chairs: number) => between(chairs, LAYOUT_SETTINGS.cardScale2, LAYOUT_SETTINGS.cardScale6)

/** The play area of a seat of a table of `chairs` chairs: the viewer's, or an opponent's, which is narrower as the table fills. Its cards are the size of every card of the table */
export function areaOf(chairs: number, viewer: boolean): Area {
  const R = LAYOUT_SETTINGS
  const scale = cardScaleOf(chairs)
  if (viewer) return { scale, width: R.viewerAreaWidth }
  return { scale, width: between(chairs, R.areaWidth2, R.areaWidth6) }
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

/**
 * The settings of the hands that are held at a table of `chairs` chairs: the kit's, which its debug folder still tunes, with the size of every card of the table in place of its own, and the reach of the shadow under the hand following the size of the cards
 */
const heldSettings = (chairs: number): typeof HELD_FAN_SETTINGS =>
  new Proxy(HELD_FAN_SETTINGS, {
    get: (target, key) => {
      const value = target[key as keyof typeof HELD_FAN_SETTINGS]
      if (key === "scale") return cardScaleOf(chairs)
      return key === "shadowBase" || key === "shadowPerCard" ? value * (cardScaleOf(chairs) / target.scale) : value
    },
  })

/** The slots of the cards another player holds at a table of `chairs` chairs, a small fan of backs that stands, in the frame of their seat: `heldFan` of the kit, the cards the size of every card of the table. The small round shadow under them is `heldShadowOf` */
export function heldLayout(n: number, seat: SeatSpot, chairs = FULL_TABLE): Pose[] {
  return heldFan(n, seat.yaw, CARD, heldSettings(chairs))
}

/** The small round shadow under an opponent's hand at a table of `chairs` chairs: how far it reaches for `n` cards, and how dark it is */
export const heldShadowOf = (chairs = FULL_TABLE) => heldShadow(heldSettings(chairs))

/** Where a card played from an opponent's hand of `count` flies from: the left end of the fan, as the viewer sees it (`heldLeftPose`), the hand still the size it was */
export function heldFrom(seat: SeatSpot, count: number, chairs = FULL_TABLE): Pose {
  return heldLeftPose(seat, (n) => heldLayout(n, seat, chairs), count)
}

/**
 * The viewer's hand, held at the bottom left of the screen as Courtisans holds its own (`ScreenHand`): the kit's numbers, but for the room it may take, which stops short of the viewer's play area in front of the middle of the table, so that a hand of three cards (a
 * Chancellor's) packs its cards closer instead of covering what the player laid down
 */
export const HAND_SETTINGS = { ...SCREEN_HAND_SETTINGS, room: 0.28 }

/** The slots of a hand laid face up once a round that ended on a comparison has revealed it, in the frame of its seat: a row of faces where the hand stood, the size of the cards of the table */
export function revealedPoses(n: number, line: Line): Pose[] {
  const scale = line.area.scale
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
  const hand = viewer ? VIEWER_HAND : onAxis(joinBoxes(Array.from({ length: HAND_MAX }, (_, i) => frameBoxOfPoses(heldLayout(i + 1, seat, chairs), CARD, seat, { tilt: VIEW_TILT })))!)
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

/** Where the deck lies at a table of `chairs` chairs */
export function middlePlaces(chairs = FULL_TABLE): { deck: Place } {
  const R = LAYOUT_SETTINGS
  return { deck: { x: between(chairs, R.deckX2, R.deckX6), z: R.deckZ } }
}

/** How many cards are set aside face up, at a table of two players: the card set aside face down is on every table */
export const ASIDE_FACE_UP = 3

/**
 * The middle of the table. The deck is on the left, and the cards of the round that are done with (`tableCards` of `middle.ts`) lie in columns, one for each value that has a card, from the lowest value on the left to the highest on the right, as on a table of cards: the copies of a
 * value cascade down their column, each lower than the one before so that the banner and the value of every card stay in sight, the last one played lying whole at the foot. The columns close up and stay centred as one comes and another goes, and the cards are as big as the room lets
 * them be. The faces of a reveal show for the time it takes to read them over the columns (a Priest's look, a Baron's comparison, a King's trade); below them lies the Deal button, for the player who deals. On the left of the deck lie the cards that were set aside when the round was dealt, in
 * one column: the one face down, as high as the deck, and under it, at two players, the three face up. The characters a Guard can name are not laid on the table, where a row of them would read as a copy of the cards that lie there: a window offers them. It all lies well above the bottom band of
 * the window that the banner of the cookie settings covers, and clear of the plates, the areas and the hands of every table: `layout.test.ts` and `camera.test.ts` hold both. The table writes no sentence: what to do is said by the ticker.
 */
export const MIDDLE = {
  /**
   * The cards set aside, in one column on the left of the deck: the gap between the deck and the column (a share of a card's width), the clear space between the card face down and the first one face up (a share of a card's height), and how far each card face up lies below the one
   * before it (a share of a card's height), which is as far as the copies of a column of the cards that are done with: the banner and the value of each stay in sight
   */
  aside: { gap: 0.2, apart: 0.12, step: 0.25 },
  /**
   * The columns: the gap between the deck and the room of the columns, how far to the right the room reaches (x of its right edge: `right` where seats stand at the sides of the middle, `wideRight` at a table of `wideChairs` chairs or fewer, which has none), how far down the tallest column may
   * reach (z of its foot), the gap between two columns (a share of a card's width), and how far each copy lies below the one before (a share of a card's height), as most and as least. The cards are the size of every card of the table (`cardScaleOf`) and the first of each column lies as high as
   * the deck. The columns lie a card's width and a gap apart while the room allows it, and close up when they are many; the copies lie `stepMax` apart, and closer when a column is tall; the block of columns stays centred on the table as far as its room allows
   */
  columns: { left: 0.25, right: 3.9, wideRight: 5.4, wideChairs: 3, bottom: 0.5, gap: 0.2, stepMin: 0.12, stepMax: 0.25 },
  /** The Deal button, centred, below the columns */
  deal: { z: 1.05, width: 2.8, depth: 0.8 },
  /** The faces of a reveal: one in the middle, two a little more than a card apart, how high they lie and how big they are. They lie over the columns, which they hide for the time it takes to read them */
  reveal: { z: -0.4, y: 0.2, scale: 0.9, apart: 1.9 },
}

/** A thing lying on the table: where it lies and how big it is, in world units, along x and z */
export type Pad = { x: number; z: number; width: number; depth: number }

/** The place of the Deal button */
export const dealPlace = (): Pad => ({ x: 0, ...MIDDLE.deal })

/** Where the faces of a reveal of `count` cards lie, in the frame of the table, side by side */
export const revealPoses = (count: number): Pose[] => Array.from({ length: count }, (_, i) => onTable((i - (count - 1) / 2) * MIDDLE.reveal.apart, MIDDLE.reveal.z, { y: MIDDLE.reveal.y, scale: MIDDLE.reveal.scale }))

/** Where the room of the columns starts and how far it reaches along x: right of the deck, and as far as `MIDDLE.columns` says for a table of `chairs` chairs: farther where no seat stands at the sides of the middle */
function columnsRoom(chairs = FULL_TABLE) {
  const left = middlePlaces(chairs).deck.x + (CARD.width * cardScaleOf(chairs)) / 2 + MIDDLE.columns.left
  return { left, right: chairs <= MIDDLE.columns.wideChairs ? MIDDLE.columns.wideRight : MIDDLE.columns.right }
}

/** Where the first card of every column lies, as high as the deck: z of the top edge of a card of a table of `chairs` chairs standing on the line of the deck */
const columnsTop = (chairs = FULL_TABLE) => LAYOUT_SETTINGS.deckZ - (CARD.height * cardScaleOf(chairs)) / 2

/**
 * How the columns are laid, and where the block of them starts. `counts` is the number of cards in each column, from the lowest value to the highest, so that its length is the number of columns and its greatest the height of the tallest. The cards are the size of every card of the table, whatever
 * the round. The columns are a card's width and a gap apart while the room allows it and close up, down to touching, as they grow in number; the copies of a column lie `stepMax` of a card's height apart, and closer, down to `stepMin`, as the tallest column needs the room. The block is centred on
 * the table (x of 0) as far as its room allows: past that it keeps to the deck's side.
 */
export function columnSizes(counts: readonly number[], chairs = FULL_TABLE): { scale: number; pitch: number; step: number; start: number } {
  const { gap, stepMin, stepMax } = MIDDLE.columns
  const { left, right } = columnsRoom(chairs)
  const scale = cardScaleOf(chairs)
  const width = CARD.width * scale
  const height = CARD.height * scale
  const columns = Math.max(counts.length, 1)
  const tallest = Math.max(...counts, 1)
  const pitch = columns > 1 ? Math.max(width, Math.min(width * (1 + gap), (right - left - width) / (columns - 1))) : width * (1 + gap)
  const step = tallest > 1 ? Math.min(stepMax, Math.max(stepMin, (columnsBox(chairs).maxZ - columnsTop(chairs)) / height / (tallest - 1) - 1 / (tallest - 1))) : stepMax
  const block = width + (columns - 1) * pitch
  return { scale, pitch, step, start: Math.max(left, Math.min(-block / 2, right - block)) }
}

/**
 * The slots of the cards that are done with, column by column from the lowest value to the highest, the cards of a column one after the other: `counts` is the number of cards in each column (`columnCounts` of `middle.ts`). The first card of each column lies at the top, as high as the
 * deck, each copy below the one before it by a share of its height, and a hair higher, so that it lies over the one above and the last one played is whole at the foot of its column.
 */
export function columnPoses(counts: readonly number[], chairs = FULL_TABLE): Pose[] {
  const { scale, pitch, step, start } = columnSizes(counts, chairs)
  const width = CARD.width * scale
  const height = CARD.height * scale
  const top = columnsTop(chairs)
  const poses: Pose[] = []
  counts.forEach((count, column) => {
    for (let copy = 0; copy < count; copy++) poses.push(shifted(onTable(start + width / 2 + column * pitch, top + height / 2 + copy * step * height, { scale }), { y: poses.length * 0.012 }))
  })
  return poses
}

/** The box of the columns at their fullest: as wide as their room, as deep as the tallest column may be, from the top of the deck to `bottom` */
export function columnsBox(chairs = FULL_TABLE): TableBox {
  const { left, right } = columnsRoom(chairs)
  return { minX: left, maxX: right, minZ: columnsTop(chairs), maxZ: MIDDLE.columns.bottom }
}

/** The box of the Deal button and of the faces of a reveal (two at the most): each lies where `MIDDLE` says, one at a time, and the room is kept for both */
export function controlBoxes(): { deal: TableBox; reveal: TableBox } {
  const faceWidth = CARD.width * MIDDLE.reveal.scale
  return {
    deal: boxOfRect(dealPlace()),
    reveal: boxOfRect({ x: 0, z: MIDDLE.reveal.z, width: MIDDLE.reveal.apart + faceWidth, depth: CARD.height * MIDDLE.reveal.scale }),
  }
}

/** Where the column of the cards set aside lies at a table of `chairs` chairs: x of its axis, a card's width and a gap to the left of the deck, and z of the top edge of its first card, as high as the deck */
function asideSpot(chairs = FULL_TABLE): { x: number; top: number } {
  const width = CARD.width * cardScaleOf(chairs)
  return { x: middlePlaces(chairs).deck.x - width * (1 + MIDDLE.aside.gap), top: columnsTop(chairs) }
}

/**
 * The slots of the cards set aside when a round is dealt, in one column on the left of the deck, the size of every card of the table: the one face down (`down`), whole and as high as the deck, and under it the cards face up (`up`, `faceUp` of them, three at two players), the
 * first a little way below it and each of the others below the one before, a share of its height, and a hair higher, so that the banner and the value of each stay in sight and the last is whole at the foot. The slots of the cards face up do not move when the card face down is
 * gone (a Prince takes it when the deck is empty).
 */
export function asidePoses(faceUp: number, chairs = FULL_TABLE): { down: Pose; up: Pose[] } {
  const { apart, step } = MIDDLE.aside
  const scale = cardScaleOf(chairs)
  const height = CARD.height * scale
  const { x, top } = asideSpot(chairs)
  const down = onTable(x, top + height / 2, { face: "down", scale })
  const up = Array.from({ length: faceUp }, (_, i) => shifted(onTable(x, top + height * (1.5 + apart + i * step), { scale }), { y: i * 0.012 }))
  return { down, up }
}

/** The box of the column of the cards set aside, at a table of `chairs` chairs: one card tall, or all of it with the cards face up (`faceUp` of them) */
export function asideBox(faceUp: number, chairs = FULL_TABLE): TableBox {
  const width = CARD.width * cardScaleOf(chairs)
  const height = CARD.height * cardScaleOf(chairs)
  const { x, top } = asideSpot(chairs)
  const foot = faceUp > 0 ? top + height * (2 + MIDDLE.aside.apart + (faceUp - 1) * MIDDLE.aside.step) : top + height
  return { minX: x - width / 2, maxX: x + width / 2, minZ: top, maxZ: foot }
}

/** The boxes of the middle of the table, in the world: the deck with its count under it, the column of the cards set aside (with the three face up at two players), the columns of the cards that are done with, and the room of the Deal button */
export function middleBoxes(faceUp: boolean, chairs = FULL_TABLE): TableBox[] {
  const { deck } = middlePlaces(chairs)
  const width = CARD.width * cardScaleOf(chairs)
  const depth = CARD.height * cardScaleOf(chairs)
  return [boxOfRect({ x: deck.x, z: deck.z + 0.4, width, depth: depth + 0.8 }), asideBox(faceUp ? ASIDE_FACE_UP : 0, chairs), columnsBox(chairs), controlBoxes().deal]
}

/** The corners on the table of a box drawn in the frame of a seat, going round: what the camera has to bring into the window, and what the tests lay over one another */
export const quadOf = (box: TableBox, seat: Spot): Place[] => cornersOfBox(box, seat)

/** The corners of a box of the world (a seat's frame at the origin, unturned) */
const worldQuad = (box: TableBox): Place[] => cornersOfBox(box, { x: 0, z: 0, yaw: 0 })

/**
 * The mirror image of every corner of the shapes of the table, one point each: a point has no area, so the platform's boxes never count it as covered, and the table then reaches as far to the left as to the right, as seen from where the camera stands, so that the camera stands
 * across it. The favor tokens hang off the right of a plate, which is toward the viewer on one side of the table and away from them on the other, so the plates alone are never quite the same on both sides, and a shape that is drawn only on one side (the columns of the cards that are
 * done with, the deck) has no twin on the other.
 */
function mirrorPoints(shapes: readonly (readonly Place[])[]): Place[][] {
  return shapes.flatMap((quad) => quad.map(({ x, z }) => [{ x: -x, z }]))
}

/**
 * What the camera centres the window on (`fitCamera`): the plate and the play area of every seat, at their nominal sizes, the middle of the table, and the mirror image of the corners of all of it (`mirrorPoints`). An opponent's hand is left out: it is in the area of its seat
 * (`reachQuads`), the camera keeps it in the window, and it is too small a thing for the platform's boxes to be measured on. The mirror image makes the table as wide on one side of the middle line as on the other, so that the scene stays in the middle of the window, and across it,
 * whatever lies in either half of it (the deck on one side, the columns of the cards that are done with as far as their room goes on the other), and no shape is drawn where nothing is, which the platform's boxes would then be measured against. A longer row of
 * cards spreads only as far as its play area, which is always the room of the biggest.
 */
export function seenQuads(n: number, seated = true): Place[][] {
  const shapes = [...tableLines(n, seated).flatMap((line) => [line.plateBox, line.play].map((box) => quadOf(box, line.seat))), ...middleBoxes(n === 2, chairsOf(n, seated)).map(worldQuad)]
  return [...shapes, ...mirrorPoints(shapes)]
}

/**
 * What the camera has to have in the window too, without it weighing on the centre: the areas that the viewer presses to choose a player, which reach a little past the plates, and must never lie under a box of the platform, and the hands of the opponents where the camera
 * sees them, which is higher than they lie (`HAND_RISE`)
 */
export const reachQuads = (n: number, seated = true): Place[][] =>
  tableLines(n, seated).flatMap((line) => {
    const press = quadOf(padBox(line.press, [REACH_MARGIN, REACH_MARGIN, REACH_MARGIN, REACH_MARGIN]), line.seat)
    return line.viewer ? [press] : [press, quadOf(line.hand, line.seat).map(({ x, z }) => ({ x, z: z - HAND_RISE }))]
  })

/** How far past the area of a seat the camera keeps the window, in world units: the viewer's finger has no aim to lose */
const REACH_MARGIN = 0.1

/**
 * How much higher up the window than its flat model the camera sees the top of a hand, in world units: the cards of a hand stand, and a camera that looks down on them from near sees their tops nearer to it, so farther from the middle of the window, than the model of
 * the fit (`frameBoxOfPoses`, which only slants them) puts them. The nearer the camera, the more: at the nearest it stands for a window as wide as the screens go, a hand is seen about one unit higher. A hand that is picked (the player a Guard names, a Priest looks at) lifts by a quarter of
 * a card's height and grows a tenth, which takes about two thirds of a unit more
 */
const HAND_RISE = 1.7

/** Where the cards are dealt from: above the deck, face down */
export function dealtFrom(chairs = FULL_TABLE): Pose {
  const { deck } = middlePlaces(chairs)
  return onTable(deck.x, deck.z, { y: 1.6, face: "down", scale: cardScaleOf(chairs) })
}
