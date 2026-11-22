import { Euler, Quaternion, Vector3 } from "three"
import { onTable, type Pose, RESTING_HEIGHT } from "./pose"

const Y = new Vector3(0, 1, 0)

/**
 * A place on the table and the way it faces: `yaw` turns it about the vertical axis.
 * A layout is drawn in the frame of a spot: +x runs to the right and -z is where the top edge of a face-up card points, which at yaw 0 is away from the viewer
 */
export type Spot = { x: number; z: number; yaw?: number }

/** A pose drawn in the frame of a spot, put on the table: describe a zone once, then place it where a player sits */
export function inFrame(spot: Spot, pose: Pose): Pose {
  const turn = new Quaternion().setFromAxisAngle(Y, spot.yaw ?? 0)
  const position = pose.position.clone().applyQuaternion(turn)
  position.x += spot.x
  position.z += spot.z
  const placed: Pose = { position, quaternion: turn.multiply(pose.quaternion), scale: pose.scale }
  if (pose.delay !== undefined) placed.delay = pose.delay
  return placed
}

export type FanOptions = {
  /** Distance along x between two neighbouring cards */
  gap: number
  /** Height of the first card (default `RESTING_HEIGHT`) */
  y?: number
  /** Extra height per card, from the first to the last, so overlapping cards never fight for the same pixels */
  rise?: number
  /** Where the middle of the fan lies along z */
  z?: number
  /** Extra z per card of distance from the middle: the ends of the fan swing toward +z */
  curve?: number
  /** Lean of every card toward +z, in radians: 0 lies flat, more stands the cards up */
  tilt?: number
  /** Turn of a card about its own axis per card of distance from the middle: the right-hand cards turn clockwise seen from above and the left-hand ones the other way, whichever face is up, so the fan opens toward -z */
  roll?: number
  /** Default: up */
  face?: "up" | "down"
  scale?: number
  /**
   * The height of a card at scale 1, to turn the fan about the feet of its cards instead of their middles, as a hand held in the fingers turns: `y` is then the height of the feet, `gap` the distance between the feet, and each card turns about its own foot, so a hand that stands
   * up opens at its top while its feet stay together. Without it each card turns about its middle
   */
  foot?: number
}

/** `n` cards held in a fan, centred on x = 0, the first on the left */
export function fan(n: number, { gap, y = RESTING_HEIGHT, rise = 0, z = 0, curve = 0, tilt = 0, roll = 0, face = "up", scale = 1, foot }: FanOptions): Pose[] {
  const base = face === "up" ? -Math.PI / 2 : Math.PI / 2
  // A face-down card turns the other way about its own axis to turn the same way about the vertical one
  const turn = face === "up" ? -roll : roll
  return Array.from({ length: n }, (_, i) => {
    const off = i - (n - 1) / 2
    const position = new Vector3(off * gap, y + i * rise, z + Math.abs(off) * curve)
    const quaternion = new Quaternion().setFromEuler(new Euler(base + tilt, 0, off * turn))
    // The foot of a card is half its height below its middle, along the card's own up: its middle is that far above the foot, whichever way the card is turned
    if (foot !== undefined) position.add(new Vector3(0, (foot * scale) / 2, 0).applyQuaternion(quaternion))
    return { position, quaternion, scale }
  })
}

export type RowOptions = {
  /** Distance along x between two neighbouring cards */
  gap: number
  /** Height of the first card (default `RESTING_HEIGHT`) */
  y?: number
  /** Extra height per card, from the first to the last, so overlapping cards never fight for the same pixels */
  rise?: number
  /** Where the row lies along z */
  z?: number
  /** Default: up */
  face?: "up" | "down"
  /** Turn of each card about the vertical axis, in radians, within the frame */
  turn?: number
  scale?: number
}

/** `n` cards lying flat in a line along x, centred on x = 0, the first on the left */
export function row(n: number, { gap, y = RESTING_HEIGHT, rise = 0, z = 0, face = "up", turn = 0, scale = 1 }: RowOptions): Pose[] {
  return Array.from({ length: n }, (_, i) => onTable((i - (n - 1) / 2) * gap, z, { y: y + i * rise, face, yaw: turn, scale }))
}

