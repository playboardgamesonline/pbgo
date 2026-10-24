import { Matrix4, type Object3D, Quaternion, Vector3 } from "three"
import type { Pose } from "../pose"

/** What names a card across mounts: the game's own id for it */
export type CardId = string | number

/** Where a card was last seen, in the world */
type Sighting = { position: Vector3; quaternion: Quaternion; scale: Vector3; at: number }

export type PoseMemoryOptions = {
  /** Milliseconds a sighting stays good for (default 1000): a card that comes back later than that is a new card */
  maxAge?: number
  /** How many cards it keeps track of at once; the oldest sighting goes first (default 512) */
  capacity?: number
  /** The clock, in milliseconds (default `performance.now`) */
  now?: () => number
}

export type PoseMemory = {
  /** Writes down where a card is in the world, for a card with the same id that appears a moment later */
  remember: (id: CardId, object: Object3D) => void
  /** Where the card named `id` was last seen, in the frame of `object`'s parent, for `object` to fly from. Null when it was not seen, was seen too long ago, or is already at `target`. A sighting is handed back once */
  recall: (id: CardId, object: Object3D, target: Pose) => Pose | null
}

// How close a pose has to be to another to count as the same one
const SAME = { distance: 0.01, angle: 0.01, scale: 0.01 }

const placed = new Matrix4()
const inverse = new Matrix4()
const scale = new Vector3()

/** What the table remembers of the cards that left it: where they were, so a card that appears with the same id starts from there instead of popping into place */
export function createPoseMemory({ maxAge = 1000, capacity = 512, now = () => performance.now() }: PoseMemoryOptions = {}): PoseMemory {
  const seen = new Map<CardId, Sighting>()

  return {
    remember(id, object) {
      // The matrix cached on the object can be older than its position (a card that was never drawn has none): work it out from the chain of parents
      object.updateWorldMatrix(true, false)
      const sighting: Sighting = { position: new Vector3(), quaternion: new Quaternion(), scale: new Vector3(), at: now() }
      object.matrixWorld.decompose(sighting.position, sighting.quaternion, sighting.scale)
      // Delete first so the card goes to the back of the line: the oldest sighting is the first in the map
      seen.delete(id)
      seen.set(id, sighting)
      for (const oldest of seen.keys()) {
        if (seen.size <= capacity) break
        seen.delete(oldest)
      }
    },

    recall(id, object, target) {
      const sighting = seen.get(id)
      if (!sighting) return null
      seen.delete(id)
      if (now() - sighting.at > maxAge) return null

      // The sighting is in the world; the card is placed in the frame of its parent
      const parent = object.parent
      if (parent) {
        parent.updateWorldMatrix(true, false)
        inverse.copy(parent.matrixWorld).invert()
      } else {
        inverse.identity()
      }
      placed.compose(sighting.position, sighting.quaternion, sighting.scale).premultiply(inverse)
      const pose: Pose = { position: new Vector3(), quaternion: new Quaternion(), scale: 1 }
      placed.decompose(pose.position, pose.quaternion, scale)
      pose.scale = scale.x

      const there =
        pose.position.distanceTo(target.position) < SAME.distance &&
        pose.quaternion.angleTo(target.quaternion) < SAME.angle &&
        Math.abs(pose.scale - target.scale) < SAME.scale
      return there ? null : pose
    },
  }
}
