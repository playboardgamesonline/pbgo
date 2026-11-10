import { Quaternion, Vector3 } from "three"
import { beforeAll, describe, expect, it } from "vitest"
import { labelFace, newLabels } from "./labels"
import { dropOf, upFaceOf } from "./model"
import { type Arena, durationOf, impactsOf, loadPhysics, type Pose, type Rapier, type Recording, type Resting, sampleRecording, simulate, type Thrown, type Tuning } from "./physics"
import { DIE_SHAPES, dieModel } from "./solids"

const ARENA: Arena = { x: 0, z: 0, width: 6, depth: 4 }
const TUNING: Tuning = { gravity: 40, restitution: 0.55, friction: 0.35, throwSpeed: 7, spin: 1.4 }
const SIZE = 0.5

let R: Rapier
beforeAll(async () => {
  R = await loadPhysics()
}, 30000)

const thrown = (shape: (typeof DIE_SHAPES)[number], key: string, id = key): Thrown => ({ id, model: dieModel(shape), size: SIZE, key })
const lastPose = (rec: Recording): Pose => {
  const out: Pose = { position: new Vector3(), quaternion: new Quaternion() }
  return sampleRecording(rec, durationOf(rec) + 1, out)
}
const lowestAt = (rec: Recording, shape: (typeof DIE_SHAPES)[number], frame: number) => {
  const q = new Quaternion(rec.frames[frame * 7 + 3], rec.frames[frame * 7 + 4], rec.frames[frame * 7 + 5], rec.frames[frame * 7 + 6])
  return rec.frames[frame * 7 + 1]! - dropOf(dieModel(shape), q) * SIZE
}

describe("loadPhysics", () => {
  it("starts the engine once and gives it again", async () => {
    expect(await loadPhysics()).toBe(R)
    expect(typeof R.World).toBe("function")
  })
})

describe.each(DIE_SHAPES)("a %s thrown", (shape) => {
  const keys = ["roll-1", "roll-2", "roll-3", "roll-4", "roll-5", "roll-6"]
  let rolls: Recording[] = []
  beforeAll(() => {
    rolls = keys.map((key) => simulate(R, ARENA, [thrown(shape, key)], [], TUNING)[0]!)
  })

  it("comes to rest, in a few seconds, with a recording that has hundreds of frames at most", () => {
    for (const rec of rolls) {
      expect(rec.frames.length % 7).toBe(0)
      expect(rec.frames.length / 7).toBeGreaterThan(20)
      expect(durationOf(rec)).toBeGreaterThan(0.5)
      expect(durationOf(rec)).toBeLessThan(7)
    }
  })

  it("ends lying flat on a face, whatever the throw, with that face on top", () => {
    for (const rec of rolls) {
      const model = dieModel(shape)
      const { face, flatness } = upFaceOf(model, lastPose(rec).quaternion)
      expect(face).toBe(rec.up)
      expect(flatness).toBeGreaterThan(0.99)
    }
  })

  it("rests on the table: its lowest corner ends on the surface", () => {
    for (const rec of rolls) expect(lowestAt(rec, shape, rec.frames.length / 7 - 1)).toBeCloseTo(0, 1)
  })

  it("never goes under the table", () => {
    for (const rec of rolls) for (let f = 0; f < rec.frames.length / 7; f++) expect(lowestAt(rec, shape, f), `frame ${f}`).toBeGreaterThan(-0.05 * SIZE)
  })

  it("stays inside the wall round the arena", () => {
    for (const rec of rolls) {
      for (let f = 0; f < rec.frames.length / 7; f++) {
        expect(Math.abs(rec.frames[f * 7]!)).toBeLessThan(ARENA.width / 2 + SIZE)
        expect(Math.abs(rec.frames[f * 7 + 2]!)).toBeLessThan(ARENA.depth / 2 + SIZE * 1.6)
      }
    }
  })

  it("is the same throw for the same key, and another for another key", () => {
    const again = simulate(R, ARENA, [thrown(shape, keys[0]!)], [], TUNING)[0]!
    expect(Array.from(again.frames)).toEqual(Array.from(rolls[0]!.frames))
    expect(again.up).toBe(rolls[0]!.up)
    expect(Array.from(rolls[1]!.frames)).not.toEqual(Array.from(rolls[0]!.frames))
  })

  it("lands on every face over enough throws: it is a roll, not a fixed throw", () => {
    const model = dieModel(shape)
    const seen = new Set<number>()
    for (let i = 0; i < model.sides * 6; i++) seen.add(simulate(R, ARENA, [thrown(shape, `many-${i}`)], [], TUNING)[0]!.up)
    expect(seen.size).toBeGreaterThan(model.sides / 2)
  })

  it("ends on the number the engine gave, once the die is labelled by the face that is up: for every number", () => {
    const model = dieModel(shape)
    for (let label = 0; label < model.sides; label++) {
      const rec = rolls[label % rolls.length]!
      const labels = labelFace(model, newLabels(model), rec.up, label, `label-${label}`)
      expect(labels[rec.up]).toBe(label)
    }
  })
})

