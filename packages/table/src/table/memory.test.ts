import { Euler, Group, Matrix4, Quaternion, Vector3 } from "three"
import { describe, expect, it } from "vitest"
import type { Pose } from "../pose"
import { createPoseMemory } from "./memory"

const DIGITS = 10

/** A pose at a point, unturned */
const pose = (x: number, y: number, z: number, scale = 1): Pose => ({ position: new Vector3(x, y, z), quaternion: new Quaternion(), scale })

/** Far from anywhere a test puts a card */
const FAR = pose(100, 100, 100)

/** A group at a point, in the frame of its parent */
function group(x: number, y: number, z: number, parent?: Group) {
  const g = new Group()
  g.position.set(x, y, z)
  parent?.add(g)
  return g
}

/** Where a pose of a card lands in the world once the card is put under `parent` */
function inTheWorld(placed: Pose, parent: Group | null) {
  const matrix = new Matrix4().compose(placed.position, placed.quaternion, new Vector3(placed.scale, placed.scale, placed.scale))
  if (parent) {
    parent.updateWorldMatrix(true, false)
    matrix.premultiply(parent.matrixWorld)
  }
  const world = { position: new Vector3(), quaternion: new Quaternion(), scale: new Vector3() }
  matrix.decompose(world.position, world.quaternion, world.scale)
  return world
}

/** What the table says about a card seen at (1, 2, 3), 1.5 times its size, and put back against `target` */
function recallAgainst(target: Pose) {
  const memory = createPoseMemory()
  const card = group(1, 2, 3)
  card.scale.setScalar(1.5)
  memory.remember("a", card)
  return memory.recall("a", group(0, 0, 0), target)
}

