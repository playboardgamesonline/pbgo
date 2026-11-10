import { Quaternion, Vector3 } from "three"
import { hashRandom } from "../pose"
import { type DieModel, dropOf, upFaceOf } from "./model"

/** The physics engine: Rapier, in its deterministic build, which gives the same fall on every machine for the same throw */
export type Rapier = typeof import("@dimforge/rapier3d-deterministic-compat")

let loading: Promise<Rapier> | null = null

/**
 * Fetches the physics engine, once, and starts it. It is a chunk of its own (a few megabytes with its WebAssembly inside), loaded the first time a die is on a table and never on a board without dice: a `Die` asks for it as soon as it
 * appears, so that it is there when the first roll comes. A failed load is tried again at the next call.
 */
export function loadPhysics(): Promise<Rapier> {
  if (!loading) {
    loading = import("@dimforge/rapier3d-deterministic-compat")
      .then(async (module) => {
        const api: Rapier = "init" in module ? module : (module as unknown as { default: Rapier }).default
        await api.init()
        return api
      })
      .catch((error: unknown) => {
        loading = null
        throw error
      })
  }
  return loading
}

/** What the dice roll in: a rectangle of the table with an invisible wall round it */
export type Arena = { x: number; z: number; width: number; depth: number }

/** The settings of the physics: the part of `DIE_SETTINGS` a roll reads */
export type Tuning = {
  /** How fast things fall, in units per second squared */
  gravity: number
  /** How much a die bounces back from the table, 0 to 1 */
  restitution: number
  /** How much a die grips the table */
  friction: number
  /** How fast a die is thrown, in units per second */
  throwSpeed: number
  /** A multiplier on how fast it spins when it leaves the hand */
  spin: number
}

/** A die that is thrown. The `key` names the throw: the same key gives the same start, so every machine throws the same */
export type Thrown = { id: string; model: DieModel; size: number; key: string; from?: Vector3 }

/** A die that lies on the table and may be hit by the ones that are thrown */
export type Resting = { model: DieModel; size: number; position: Vector3; quaternion: Quaternion }

/** What a roll did to a die: where it was, frame by frame */
export type Recording = {
  id: string
  /** Seconds between two frames */
  step: number
  /** The position (3 numbers) and the turn as a quaternion (4) of the die's middle, for each frame */
  frames: Float32Array
  /** The face that lies on top at the end */
  up: number
}

/** Where a recording puts the die at a moment */
export type Pose = { position: Vector3; quaternion: Quaternion }

const STEP = 1 / 120
// A frame is kept every other step: 60 a second is what the screen shows, and a recording is small
const EVERY = 2
const LONGEST = 6
// A die is still when it goes slower than this for this long
const STILL_SPEED = 0.06
const STILL_SPIN = 0.15
const STILL_STEPS = 30
// A die that stops leaning on an edge or a wall tips over onto a face in this many seconds
const TIP_SECONDS = 0.35
// A die lies flat when its top face looks this closely up (the cosine of about seven degrees)
const FLAT = 0.9925
const UP = new Vector3(0, 1, 0)

const random = (key: string, name: string) => hashRandom(`${key}:${name}`)
const unit = (key: string, name: string) => (random(key, name) + 1) / 2

function corners(model: DieModel, size: number): Float32Array {
  return Float32Array.from(model.hull.flatMap((corner) => [corner.x * size, corner.y * size, corner.z * size]))
}

/** Makes the world the dice roll in: the table, a wall round the arena, and the dice that lie there already */
function buildWorld(R: Rapier, arena: Arena, resting: readonly Resting[], tuning: Tuning) {
  const world = new R.World({ x: 0, y: -tuning.gravity, z: 0 })
  world.timestep = STEP
  const reach = Math.max(arena.width, arena.depth) * 2 + 20
  world.createCollider(R.ColliderDesc.cuboid(reach, 1, reach).setTranslation(arena.x, -1, arena.z).setRestitution(0.3).setFriction(tuning.friction))
  const wall = (x: number, z: number, hx: number, hz: number) => world.createCollider(R.ColliderDesc.cuboid(hx, 8, hz).setTranslation(x, 8, z).setRestitution(0.4).setFriction(0.3))
  const halfW = arena.width / 2
  const halfD = arena.depth / 2
  wall(arena.x - halfW - 0.5, arena.z, 0.5, halfD + 1)
  wall(arena.x + halfW + 0.5, arena.z, 0.5, halfD + 1)
  wall(arena.x, arena.z - halfD - 0.5, halfW + 1, 0.5)
  wall(arena.x, arena.z + halfD + 0.5, halfW + 1, 0.5)
  for (const die of resting) {
    const body = world.createRigidBody(R.RigidBodyDesc.fixed().setTranslation(die.position.x, die.position.y, die.position.z).setRotation(die.quaternion))
    const shape = R.ColliderDesc.convexHull(corners(die.model, die.size))
    if (shape) world.createCollider(shape.setRestitution(tuning.restitution).setFriction(tuning.friction), body)
  }
  return world
}