export type PileOptions = {
  /** Height of the bottom card (default `RESTING_HEIGHT`) */
  y?: number
  /** Height between two cards (default 0.02) */
  step?: number
  /** Default: down */
  face?: "up" | "down"
  /** Face of the top card alone (default: the face of the others) */
  topFace?: "up" | "down"
  /** Key of the pile: each card leans a hair by its own number (see `lean`), a pile that looks stacked by hand */
  lean?: string
  /** Amplitude of that lean, in radians */
  leanAmplitude?: number
  scale?: number
}

/** The height between two cards of a pile when none is given: a thin stack, with a gap the eye does not see */
const PILE_STEP = 0.02

/** `n` cards stacked at x = 0, z = 0, the bottom one first */
export function pile(n: number, { y = RESTING_HEIGHT, step = PILE_STEP, face = "down", topFace = face, lean, leanAmplitude, scale = 1 }: PileOptions = {}): Pose[] {
  return Array.from({ length: n }, (_, i) =>
    onTable(0, 0, { y: y + i * step, face: i === n - 1 ? topFace : face, lean: lean === undefined ? undefined : `${lean}:${i}`, leanAmplitude, scale }),
  )
}

export type GridOptions = {
  /** Cards per line */
  columns: number
  /** Distance along x between two neighbouring cards of a line */
  gapX: number
  /** Distance along z between two lines */
  gapZ: number
  /** Number of lines the grid is centred on (default: as many as `n` needs): fix it so the cells stay where they are while the cards come */
  rows?: number
  /** Default `RESTING_HEIGHT` */
  y?: number
  /** Default: up */
  face?: "up" | "down"
  /** Turn of each card about the vertical axis, in radians, within the frame */
  turn?: number
  scale?: number
}

/** `n` cards lying flat in lines, in reading order: the first line is the farthest from the viewer, the first card is on its left. A last line that is not full stays on the left */
export function grid(n: number, { columns, gapX, gapZ, rows, y = RESTING_HEIGHT, face = "up", turn = 0, scale = 1 }: GridOptions): Pose[] {
  const lines = rows ?? Math.ceil(n / columns)
  return Array.from({ length: n }, (_, i) => onTable((i % columns - (columns - 1) / 2) * gapX, (Math.floor(i / columns) - (lines - 1) / 2) * gapZ, { y, face, yaw: turn, scale }))
}

/** A pair of numbers for a table of the fewest players and a table of the most (`SeatsOptions.players`): what grows with the table is given at its two ends, and goes between them in steps */
export type Between = readonly [fewest: number, most: number]

/** The fewest and the most players a ring is tuned for unless it says otherwise */
export const PLAYERS: Between = [2, 8]

/**
 * What a table of `count` players has, from the value it has at the fewest players and at the most (`between`), the fewest and the most being `players`: a straight line from one to the other, held at the two ends, so that a count outside them takes the nearest end. The radii of
 * the ring go this way (one ring does not serve a table of two and a table of eight), and so does whatever else grows with the table: the scale of the opponents' cards, the room a plate is given.
 */
export function byPlayers(count: number, [fewest, most]: Between, players: Between = PLAYERS): number {
  const span = players[1] - players[0]
  const t = span <= 0 ? 0 : Math.min(1, Math.max(0, (count - players[0]) / span))
  return fewest + (most - fewest) * t
}

/**
 * The seat at `angle` on an ellipse of half-width `radiusX` and half-depth `radiusZ`. The angle is in degrees, clockwise as the camera sees the table, from the viewer's seat: 0 is in front of the viewer, 90 on their left, 180 straight across, 270 on their right. The yaw turns the top of
 * what lies there toward the middle of the table, as the player who sits there reads it.
 */
