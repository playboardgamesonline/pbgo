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
  /** A seat whose spot is farther right than this puts its avatar after the name, away from the cards that fan out to the left of the name */
  rightFrom: 1,
  /** The height of the name's lettering, and how far toward the middle of the table it stands from the plate's centre */
  nameHeight: 0.62,
  nameLift: 0.25,
  /** The height of the line's lettering (the score), and how far toward the viewer it stands from the plate's centre */
  lineHeight: 0.42,
  lineDrop: 0.35,
  /** The same for the status under the line (Frozen, Stayed) */
  statusHeight: 0.34,
  statusDrop: 0.85,
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
  /** How bright the aura is for the player of the turn (none: the crown says it), for a player the game expects with others, under the pointer of a seat that can be picked, and for a winner */
  turnForce: 0,
  waitingForce: 0.5,
  hoverForce: 0.7,
  winnerForce: 1,
  /** How opaque the plate of a player who is away or out stays */
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
  rightFrom: ["right-hand seat from x", 0, 6, 0.1],
  nameHeight: ["name size", 0.2, 1.2, 0.01],
  nameLift: ["name lift", 0, 1, 0.01],
  lineHeight: ["line size", 0.2, 1, 0.01],
  lineDrop: ["line drop", 0, 1, 0.01],
  statusHeight: ["status size", 0.2, 1, 0.01],
  statusDrop: ["status drop", 0, 1.6, 0.01],
  avatarSize: ["avatar size", 0.2, 1.2, 0.01],
  avatarGap: ["avatar gap", 0, 0.6, 0.01],
  crownSize: ["crown size", 0.2, 1.4, 0.01],
  crownRight: ["crown right of the avatar", -0.6, 0.8, 0.01],
  crownBack: ["crown behind the avatar", -0.6, 0.8, 0.01],
  auraWidth: ["aura width", 1, 8, 0.1],
  auraDepth: ["aura depth", 0.5, 5, 0.1],
  turnForce: ["aura force on the turn", 0, 1.5, 0.01],
  waitingForce: ["aura force when expected", 0, 1.5, 0.01],
  hoverForce: ["aura force under the pointer", 0, 1.5, 0.01],
  winnerForce: ["aura force on a winner", 0, 1.5, 0.01],
  awayOpacity: ["away or out opacity", 0, 1, 0.01],
} satisfies Record<keyof SeatSettings, Knob>

/** Where each piece of a seat's plate stands, in world units: the plate's centre, and the offsets of the pieces from the lettering of the name */
export type Plate = {
  x: number
  z: number
  /** The z of the name's lettering, of the line under it and of the status under the line */
  nameZ: number
  lineZ: number
  statusZ: number
  /** The avatar goes after the name (a right-hand seat) rather than before it */
  after: boolean
  /** The avatar's centre from the left edge of the name (before it) or from its right edge (after it) */
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
  const after = spot.x > S.rightFrom
  const avatarX = (after ? 1 : -1) * (S.avatarGap + S.avatarSize / 2)
  return {
    x,
    z,
    nameZ: z - S.nameLift,
    lineZ: z + S.lineDrop,
    statusZ: z + S.statusDrop,
    after,
    avatarX,
    crownX: avatarX + S.crownRight,
    crownZ: -S.crownBack,
  }
}

/** What lights a seat's aura. */
export type SeatMood = { active?: boolean; waiting?: boolean; hovered?: boolean; winner?: boolean }

/** How bright a seat's aura is: the brightest of the lights that apply, none when none does. */
export function auraForce({ active, waiting, hovered, winner }: SeatMood, settings: SeatSettings = SEAT_SETTINGS): number {
  return Math.max(active ? settings.turnForce : 0, waiting ? settings.waitingForce : 0, hovered ? settings.hoverForce : 0, winner ? settings.winnerForce : 0)
}
