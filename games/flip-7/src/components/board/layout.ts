import { type Field, onTable, type Pose, plateOf, row, SEAT_SETTINGS, seats as ringOf, type Spot } from "@pbgo/table"

/** A seat at the table: where it stands and the yaw that sends what lies there away from the middle */
export type SeatSpot = Required<Spot>

/** A place on the table, in world units: x to the right, z toward the viewer */
export type Place = { x: number; z: number }

/**
 * The knobs of the layout, edited by the Layout folder of the debug panel (`scene.tsx` binds them with `useSettings`). Every card of Flip 7 lies face up in front of its player, and every line reads upright from the viewer's side, whatever
 * the seat: the cards do not take the yaw of their seat.
 */
export const LAYOUT_SETTINGS = {
  /** The ring the seats stand on (the plates stand out from it) and the size of the cards of the opponents, for a table of three and for a table of eight: a small table sits close and its cards are big, a full one spreads wide. How far the camera stands is not a knob: it
   * is fitted to the window (`fitCamera`) */
  radiusX3: 5.4,
  radiusX8: 5,
  radiusZ3: 3.8,
  radiusZ8: 6.4,
  /** The angle kept free at each end of the far half of the ring: the opponents of a small table sit across from the viewer, not beside them */
  margin3: 1.05,
  margin8: 0.5,
  opponentScale3: 0.95,
  opponentScale8: 0.62,
  /** The viewer's line: how far toward them it lies, how big its cards are and how wide it may spread */
  viewerZ: 3.1,
  viewerScale: 1,
  viewerWidth: 13,
  /** An opponent's line lies this share of the way from the middle of the table to their seat */
  reach: 0.72,
  /** The widest a gap between two cards of a line may be, as a share of the width of a card: a line that does not fit its room draws its cards closer, over one another */
  gap: 1.06,
  /** The closest two cards of a line may come, as a share of the width of a card, so that the figure of each stays readable */
  closest: 0.22,
  /** The cards set aside (a Freeze or a Flip Three flipped during a Flip Three) lie this far beyond the line, in cards */
  heldDrop: 1.05,
  heldScale: 0.5,
  /** The draw pile and the discard, either side of the middle */
  pilesX: 1.6,
  pilesZ: 0.5,
  pileScale: 0.9,
  /** The viewer's one button, Stay on a turn and Deal between two rounds, lies beside the discard, this far from it: in the middle band of the table, which the cookie banner never covers and no line or plate reaches */
  buttonDX: 3.1,
}

export const LAYOUT_FIELDS: Record<keyof typeof LAYOUT_SETTINGS, Field> = {
  radiusX3: ["ring radius x · 3 players", 3, 12, 0.1],
  radiusX8: ["ring radius x · 8 players", 5, 14, 0.1],
  radiusZ3: ["ring radius z · 3 players", 2, 8, 0.1],
  radiusZ8: ["ring radius z · 8 players", 3, 10, 0.1],
  margin3: ["ring margin · 3 players", 0, 1.4, 0.01],
  margin8: ["ring margin · 8 players", 0, 1.4, 0.01],
  opponentScale3: ["opponent card scale · 3", 0.3, 1.4, 0.01],
  opponentScale8: ["opponent card scale · 8", 0.3, 1.2, 0.01],
  viewerZ: ["viewer line z", 0, 8, 0.05],
  viewerScale: ["viewer card scale", 0.4, 1.6, 0.01],
  viewerWidth: ["viewer line width", 4, 20, 0.1],
  reach: ["opponent line reach", 0.2, 1, 0.01],
  gap: ["gap (cards)", 0.8, 1.4, 0.01],
  closest: ["closest (cards)", 0.05, 0.6, 0.01],
  heldDrop: ["set aside drop (cards)", 0.5, 2, 0.01],
  heldScale: ["set aside scale", 0.3, 1, 0.01],
  pilesX: ["piles x", 0.5, 5, 0.05],
  pilesZ: ["piles z", -3, 3, 0.05],
  pileScale: ["pile scale", 0.4, 1.4, 0.01],
  buttonDX: ["button x from the discard", 1.5, 6, 0.05],
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
    margin: between(R.margin3, R.margin8),
    opponentScale: between(R.opponentScale3, R.opponentScale8),
  }
}

/** The seat of each player: the viewer in front, the others around the far half in turn order */
export function seatSpots(ids: readonly string[], meId: string | null): Map<string, SeatSpot> {
  const { radiusX, radiusZ, margin } = tableOf(ids.length)
  const viewer = ids.indexOf(meId ?? "")
  const ring = ringOf(ids.length, { radiusX, radiusZ, margin, me: viewer < 0 ? null : viewer })
  return new Map(ids.map((id, i): [string, SeatSpot] => [id, ring[i]!]))
}