export function seatAt(angle: number, radiusX: number, radiusZ: number): Required<Spot> {
  const a = (angle * Math.PI) / 180
  // `+ 0` so that the seat in front has an x of 0 and not of -0
  const x = -Math.sin(a) * radiusX + 0
  const z = Math.cos(a) * radiusZ
  return { x, z, yaw: Math.abs(x) < 1e-9 && z > 0 ? 0 : Math.atan2(x, z) }
}

export type SeatsOptions = {
  /** Half the width of the ring the seats stand on: a number, or its half-width at the fewest players and at the most (`players`), which it goes between in steps as the table fills. A table of two and a table of eight cannot share a ring */
  radiusX: number | Between
  /** Half the depth of the ring the seats stand on: a number, or a pair like `radiusX` */
  radiusZ: number | Between
  /** Index of the viewer's seat, which sits in front: the others follow in order around the ring. Without it (or when it is not a seat, like the -1 of an `indexOf`), the players sit as at a table of one more player, the chair in front of the viewer being the one nobody has */
  me?: number | null
  /** Angle (radians) kept free at each end of the far half, so the outer seats do not close in on the viewer's sides (default 0.35). Replaced by `first` for the numbers of players it gives */
  margin?: number
  /**
   * Where the player after the viewer sits, in degrees clockwise from the viewer's seat, for a table of each number of players (the keys): 90 is the viewer's left side, 180 straight across. It is also how far from the viewer the first and the last opponent keep, since the viewer's own cards take room in front,
   * and the more players the less each needs. The other opponents are spread evenly between the first and the last, and a single opponent sits at this angle. A number of players it leaves out takes `margin`, and 180 for a table of two
   */
  first?: Readonly<Record<number, number>>
  /** The fewest and the most players that `radiusX`, `radiusZ` and `first` are given for (default 2 and 8): a table of fewer or more takes the nearest end */
  players?: Between
  /** How far toward the viewer their own seat lies (default: the depth of the ring at this table). Smaller than the ring when the viewer's cards are bigger than the others' and want to stand nearer the middle */
  viewerZ?: number
  /** How much wider than the ring of the most players the ring is for a table that has none in front and is already full: the chairs of one more are closer together than a plate allows (default 1.25) */
  widen?: number
}

/**
 * The seats of `count` players on an ellipse around the table, indexed like the players, the turn passing from the viewer to the left.
 * The viewer's seat is at the front with yaw 0, so what lies there reads upright. Every other seat has the yaw that sends the top edge of a face-up card toward the middle of the table, the way the player who sits there sees it:
 * any seat has its far side, its top, toward the middle, and what stands on that side (a name, the cards played) faces the centre of the table.
 * Without a viewer the players take the chairs of a table of one more, the viewer's chair in front staying empty: nobody sits where the viewer would, and the front keeps the room for the piles and the buttons.
 */
export function seats(count: number, { radiusX, radiusZ, me = null, margin = 0.35, first, players = PLAYERS, viewerZ, widen = 1.25 }: SeatsOptions): Required<Spot>[] {
  const viewer = me !== null && me >= 0 && me < count ? me : null
  // The table the seats are those of: this one, or one chair more when nobody sits in front
  const chairs = viewer === null ? count + 1 : count
  const spread = viewer === null && chairs > players[1] ? widen : 1
  const rx = (typeof radiusX === "number" ? radiusX : byPlayers(chairs, radiusX, players)) * spread
  const rz = (typeof radiusZ === "number" ? radiusZ : byPlayers(chairs, radiusZ, players)) * spread
  const others = chairs - 1
  const start = first?.[Math.min(players[1], Math.max(players[0], chairs))] ?? (others === 1 ? 180 : 90 + (margin * 180) / Math.PI)
  return Array.from({ length: count }, (_, i) => {
    if (i === viewer) return { x: 0, z: viewerZ ?? rz, yaw: 0 }
    // Where this seat comes among the others, counting from the player after the viewer
    const k = viewer === null ? i : (i - viewer - 1 + count) % count
    return seatAt(others === 1 ? start : start + (k / (others - 1)) * (360 - 2 * start), rx, rz)
  })
}