describe("createPoseMemory", () => {
  it("has nothing to say about a card it never saw", () => {
    expect(createPoseMemory().recall("a", group(0, 0, 0), FAR)).toBeNull()
  })

  it("hands back where the card was, in the frame of the parent of the card that comes back", () => {
    const memory = createPoseMemory()
    // No matrix has been worked out for any of these: nothing was ever drawn
    const room = group(10, 0, 0)
    const card = group(1, 2, 3, room)
    card.scale.setScalar(1.5)
    memory.remember("a", card)

    const elsewhere = group(0, 0, 4)
    elsewhere.rotation.y = Math.PI / 2
    elsewhere.scale.setScalar(2)
    const comingBack = group(0, 0, 0, elsewhere)
    const back = memory.recall("a", comingBack, FAR)

    expect(back).not.toBeNull()
    const landed = inTheWorld(back!, elsewhere)
    expect(landed.position.x).toBeCloseTo(11, DIGITS)
    expect(landed.position.y).toBeCloseTo(2, DIGITS)
    expect(landed.position.z).toBeCloseTo(3, DIGITS)
    expect(landed.scale.x).toBeCloseTo(1.5, DIGITS)
    expect(landed.quaternion.angleTo(new Quaternion())).toBeCloseTo(0, DIGITS)
    expect(back!.scale).toBeCloseTo(0.75, DIGITS)
    expect(back!.delay).toBeUndefined()
  })

  it("keeps a card's turn", () => {
    const memory = createPoseMemory()
    const card = group(0, 0, 0)
    card.rotation.set(0.4, 1.1, -0.3)
    memory.remember("a", card)
    const back = memory.recall("a", group(0, 0, 0), FAR)
    expect(back!.quaternion.angleTo(card.quaternion)).toBeCloseTo(0, DIGITS)
  })

  it("places the card in the world when it has no parent", () => {
    const memory = createPoseMemory()
    memory.remember("a", group(4, 5, 6))
    const back = memory.recall("a", new Group(), FAR)
    expect(back!.position.toArray()).toEqual([4, 5, 6])
  })

  it("hands a sighting back once", () => {
    const memory = createPoseMemory()
    memory.remember("a", group(1, 0, 0))
    expect(memory.recall("a", group(0, 0, 0), FAR)).not.toBeNull()
    expect(memory.recall("a", group(0, 0, 0), FAR)).toBeNull()
  })

  it("keeps the latest sighting of a card", () => {
    const memory = createPoseMemory()
    const card = group(1, 0, 0)
    memory.remember("a", card)
    card.position.x = 5
    memory.remember("a", card)
    expect(memory.recall("a", group(0, 0, 0), FAR)!.position.x).toBe(5)
  })

  it("tells cards apart by id, numbers included", () => {
    const memory = createPoseMemory()
    memory.remember("a", group(1, 0, 0))
    memory.remember(7, group(2, 0, 0))
    expect(memory.recall(7, group(0, 0, 0), FAR)!.position.x).toBe(2)
    expect(memory.recall("a", group(0, 0, 0), FAR)!.position.x).toBe(1)
  })

  it("does not move what it is given", () => {
    const memory = createPoseMemory()
    const card = group(1, 2, 3)
    const comingBack = group(7, 8, 9)
    memory.remember("a", card)
    memory.recall("a", comingBack, FAR)
    expect(card.position.toArray()).toEqual([1, 2, 3])
    expect(comingBack.position.toArray()).toEqual([7, 8, 9])
  })

  describe("a card that is already where it should be", () => {
    it("needs no flight: nothing is handed back", () => {
      expect(recallAgainst(pose(1, 2, 3, 1.5))).toBeNull()
    })

    it("still uses up the sighting", () => {
      const memory = createPoseMemory()
      memory.remember("a", group(1, 2, 3))
      expect(memory.recall("a", group(0, 0, 0), pose(1, 2, 3))).toBeNull()
      expect(memory.recall("a", group(0, 0, 0), FAR)).toBeNull()
    })

    it("tells a different place from the same one", () => {
      const same = pose(1, 2, 3, 1.5)
      expect(recallAgainst({ ...same, position: new Vector3(1.005, 2, 3) })).toBeNull()
      expect(recallAgainst({ ...same, position: new Vector3(1.5, 2, 3) })).not.toBeNull()
    })

    it("tells a different turn from the same one", () => {
      const same = pose(1, 2, 3, 1.5)
      expect(recallAgainst({ ...same, quaternion: new Quaternion().setFromEuler(new Euler(0, 0.005, 0)) })).toBeNull()
      expect(recallAgainst({ ...same, quaternion: new Quaternion().setFromEuler(new Euler(0, 0.5, 0)) })).not.toBeNull()
    })

    it("tells a different size from the same one", () => {
      const same = pose(1, 2, 3, 1.5)
      expect(recallAgainst({ ...same, scale: 1.505 })).toBeNull()
      expect(recallAgainst({ ...same, scale: 2 })).not.toBeNull()
    })
  })

  describe("time", () => {
    it("forgets a card that was seen too long ago", () => {
      let time = 0
      const memory = createPoseMemory({ maxAge: 1000, now: () => time })
      memory.remember("a", group(1, 0, 0))
      time = 1000
      expect(memory.recall("a", group(0, 0, 0), FAR)).not.toBeNull()

      memory.remember("a", group(1, 0, 0))
      time = 2001
      expect(memory.recall("a", group(0, 0, 0), FAR)).toBeNull()
      time = 2002
      expect(memory.recall("a", group(0, 0, 0), FAR)).toBeNull()
    })

    it("counts from the latest sighting", () => {
      let time = 0
      const memory = createPoseMemory({ maxAge: 1000, now: () => time })
      memory.remember("a", group(1, 0, 0))
      time = 900
      memory.remember("a", group(2, 0, 0))
      time = 1800
      expect(memory.recall("a", group(0, 0, 0), FAR)!.position.x).toBe(2)
    })
  })

  describe("capacity", () => {
    it("forgets the oldest sighting first", () => {
      const memory = createPoseMemory({ capacity: 3 })
      ;["a", "b", "c", "d"].forEach((id) => memory.remember(id, group(1, 0, 0)))
      expect(memory.recall("a", group(0, 0, 0), FAR)).toBeNull()
      for (const id of ["b", "c", "d"]) expect(memory.recall(id, group(0, 0, 0), FAR)).not.toBeNull()
    })

    it("sends a card seen again to the back of the line", () => {
      const memory = createPoseMemory({ capacity: 2 })
      ;["a", "b", "a", "c"].forEach((id) => memory.remember(id, group(1, 0, 0)))
      expect(memory.recall("b", group(0, 0, 0), FAR)).toBeNull()
      expect(memory.recall("a", group(0, 0, 0), FAR)).not.toBeNull()
      expect(memory.recall("c", group(0, 0, 0), FAR)).not.toBeNull()
    })
  })
})
