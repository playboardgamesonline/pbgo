import { centreOf, cornersOfBox, type Place, pointInFrame, polygonsOverlap, type TableBox } from "../box"
import type { Spot } from "../layout"

/**
 * The area of a seat that a press counts in to choose its player: a box in the frame of the seat, which the `Hotspot` of the seat stands on. The pure half of choosing a player: where the area lies, how it grows from the cards and the plate it holds until it
 * meets what lies round it, and how the `Hotspot` is given it. `hotspot.tsx` takes the pointer and the keyboard.
 */
export type Area = { frame: Spot; box: TableBox }

/** Where a `Hotspot` stands for an area: the middle of its box on the table, the way its frame faces, and its size. `<Hotspot {...hotspotOf(area)} … />` */
export function hotspotOf({ frame, box }: Area): { at: { x: number; z: number; yaw: number }; width: number; depth: number } {
  return { at: { ...pointInFrame(frame, centreOf(box)), yaw: frame.yaw ?? 0 }, width: box.maxX - box.minX, depth: box.maxZ - box.minZ }
}

/** A box grown by a padding on each of its four sides, in the frame of its seat: to the left, to the right, toward the middle of the table (the least z) and away from it */
export function padBox(box: TableBox, [left, right, inner, outer]: readonly [number, number, number, number]): TableBox {
  return { minX: box.minX - left, maxX: box.maxX + right, minZ: box.minZ - inner, maxZ: box.maxZ + outer }
}

/** How far a side of the padding gives back at a time while something is in its way, in world units, and what the four sides together give back at the corners: a share of what is left of them */
const GIVE_BACK = 0.05
const AT_THE_CORNERS = 0.85
/** The room kept to a thing that the area was not already touching: a hair, so that the two never share an edge */
const A_HAIR = 0.02

/**
 * An area grown from `core`, what it must hold (the cards and the plate of a seat), by `padding` on every side, as far as the room lets it: each side stops short of `avoid`, the shapes on the table that the area keeps clear of (the plates of the other seats,
 * the piles, the buttons), and the sides together, at the corners, give back what is left to give until nothing is touched. A thing that the core is already a hair from is kept clear as it is. Generous areas, so that a click or a tap needs no aim.
 */
export function growBox(core: TableBox, frame: Spot, avoid: readonly (readonly Place[])[], padding: number): TableBox {
  const shape = (box: TableBox) => cornersOfBox(box, frame)
  const room = avoid.map((other) => ({ other, by: polygonsOverlap(shape(core), other, A_HAIR) ? 0 : A_HAIR }))
  const pad: [number, number, number, number] = [0, 0, 0, 0]
  for (let side = 0; side < 4; side++) {
    let value = padding
    const only = (amount: number) => padBox(core, [0, 1, 2, 3].map((i) => (i === side ? amount : 0)) as [number, number, number, number])
    while (value > 0 && room.some(({ other, by }) => polygonsOverlap(shape(only(value)), other, by))) value = Math.max(0, value - GIVE_BACK)
    pad[side] = value
  }
  let box = padBox(core, pad)
  for (let i = 0; i < 40 && avoid.some((other) => polygonsOverlap(shape(box), other)); i++) {
    for (let side = 0; side < 4; side++) pad[side] = pad[side]! * AT_THE_CORNERS
    box = padBox(core, pad)
  }
  return box
}

/** What an area is grown from */
export type AreaSeed = {
  /** The frame of the seat: where it is on the table and the way it faces (`seats`) */
  frame: Spot
  /** What the area must hold, in the frame of the seat, when it has `share` of its padding to give (1, then less while it makes room for its neighbours): a board whose core does not change with the share ignores it */
  core: (share: number) => TableBox
  /** The shapes on the table, in the world, that this area keeps clear of: the plates of the other seats, the piles, the buttons */
  avoid: readonly (readonly Place[])[]
  /** The plate of the seat, in its frame: an area that has to narrow to make room never goes narrower than it. Nothing, by default */
  plate?: TableBox
}

/** The four corners of an area on the table, going round: what it covers, for the tests that keep the areas apart from each other and from the piles */
export const cornersOfArea = ({ frame, box }: Area): Place[] => cornersOfBox(box, frame)

/**
 * The area of every seat of a table, by key, grown from what each holds until it meets its neighbours: each is grown by `padding` (`growBox`), and where two overlap the padding of both gives back, a little at a time, until they only touch. With no padding
 * left to give, an area narrows toward the axis of its seat, never below its `plate`.
 */
export function growAreas<K>(seeds: ReadonlyMap<K, AreaSeed>, padding: number): Map<K, Area> {
  const keys = [...seeds.keys()]
  const share = new Map(keys.map((key) => [key, 1]))
  const build = (key: K): Area => {
    const seed = seeds.get(key)!
    const own = share.get(key)!
    return { frame: seed.frame, box: growBox(seed.core(own), seed.frame, seed.avoid, padding * own) }
  }
  const out = new Map(keys.map((key) => [key, build(key)] as const))
  for (let pass = 0; pass < 60; pass++) {
    let touched = false
    for (let i = 0; i < keys.length; i++) {
      for (let j = i + 1; j < keys.length; j++) {
        if (!polygonsOverlap(cornersOfArea(out.get(keys[i]!)!), cornersOfArea(out.get(keys[j]!)!))) continue
        touched = true
        for (const key of [keys[i]!, keys[j]!]) {
          share.set(key, share.get(key)! * 0.9)
          out.set(key, build(key))
        }
      }
    }
    if (!touched) break
  }
  // last resort, with no padding left: the area narrows along its line, never below its plate
  for (let pass = 0; pass < 100; pass++) {
    let touched = false
    for (let i = 0; i < keys.length; i++) {
      for (let j = i + 1; j < keys.length; j++) {
        if (!polygonsOverlap(cornersOfArea(out.get(keys[i]!)!), cornersOfArea(out.get(keys[j]!)!))) continue
        touched = true
        for (const key of [keys[i]!, keys[j]!]) {
          const { frame, box } = out.get(key)!
          const plate = seeds.get(key)!.plate
          const half = Math.max(plate ? (plate.maxX - plate.minX) / 2 : 0, ((box.maxX - box.minX) / 2) * 0.97)
          out.set(key, { frame, box: { ...box, minX: -half, maxX: half } })
        }
      }
    }
    if (!touched) break
  }
  return out
}
