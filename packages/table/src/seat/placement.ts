import type { TableBox } from "../box"
import type { Spot } from "../layout"

/**
 * How a seat's plate (the avatar, with the name beside it and the info line under the name) stands: out from the spot the ring gives it, or above the cards of the player. Every number is in world units but the factors of `reach` and the opacity. A plain object that a
 * debug panel edits: the next render of a `Seat` follows it.
 */
export const SEAT_SETTINGS = {
  /** A plate placed from its spot (`plateOf`) stands at the spot times these factors for an opponent: just beyond the cards, out of the ring. A plate that stands on the middle's side of the cards of its player (`above`) does not read them */
  reachX: 1.32,
  reachZ: 1.32,
  /** The same for the viewer's own plate: level with the spot, a little in front of it */
  viewerReachX: 1,
  viewerReachZ: 1.18,
  /** The height of the name's lettering, and how far toward the middle of the table it stands from the plate's middle, the middle of the avatar */
  nameHeight: 0.43,
  nameLift: 0.18,
  /** The height of the info line's lettering (the score, then the status), and how far toward the cards it stands from the plate's middle */
  lineHeight: 0.3,
  lineDrop: 0.22,
  /** The widest a name, or an info line, may be: a longer one (twelve wide capitals) shrinks to this width, with its proportions, instead of reaching the plate of the next seat. Twelve letters of the platform's font are about six times the height of the lettering wide, so a name that is not wide is never touched */
  nameRoom: 3.8,
  /** The avatar's diameter and its gap to the lettering beside it */
  avatarSize: 0.62,
  avatarGap: 0.16,
  /** The crown's size, and how far its foot stands beyond the edge of the avatar that is farthest from the camera: the crown stands centred above the avatar on the screen, whichever way the seat and the camera are turned */
  crownSize: 0.52,
  crownGap: 0.02,
  /** The clear space between the edge of a player's cards that faces the middle and the foot of their plate, the bottom of its info line: how far beyond the cards the plate stands */
  plateGap: 0.25,
  /** How opaque the plate of a player who is away stays */
  awayOpacity: 0.4,
}
export type SeatSettings = typeof SEAT_SETTINGS

/**
 * The settings of a plate made `factor` times the size, for a board whose plates shrink at a bigger table: every size and every gap is multiplied, the reach factors and the opacity are not. A plate is drawn with them (`settings` of `Seat`) and a layout
 * works its boxes out with the same (`plateAbove`, `plateBoxOf` and `plateWidth` take them), so that the two agree. `SEAT_SETTINGS` is a plain object the debug panel edits: this is a copy of it as it is when it is called.
 */
export function scaledSeat(factor: number, base: SeatSettings = SEAT_SETTINGS): SeatSettings {
  const S = base
  return {
    ...S,
    nameHeight: S.nameHeight * factor,
    nameLift: S.nameLift * factor,
    lineHeight: S.lineHeight * factor,
    lineDrop: S.lineDrop * factor,
    nameRoom: S.nameRoom * factor,
    avatarSize: S.avatarSize * factor,
    avatarGap: S.avatarGap * factor,
    crownSize: S.crownSize * factor,
    crownGap: S.crownGap * factor,
    plateGap: S.plateGap * factor,
  }
}

/** A knob of a debug panel: its label, its least, its greatest and its step */
type Knob = [label: string, min: number, max: number, step: number]

/** The knobs a debug panel can offer for `SEAT_SETTINGS`, one for each of its fields */
export const SEAT_FIELDS = {
  reachX: ["plate reach x (from the spot)", 1, 2, 0.01],
  reachZ: ["plate reach z (from the spot)", 1, 2, 0.01],
  viewerReachX: ["viewer plate reach x (from the spot)", 0.5, 2, 0.01],
  viewerReachZ: ["viewer plate reach z (from the spot)", 0.5, 2, 0.01],
  nameHeight: ["name size", 0.2, 1.2, 0.01],
  nameLift: ["name lift (from the middle of the avatar)", 0, 1, 0.01],
  lineHeight: ["info line size", 0.2, 1, 0.01],
  lineDrop: ["info line drop (from the middle of the avatar)", 0, 1, 0.01],
  nameRoom: ["name room (a longer name shrinks)", 1, 8, 0.1],
  avatarSize: ["avatar size", 0.2, 1.2, 0.01],
  avatarGap: ["avatar gap", 0, 0.6, 0.01],
  crownSize: ["crown size", 0.2, 1.4, 0.01],
  crownGap: ["crown gap above the avatar", -0.4, 0.6, 0.01],
  plateGap: ["plate gap beyond the cards", 0, 1.5, 0.01],
  awayOpacity: ["away or out opacity", 0, 1, 0.01],
} satisfies Record<keyof SeatSettings, Knob>

/**
 * Where a plate stands, in world units: its centre `x`, and its middle `z`, which is where the avatar's centre lies. The name stands `nameLift` toward the middle of the table from it and the info line `lineDrop` toward the cards, so that the two lines of lettering stand
 * side by side with the avatar, which is as tall as they are together. What depends on the width of the lettering, where the avatar and the text stand along x, is `plateRow`'s.
 */