/** What a player's line is laid out in: where it lies, how big its cards are, and the width it may take before its cards overlap */
export type Line = { at: Place; scale: number; width: number }

/**
 * The line of every player, by id. The viewer's lies in front of them, as wide as the table; an opponent's lies between their seat and the middle, and may take the room that their neighbours leave it (the nearest anchor on the
 * far half, either side), so that two lines never run into each other.
 */
export function lines(spots: ReadonlyMap<string, SeatSpot>, meId: string | null): Map<string, Line> {
  const R = LAYOUT_SETTINGS
  const scale = tableOf(spots.size).opponentScale
  const out = new Map<string, Line>()
  const opponents = [...spots].filter(([id]) => id !== meId).map(([id, spot]) => ({ id, at: { x: spot.x * R.reach, z: spot.z * R.reach } }))
  const byX = [...opponents].sort((a, b) => a.at.x - b.at.x)
  byX.forEach((opponent, i) => {
    const left = byX[i - 1]
    const right = byX[i + 1]
    const room = Math.min(left ? opponent.at.x - left.at.x : Infinity, right ? right.at.x - opponent.at.x : Infinity)
    // the only one on the far half has all the table; the others share it with their neighbours
    out.set(opponent.id, { at: opponent.at, scale, width: Number.isFinite(room) ? room : R.viewerWidth })
  })
  if (meId && spots.has(meId)) out.set(meId, { at: { x: 0, z: R.viewerZ }, scale: R.viewerScale, width: R.viewerWidth })
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

/** The cards set aside during a Flip Three: a small row beyond the line, on the side of the middle of the table for an opponent and toward the viewer for the viewer. */
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

/** Where the viewer's one button lies, Stay on a turn and Deal between two rounds: beside the discard, away from the draw pile that is pressed to hit. */
export function buttonPlace(): Place {
  const { discard } = pilePlaces()
  return { x: discard.x + LAYOUT_SETTINGS.buttonDX, z: discard.z }
}

/** The width of the paper of a button, in world units */
export const BUTTON_WIDTH = 2.6

/** A rectangle on the table, in world units: x to the right, z toward the viewer */
export type Footprint = { x0: number; x1: number; z0: number; z1: number }

/**
 * Where things stand on a table of `n` players, as rectangles: the plate of each seat, a line of three cards for an opponent and of four for the viewer, the piles with their count and their hint, and the button. What the camera has to bring
 * into the window, and to keep clear of what the platform draws over it (`fitCamera`). Nominal sizes: a longer line spreads, and may reach farther.
 */
export function tableFootprints(n: number): Footprint[] {
  const R = LAYOUT_SETTINGS
  const ids = Array.from({ length: n }, (_, i) => String(i))
  const spots = seatSpots(ids, "0")
  const placed = lines(spots, "0")
  const out: Footprint[] = []
  for (const [id, spot] of spots) {
    const viewer = id === "0"
    const plate = plateOf(spot, viewer)
    // the aura is as wide as the plate; the name stands above the plate's centre and the status below the score
    out.push({ x0: plate.x - SEAT_SETTINGS.auraWidth / 2, x1: plate.x + SEAT_SETTINGS.auraWidth / 2, z0: plate.nameZ - 0.45, z1: plate.statusZ + 0.3 })
    const line = placed.get(id)!
    const width = CARD.width * line.scale * (1 + (viewer ? 3 : 2) * R.gap)
    const depth = CARD.height * line.scale
    out.push({ x0: line.at.x - width / 2, x1: line.at.x + width / 2, z0: line.at.z - depth / 2, z1: line.at.z + depth / 2 })
  }
  const { deck, discard } = pilePlaces()
  const pile = (CARD.height * R.pileScale) / 2
  // the hint above the draw pile and its count below it
  out.push({ x0: deck.x - 0.6 - (CARD.width * R.pileScale) / 2, x1: discard.x + 0.6 + (CARD.width * R.pileScale) / 2, z0: deck.z - pile - 0.9, z1: deck.z + pile + 1.0 })
  const button = buttonPlace()
  out.push({ x0: button.x - BUTTON_WIDTH / 2, x1: button.x + BUTTON_WIDTH / 2, z0: button.z - 0.5, z1: button.z + 0.5 })
  return out
}

/** Where the cards are dealt from: above the draw pile, face down. */
export function dealtFrom(): Pose {
  const { deck } = pilePlaces()
  return onTable(deck.x, deck.z, { y: 1.6, face: "down", scale: LAYOUT_SETTINGS.pileScale })
}