/** Where, how fast and how turned a die starts: from the near edge of the arena, high, toward its middle, with a spin, all from its key */
function start(die: Thrown, index: number, count: number, arena: Arena, tuning: Tuning) {
  const { key, size } = die
  const lane = count === 1 ? 0 : (index / (count - 1) - 0.5) * 2
  const spread = Math.min(arena.width * 0.7, count * size * 2.4)
  const position = die.from
    ? die.from.clone()
    : new Vector3(arena.x + (lane * spread) / 2 + random(key, "x") * size * 0.3, size * 2.7 + unit(key, "y") * size * 0.6, arena.z + arena.depth / 2 - size * 1.4)
  // Each die aims at a place of its own across the arena, so a pool does not pile up in the middle
  const aim = new Vector3(arena.x + lane * spread * 0.6 + random(key, "aim-x") * size * 0.5, position.y, arena.z - arena.depth * 0.08 + random(key, "aim-z") * arena.depth * 0.12)
  const direction = aim.sub(position)
  direction.y = 0
  direction.normalize()
  const speed = tuning.throwSpeed * (0.75 + 0.35 * unit(key, "speed"))
  const velocity = direction.multiplyScalar(speed).add(new Vector3(0, random(key, "lift") * 1.5, 0))
  const axis = new Vector3(random(key, "wx"), random(key, "wy"), random(key, "wz"))
  if (axis.lengthSq() < 1e-6) axis.set(1, 0, 0)
  const spin = axis.normalize().multiplyScalar(tuning.spin * (14 + 10 * unit(key, "w")))
  const turn = new Quaternion().setFromAxisAngle(new Vector3(random(key, "qx"), random(key, "qy"), random(key, "qz") + 0.01).normalize(), random(key, "qa") * Math.PI)
  return { position, velocity, spin, turn }
}

/**
 * Throws dice onto the table and records what they do, before anything is drawn. The throw is worked out from the keys alone, so it is the same everywhere, and it runs in a few milliseconds, so the whole roll is known
 * before the first frame: where each die lies and which face is on top. The caller then labels each die so that this face shows the number the engine gave (`labelFace`), and plays the recording back.
 *
 * A die that ends on an edge or leaning on a wall is tipped over onto the nearest face, a little time after it stopped, as a die that is not quite still falls.
 */
export function simulate(R: Rapier, arena: Arena, thrown: readonly Thrown[], resting: readonly Resting[], tuning: Tuning): Recording[] {
  const world = buildWorld(R, arena, resting, tuning)
  const bodies = thrown.map((die, index) => {
    const from = start(die, index, thrown.length, arena, tuning)
    const body = world.createRigidBody(
      R.RigidBodyDesc.dynamic()
        .setTranslation(from.position.x, from.position.y, from.position.z)
        .setRotation(from.turn)
        .setLinvel(from.velocity.x, from.velocity.y, from.velocity.z)
        .setAngvel(from.spin)
        .setCcdEnabled(true)
        .setLinearDamping(0.1)
        .setAngularDamping(0.25),
    )
    const shape = R.ColliderDesc.convexHull(corners(die.model, die.size))
    if (!shape) throw new RangeError(`The solid of ${die.model.name} has no volume`)
    world.createCollider(shape.setRestitution(tuning.restitution).setFriction(tuning.friction).setDensity(1), body)
    return body
  })

  const frames: number[][] = thrown.map(() => [])
  const record = () =>
    bodies.forEach((body, i) => {
      const p = body.translation()
      const q = body.rotation()
      frames[i]!.push(p.x, p.y, p.z, q.x, q.y, q.z, q.w)
    })
  record()
  let still = 0
  const total = LONGEST / STEP
  for (let step = 1; step <= total; step++) {
    world.step()
    if (step % EVERY === 0) record()
    const moving = bodies.some((body) => {
      const v = body.linvel()
      const w = body.angvel()
      return v.x * v.x + v.y * v.y + v.z * v.z > STILL_SPEED * STILL_SPEED || w.x * w.x + w.y * w.y + w.z * w.z > STILL_SPIN * STILL_SPIN
    })
    still = moving ? 0 : still + 1
    if (still >= STILL_STEPS) break
  }
  world.free()

  return thrown.map((die, i) => finish(die, frames[i]!))
}