describe("a pool of dice", () => {
  it("does not pass through itself: the dice end apart, in the arena", () => {
    const dice = Array.from({ length: 6 }, (_, i) => thrown("d6", `pool-${i}`, `die-${i}`))
    const recs = simulate(R, ARENA, dice, [], TUNING)
    const ends = recs.map((rec) => lastPose(rec).position)
    for (let i = 0; i < ends.length; i++) {
      for (let j = i + 1; j < ends.length; j++) expect(ends[i]!.distanceTo(ends[j]!), `${i} and ${j}`).toBeGreaterThan(SIZE * 0.85)
    }
    for (const rec of recs) expect(rec.up).toBeGreaterThanOrEqual(0)
  })

  it("is thrown in a few hundred milliseconds at most, six dice of twenty faces", () => {
    const dice = Array.from({ length: 6 }, (_, i) => thrown("d20", `fast-${i}`, `die-${i}`))
    const t0 = performance.now()
    simulate(R, ARENA, dice, [], TUNING)
    expect(performance.now() - t0).toBeLessThan(600)
  })

  it("is the same pool for the same keys", () => {
    const dice = Array.from({ length: 4 }, (_, i) => thrown("d8", `same-${i}`, `die-${i}`))
    const a = simulate(R, ARENA, dice, [], TUNING)
    const b = simulate(R, ARENA, dice, [], TUNING)
    a.forEach((rec, i) => expect(Array.from(rec.frames)).toEqual(Array.from(b[i]!.frames)))
  })

  it("is hit by nothing that is not there: a die that lies still is not moved by a throw that misses it", () => {
    const model = dieModel("d6")
    const q = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), 0.3)
    const lying: Resting = { model, size: SIZE, position: new Vector3(-2.5, dropOf(model, q) * SIZE, -1.5), quaternion: q }
    const recs = simulate(R, ARENA, [thrown("d6", "miss")], [lying], TUNING)
    expect(recs).toHaveLength(1)
    expect(lastPose(recs[0]!).position.distanceTo(lying.position)).toBeGreaterThan(SIZE * 0.5)
  })
})

describe("sampleRecording", () => {
  let rec: Recording
  beforeAll(() => {
    rec = simulate(R, ARENA, [thrown("d6", "sample")], [], TUNING)[0]!
  })
  const out = (): Pose => ({ position: new Vector3(), quaternion: new Quaternion() })

  it("gives the first frame at the start and the last after the end", () => {
    const start = sampleRecording(rec, 0, out())
    expect(start.position.toArray().map((n) => Math.fround(n))).toEqual([rec.frames[0], rec.frames[1], rec.frames[2]])
    const end = sampleRecording(rec, durationOf(rec) + 5, out())
    const n = rec.frames.length - 7
    expect(end.position.x).toBeCloseTo(rec.frames[n]!, 5)
    expect(end.position.y).toBeCloseTo(rec.frames[n + 1]!, 5)
  })

  it("moves between the frames, with a turn that stays a unit one", () => {
    for (let i = 0; i < 80; i++) {
      const pose = sampleRecording(rec, (i / 79) * durationOf(rec), out())
      expect(pose.quaternion.length()).toBeCloseTo(1, 4)
    }
    const a = sampleRecording(rec, rec.step * 4, out())
    const b = sampleRecording(rec, rec.step * 4.5, out())
    const c = sampleRecording(rec, rec.step * 5, out())
    expect(b.position.distanceTo(a.position.clone().add(c.position).multiplyScalar(0.5))).toBeLessThan(1e-5)
  })

  it("reads a time before the start as the start", () => {
    expect(sampleRecording(rec, -3, out()).position.distanceTo(sampleRecording(rec, 0, out()).position)).toBe(0)
  })
})

describe("impactsOf", () => {
  it("finds the hits of the table, in order, the first the hardest, none that is not a hit", () => {
    const model = dieModel("d6")
    for (const key of ["hit-1", "hit-2", "hit-3"]) {
      const rec = simulate(R, ARENA, [thrown("d6", key)], [], TUNING)[0]!
      const hits = impactsOf(rec, model, SIZE)
      expect(hits.length).toBeGreaterThanOrEqual(1)
      hits.forEach((hit, i) => {
        expect(hit.strength).toBeGreaterThan(0)
        expect(hit.strength).toBeLessThanOrEqual(1)
        expect(hit.at).toBeLessThanOrEqual(durationOf(rec))
        if (i > 0) expect(hit.at).toBeGreaterThan(hits[i - 1]!.at)
      })
      expect(hits[0]!.strength).toBeGreaterThanOrEqual(Math.max(...hits.slice(1).map((h) => h.strength), 0) - 1e-9)
    }
  })
})