export type Plate = {
  x: number
  z: number
  /** The z of the name's lettering and of the info line under it, when both are written */
  nameZ: number
  lineZ: number
}

/** How far the plate reaches from its middle toward the middle of the table, and toward the cards: the lettering's box or the avatar's, whichever goes farther. The top of the plate and its foot */
const topOf = (S: SeatSettings) => Math.max(S.nameLift + S.nameHeight / 2, S.avatarSize / 2)
const footOf = (S: SeatSettings) => Math.max(S.lineDrop + S.lineHeight / 2, S.avatarSize / 2)

/** The plate whose centre stands at (`x`, `z`) */
function plateAround(x: number, z: number, S: SeatSettings): Plate {
  return { x, z, nameZ: z - S.nameLift, lineZ: z + S.lineDrop }
}

/** The plate of the seat at `spot`, out of the ring; `viewer` is the viewer's own seat. A plate that stands above its player's cards is `plateAbove` */
export function plateOf(spot: Spot, viewer: boolean, settings: SeatSettings = SEAT_SETTINGS): Plate {
  const S = settings
  return plateAround(spot.x * (viewer ? S.viewerReachX : S.reachX), spot.z * (viewer ? S.viewerReachZ : S.reachZ), S)
}

/**
 * The plate that stands on the middle's side of `cards`, the box of all of a player's cards (their hand, their grid, their play area) in the frame of their seat: centred on it, the foot of the plate (the bottom of its info line) `plateGap` beyond its edge of the least z.
 * The frame of a seat has its top, its least z, toward the middle of the table (`seats`), so the plate is above the cards for the player who sits there, at the viewer's seat and at every other, and it is drawn in the same frame, turned with the seat.
 */
export function plateAbove(cards: TableBox, settings: SeatSettings = SEAT_SETTINGS): Plate {
  const S = settings
  return plateAround((cards.minX + cards.maxX) / 2, cards.minZ - S.plateGap - footOf(S), S)
}

/** How many letters of a name a plate is taken to hold when a layout leaves room for it; a name is cut to 12 and a crowded table has no room for that, so a longer one sticks out of the room rather than into its neighbour's */
export const PLATE_LETTERS = 6

/** How wide a plate is taken to be: the avatar and, beside it, a name of `PLATE_LETTERS` letters (about half the lettering's height each). What a layout leaves for it; the real width depends on the name and on the info line */
export const plateWidth = (settings: SeatSettings = SEAT_SETTINGS) => settings.avatarGap + settings.avatarSize + PLATE_LETTERS * 0.5 * settings.nameHeight

/** What a plate covers of the table: its width, from the top of the name or the avatar to the foot of the info line or the avatar. The crown stands up from the table and is not in it */
export function plateBoxOf(plate: Plate, settings: SeatSettings = SEAT_SETTINGS, width: number = plateWidth(settings)): TableBox {
  const S = settings
  return { minX: plate.x - width / 2, maxX: plate.x + width / 2, minZ: plate.z - topOf(S), maxZ: plate.z + footOf(S) }
}

/** How wide the lettering of a plate is, in world units: the name, and the info line under it, or `null` when there is none (a plate with nothing to say under the name) */
export type PlateText = { name: number; info: number | null }

/** Where the pieces of a plate stand, in the frame of the seat, once the width of its lettering is known */
export type PlateRow = {
  /** The left edge of the avatar and the right edge of the column of lettering: the block that is centred on the plate */
  minX: number
  maxX: number
  /** The avatar's centre along x; along z it stands at the plate's middle */
  avatarX: number
  /** The left edge of the column of lettering: the name and the info line both start here, left-aligned, as text is read */
  textX: number
  /** The right edge of the column, the wider of the two lines: what stands after the plate (`trailing`) starts here, at the middle of the plate along z */
  endX: number
  /** The z of the name's lettering: above the info line when there is one, level with the avatar's centre when the name stands alone */
  nameZ: number
}

/**
 * Where the avatar and the lettering of a plate stand along x, for lettering of the widths `text`: the avatar at the left, then the column of lettering, the name over the info line, both left-aligned, and the whole block, from the avatar's left edge to the column's right
 * edge, centred on the plate. The avatar is always before the text, as the plate is read in the frame of its seat, and stands level with the middle of the lettering: the middle of the two lines, or the name's own when there is no info line under it.
 */
export function plateRow(plate: Plate, text: PlateText, settings: SeatSettings = SEAT_SETTINGS): PlateRow {
  const S = settings
  const column = Math.max(text.name, text.info ?? 0)
  const block = S.avatarSize + S.avatarGap + column
  const minX = plate.x - block / 2
  const textX = minX + S.avatarSize + S.avatarGap
  return { minX, maxX: minX + block, avatarX: minX + S.avatarSize / 2, textX, endX: textX + column, nameZ: text.info === null ? plate.z : plate.nameZ }
}