const turned = new Vector3()

/** The recording of a die, with the frames that tip it onto a face when it stopped on an edge, and the face that ends on top */
function finish(die: Thrown, raw: number[]): Recording {
  const step = STEP * EVERY
  // A die sinks a hair into the table in the step it lands, before the engine pushes it out: it is lifted back, so that no corner is ever drawn under the surface
  const pushed = new Quaternion()
  for (let i = 0; i < raw.length; i += 7) {
    pushed.set(raw[i + 3]!, raw[i + 4]!, raw[i + 5]!, raw[i + 6]!)
    raw[i + 1] = Math.max(raw[i + 1]!, dropOf(die.model, pushed) * die.size)
  }
  const last = raw.length - 7
  const quaternion = new Quaternion(raw[last + 3], raw[last + 4], raw[last + 5], raw[last + 6])
  const { face, flatness } = upFaceOf(die.model, quaternion)
  if (flatness >= FLAT) return { id: die.id, step, frames: Float32Array.from(raw), up: face }
  const goal = new Quaternion().setFromUnitVectors(turned.copy(die.model.faces[face]!.normal).applyQuaternion(quaternion), UP).multiply(quaternion)
  const from = new Vector3(raw[last], raw[last + 1], raw[last + 2])
  const lowest = dropOf(die.model, goal) * die.size
  const count = Math.round(TIP_SECONDS / step)
  const blend = new Quaternion()
  const tip = [...raw]
  for (let i = 1; i <= count; i++) {
    const t = i / count
    const ease = t * t
    blend.slerpQuaternions(quaternion, goal, ease)
    tip.push(from.x, from.y + (lowest - from.y) * ease, from.z, blend.x, blend.y, blend.z, blend.w)
  }
  return { id: die.id, step, frames: Float32Array.from(tip), up: face }
}

/** The seconds a recording lasts */
export const durationOf = (recording: Recording) => (recording.frames.length / 7 - 1) * recording.step

const from = new Quaternion()
const to = new Quaternion()

/** Where the die is `t` seconds into its recording, between two frames, written into `out`: after the end it stays where it stopped */
export function sampleRecording(recording: Recording, t: number, out: Pose): Pose {
  const { frames, step } = recording
  const count = frames.length / 7
  const position = Math.min(Math.max(t, 0) / step, count - 1)
  const i = Math.min(Math.floor(position), count - 2)
  const blend = count === 1 ? 0 : position - i
  const a = i * 7
  const b = Math.min(i + 1, count - 1) * 7
  out.position.set(frames[a]! + (frames[b]! - frames[a]!) * blend, frames[a + 1]! + (frames[b + 1]! - frames[a + 1]!) * blend, frames[a + 2]! + (frames[b + 2]! - frames[a + 2]!) * blend)
  from.set(frames[a + 3]!, frames[a + 4]!, frames[a + 5]!, frames[a + 6]!)
  to.set(frames[b + 3]!, frames[b + 4]!, frames[b + 5]!, frames[b + 6]!)
  out.quaternion.slerpQuaternions(from, to, blend)
  return out
}

/** How fast a die falls onto the table, in units per second, for the hardest hit that a game would play a sound for, and the least that counts as a hit */
const HIT_REFERENCE = 16
const HIT_LEAST = 1.2
const HIT_APART = 0.1

/**
 * The moments a die hits the table in its recording, with how hard (1 is the hardest a game plays): where its lowest corner reaches the surface while it is still falling. A game plays the sound of a die on each. Dice that
 * hit one another are not told apart from the table.
 */
export function impactsOf(recording: Recording, model: DieModel, size: number): { at: number; strength: number }[] {
  const { frames, step } = recording
  const count = frames.length / 7
  const hits: { at: number; strength: number }[] = []
  const q = new Quaternion()
  for (let i = 1; i < count; i++) {
    const y = frames[i * 7 + 1]!
    const fall = (frames[(i - 1) * 7 + 1]! - y) / step
    if (fall < HIT_LEAST) continue
    q.set(frames[i * 7 + 3]!, frames[i * 7 + 4]!, frames[i * 7 + 5]!, frames[i * 7 + 6]!)
    if (y - dropOf(model, q) * size > size * 0.12) continue
    const at = i * step
    const previous = hits[hits.length - 1]
    if (previous && at - previous.at < HIT_APART) continue
    hits.push({ at, strength: Math.min(1, fall / HIT_REFERENCE) })
  }
  return hits
}
