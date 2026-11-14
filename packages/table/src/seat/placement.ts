import type { Spot } from "../layout"

/**
 * How a seat's plate (its aura, its name with the avatar and the crown, its lines) stands out from the spot the ring gives it. Every number is in
 * world units but the factors of `reach`, the forces and the opacity. A plain object that a debug panel edits: the next render of a `Seat` follows it.
 */
export const SEAT_SETTINGS = {
  /** An opponent's plate stands at the spot times these factors: just beyond the cards, out of the ring */
  reachX: 1.32,
  reachZ: 1.32,
  /** The viewer's own plate: level with the spot, a little in front of it */
  viewerReachX: 1,
  viewerReachZ: 1.18,
  /** The height of the name's lettering, and how far toward the middle of the table it stands from the plate's centre */
  nameHeight: 0.55,
  nameLift: 0.25,
  /** The height of the info line's lettering (the score, then the status), and how far toward the viewer it stands from the plate's centre */
  lineHeight: 0.4,
  lineDrop: 0.4,
  /** The avatar's diameter and its gap to the first or the last letter */
  avatarSize: 0.56,
  avatarGap: 0.18,
  /** The crown's size, and how far its foot stands from the avatar's centre: toward the right, and away from the viewer */
  crownSize: 0.6,
  crownRight: 0.2,
  crownBack: 0.24,
  /** The aura's size */
  auraWidth: 3.2,
  auraDepth: 1.6,
  /** How bright the aura is for the player of the turn (none: the crown says it), for a player the game expects with others, and for a winner */
  turnForce: 0,
  waitingForce: 0.5,
  winnerForce: 1,
  /** How opaque the plate of a player who is away stays */
  awayOpacity: 0.4,
}
export type SeatSettings = typeof SEAT_SETTINGS

/** A knob of a debug panel: its label, its least, its greatest and its step */
type Knob = [label: string, min: number, max: number, step: number]

/** The knobs a debug panel can offer for `SEAT_SETTINGS`, one for each of its fields */
export const SEAT_FIELDS = {
  reachX: ["plate reach x", 1, 2, 0.01],
  reachZ: ["plate reach z", 1, 2, 0.01],
  viewerReachX: ["viewer plate reach x", 0.5, 2, 0.01],
  viewerReachZ: ["viewer plate reach z", 0.5, 2, 0.01],
  nameHeight: ["name size", 0.2, 1.2, 0.01],
  nameLift: ["name lift", 0, 1, 0.01],
  lineHeight: ["info line size", 0.2, 1, 0.01],
  lineDrop: ["info line drop", 0, 1, 0.01],
  avatarSize: ["avatar size", 0.2, 1.2, 0.01],
  avatarGap: ["avatar gap", 0, 0.6, 0.01],
  crownSize: ["crown size", 0.2, 1.4, 0.01],
  crownRight: ["crown right of the avatar", -0.6, 0.8, 0.01],
  crownBack: ["crown behind the avatar", -0.6, 0.8, 0.01],
  auraWidth: ["aura width", 1, 8, 0.1],
  auraDepth: ["aura depth", 0.5, 5, 0.1],
  turnForce: ["aura force on the turn", 0, 1.5, 0.01],
  waitingForce: ["aura force when expected", 0, 1.5, 0.01],
  winnerForce: ["aura force on a winner", 0, 1.5, 0.01],
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

/** The plate of the seat at `spot`; `viewer` is the viewer's own seat. */
export function plateOf(spot: Spot, viewer: boolean, settings: SeatSettings = SEAT_SETTINGS): Plate {
  const S = settings
  const x = spot.x * (viewer ? S.viewerReachX : S.reachX)
  const z = spot.z * (viewer ? S.viewerReachZ : S.reachZ)
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

/** What lights a seat's aura. */
export type SeatMood = { active?: boolean; waiting?: boolean; winner?: boolean }

/** How bright a seat's aura is: the brightest of the lights that apply, none when none does. */
export function auraForce({ active, waiting, winner }: SeatMood, settings: SeatSettings = SEAT_SETTINGS): number {
  return Math.max(active ? settings.turnForce : 0, waiting ? settings.waitingForce : 0, winner ? settings.winnerForce : 0)
}
