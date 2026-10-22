import { Euler, Quaternion, Vector3 } from "three"

/** Where a card is and how it lies: a position, an orientation, a uniform scale, and the pause (seconds) before it flies there from its `from` pose */
export type Pose = { position: Vector3; quaternion: Quaternion; scale: number; delay?: number }

/** Height of a card lying on the table: just above the surface, so its edge and shadow never fight with it */
export const RESTING_HEIGHT = 0.03

/** Lying face up: the front looks at the sky */
export const FACE_UP = new Quaternion().setFromEuler(new Euler(-Math.PI / 2, 0, 0))
/** Lying face down: the back looks at the sky */
export const FACE_DOWN = new Quaternion().setFromEuler(new Euler(Math.PI / 2, 0, 0))

/** Default amplitude of `lean`, in radians (about one degree) */
const LEAN = 0.017
const Y = new Vector3(0, 1, 0)

/** A number between -1 and 1 that depends on the key alone (FNV-1a): the same on every render and for every player */
export function hashRandom(key: string) {
  let h = 2166136261
  for (let i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i), 16777619)
  return ((h >>> 0) / 4294967295) * 2 - 1
}

const leanAngle = (key: string, amplitude = LEAN) => hashRandom(key) * amplitude

/** A turn about the vertical axis of at most `amplitude` radians, always the same for the same key: a pile that looks stacked by hand */
export const lean = (key: string, amplitude = LEAN) => new Quaternion().setFromAxisAngle(Y, leanAngle(key, amplitude))

export type OnTable = {
  /** Height of the card's centre above the table; raise it by a small step per card to build a pile (default `RESTING_HEIGHT`) */
  y?: number
  /** Default: up */
  face?: "up" | "down"
  /** Turn about the vertical axis, in radians */
  yaw?: number
  /** Key of the card or of its pile: tilts the card a hair, always the same way (see `lean`) */
  lean?: string
  /** Amplitude of that tilt, in radians */
  leanAmplitude?: number
  scale?: number
  /** Seconds before the card flies there */
  delay?: number
}

/** A card lying flat on the table at (x, z) */
export function onTable(x: number, z: number, { y = RESTING_HEIGHT, face = "up", yaw = 0, lean: key, leanAmplitude, scale = 1, delay }: OnTable = {}): Pose {
  const angle = yaw + (key === undefined ? 0 : leanAngle(key, leanAmplitude))
  // A new quaternion every time: the poses of a board are mutated by nobody, but they must never alias FACE_UP / FACE_DOWN
  const quaternion = new Quaternion().setFromAxisAngle(Y, angle).multiply(face === "up" ? FACE_UP : FACE_DOWN)
  const pose: Pose = { position: new Vector3(x, y, z), quaternion, scale }
  if (delay !== undefined) pose.delay = delay
  return pose
}
