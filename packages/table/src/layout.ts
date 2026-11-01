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
}

/** `n` cards held in a fan, centred on x = 0, the first on the left */
export function fan(n: number, { gap, y = RESTING_HEIGHT, rise = 0, z = 0, curve = 0, tilt = 0, roll = 0, face = "up", scale = 1 }: FanOptions): Pose[] {
  const base = face === "up" ? -Math.PI / 2 : Math.PI / 2
  // A face-down card turns the other way about its own axis to turn the same way about the vertical one
  const turn = face === "up" ? -roll : roll
  return Array.from({ length: n }, (_, i) => {
    const off = i - (n - 1) / 2
    return {
      position: new Vector3(off * gap, y + i * rise, z + Math.abs(off) * curve),
      quaternion: new Quaternion().setFromEuler(new Euler(base + tilt, 0, off * turn)),
      scale,
    }
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

export type SeatsOptions = {
  /** Half the width of the ring the seats stand on */
  radiusX: number
  /** Half the depth of the ring the seats stand on */
  radiusZ: number
  /** Index of the viewer's seat, which sits in front: the others follow in order around the far half of the ring. Without it (or when it is not a seat, like the -1 of an `indexOf`), everyone sits on the far half */
  me?: number | null
  /** Angle (radians) kept free at each end of the far half, so the outer seats do not close in on the viewer's sides (default 0.35) */
  margin?: number
}

/**
 * The seats of `count` players around an elliptical table, indexed like the players, the turn passing from the viewer to the left.
 * The viewer's seat is at the front with yaw 0, so what lies there reads upright. Every other seat has the yaw that sends the top edge of a face-up card away from the middle of the table
 */
export function seats(count: number, { radiusX, radiusZ, me = null, margin = 0.35 }: SeatsOptions): Required<Spot>[] {
  const viewer = me !== null && me >= 0 && me < count ? me : null
  const others = viewer === null ? count : count - 1
  return Array.from({ length: count }, (_, i) => {
    if (i === viewer) return { x: 0, z: radiusZ, yaw: 0 }
    // Where this seat comes among the others, counting from the player after the viewer
    const k = viewer === null ? i : (i - viewer - 1 + count) % count
    const angle = others === 1 ? -Math.PI / 2 : Math.PI + margin + (k / (others - 1)) * (Math.PI - 2 * margin)
    const x = Math.cos(angle) * radiusX
    const z = Math.sin(angle) * radiusZ
    return { x, z, yaw: Math.atan2(x, z) + Math.PI }
  })
}
