import type { TableBox } from "../box"
import type { Spot } from "../layout"

/**
 * How a seat's plate (its name with the avatar and the crown, its info line) stands: out from the spot the ring gives it, or above the cards of the player. Every number is in world units but the factors of `reach` and the opacity. A plain object that a debug panel
 * edits: the next render of a `Seat` follows it.
 */
export const SEAT_SETTINGS = {
  /** A plate placed from its spot (`plateOf`) stands at the spot times these factors for an opponent: just beyond the cards, out of the ring. A plate that stands on the middle's side of the cards of its player (`above`) does not read them */
  reachX: 1.32,
  reachZ: 1.32,
  /** The same for the viewer's own plate: level with the spot, a little in front of it */
  viewerReachX: 1,
  viewerReachZ: 1.18,
  /** The height of the name's lettering, and how far toward the middle of the table it stands from the plate's centre */
  nameHeight: 0.48,
  nameLift: 0.22,
  /** The height of the info line's lettering (the score, then the status), and how far toward the cards it stands from the plate's centre */
  lineHeight: 0.34,
  lineDrop: 0.34,
  /** The widest a name may be: a longer one (twelve wide capitals) shrinks to this width, with its proportions, instead of reaching the plate of the next seat. Twelve letters of the platform's font make about 3.1, so a name that is not wide is never touched */
  nameRoom: 3.8,
  /** The avatar's diameter and its gap to the first or the last letter */
  avatarSize: 0.48,
  avatarGap: 0.16,
  /** The crown's size, and how far its foot stands from the avatar's centre: toward the right, and toward the middle of the table */
  crownSize: 0.52,
  crownRight: 0.17,
  crownBack: 0.21,
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
    crownRight: S.crownRight * factor,
    crownBack: S.crownBack * factor,
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
  nameLift: ["name lift", 0, 1, 0.01],
  lineHeight: ["info line size", 0.2, 1, 0.01],
  lineDrop: ["info line drop", 0, 1, 0.01],
  nameRoom: ["name room (a longer name shrinks)", 1, 8, 0.1],
  avatarSize: ["avatar size", 0.2, 1.2, 0.01],
  avatarGap: ["avatar gap", 0, 0.6, 0.01],
  crownSize: ["crown size", 0.2, 1.4, 0.01],
  crownRight: ["crown right of the avatar", -0.6, 0.8, 0.01],
  crownBack: ["crown behind the avatar", -0.6, 0.8, 0.01],
  plateGap: ["plate gap beyond the cards", 0, 1.5, 0.01],
  awayOpacity: ["away or out opacity", 0, 1, 0.01],
} satisfies Record<keyof SeatSettings, Knob>

/** Where each piece of a seat's plate stands, in world units: the plate's centre, and the offsets of the pieces from the lettering of the name */
export type Plate = {
  x: number
  z: number
  /** The z of the name's lettering and of the info line under it */
  nameZ: number
  lineZ: number
  /** The avatar's centre from the left edge of the name: always before it, to its left, as the plate is read */
  avatarX: number
  /** The crown's foot, in the same frame as the avatar: at its upper-right corner, the way the seat label of the DOM wears it */
  crownX: number
  crownZ: number
}

/**
 * How far to the right of the plate's centre the middle of the name stands, so that the avatar and the name, side by side, are one block centred on the plate, over the info line: half of what the avatar takes, its diameter and its gap to the first
 * letter, whatever the width of the name.
 */
export const nameShift = (settings: SeatSettings = SEAT_SETTINGS) => (settings.avatarGap + settings.avatarSize) / 2

/** The pieces of the plate whose centre stands at (`x`, `z`), each where the settings put it from the centre */
function plateAround(x: number, z: number, S: SeatSettings): Plate {
  const avatarX = -(S.avatarGap + S.avatarSize / 2)
  return {
    x,
    z,
    nameZ: z - S.nameLift,
    lineZ: z + S.lineDrop,
    avatarX,
    crownX: avatarX + S.crownRight,
    crownZ: -S.crownBack,
  }
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
  return plateAround((cards.minX + cards.maxX) / 2, cards.minZ - S.plateGap - S.lineDrop - S.lineHeight / 2, S)
}

/** How many letters of a name a plate is taken to hold when a layout leaves room for it; a name is cut to 12 and a crowded table has no room for that, so a longer one sticks out of the room rather than into its neighbour's */
export const PLATE_LETTERS = 6

/** How wide a plate is taken to be: the avatar and a name of `PLATE_LETTERS` letters (about half the lettering's height each), side by side. What a layout leaves for it; the real width depends on the name */
export const plateWidth = (settings: SeatSettings = SEAT_SETTINGS) => settings.avatarGap + settings.avatarSize + PLATE_LETTERS * 0.5 * settings.nameHeight

/** What a plate covers of the table: its width, from the top of the name or the avatar to the foot of the info line. The crown stands up from the table and is not in it */
export function plateBoxOf(plate: Plate, settings: SeatSettings = SEAT_SETTINGS, width: number = plateWidth(settings)): TableBox {
  const S = settings
  return { minX: plate.x - width / 2, maxX: plate.x + width / 2, minZ: plate.nameZ - Math.max(S.nameHeight, S.avatarSize) / 2, maxZ: plate.lineZ + S.lineHeight / 2 }
}
