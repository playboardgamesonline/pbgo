import { describe, expect, it } from "vitest"
import { fan, row } from "../layout"
import { onTable } from "../pose"
import { place, STAGGER } from "./place"

const none = (n: number) => Array.from({ length: n }, () => undefined)

describe("place", () => {
  it("gives each card the slot of its own number", () => {
    const layout = row(3, { gap: 1 })
    const placed = place(none(3), { layout })
    expect(placed).toHaveLength(3)
    placed.forEach(({ target }, i) => expect(target).toBe(layout[i]))
  })

  it("leaves out the cards that have no slot, and the slots that have no card", () => {
    const layout = row(3, { gap: 1 })
    expect(place(none(5), { layout })).toHaveLength(3)
    expect(place(none(2), { layout })).toHaveLength(2)
    expect(place(none(0), { layout })).toHaveLength(0)
    expect(place(none(3), { layout: [] })).toHaveLength(0)
  })

  it("puts the slots in the frame of the zone, whose spot turns them", () => {
    const layout = row(2, { gap: 2 })
    const placed = place(none(2), { frame: { x: 10, z: 5, yaw: Math.PI }, layout })
    // A half turn: what lay on the left of the zone lies on its right
    expect(placed[0].target.position.x).toBeCloseTo(11, 12)
    expect(placed[1].target.position.x).toBeCloseTo(9, 12)
    expect(placed[0].target.position.z).toBeCloseTo(5, 12)
    // and the slots themselves are not touched
    expect(layout[0].position.x).toBe(-1)
  })

  it("makes a card come from nowhere when it has no from and the zone has no entrance", () => {
    for (const { from } of place(none(3), { layout: row(3, { gap: 1 }) })) expect(from).toBeUndefined()
  })

  it("makes the cards come in from the entrance of the zone, each a stagger after the one before", () => {
    const enter = onTable(0, -0.5, { y: 3.2, face: "down", scale: 0.9 })
    const placed = place(none(4), { layout: fan(4, { gap: 1 }), enter })
    placed.forEach(({ from }, i) => {
      expect(from).not.toBeNull()
      expect(from?.position).toBe(enter.position)
      expect(from?.quaternion).toBe(enter.quaternion)
      expect(from?.scale).toBe(0.9)
      expect(from?.delay).toBeCloseTo(i * STAGGER, 12)
    })
    expect(STAGGER).toBe(0.08)
  })

  it("adds the stagger to the delay of the entrance, and takes the stagger it is given", () => {
    const placed = place(none(3), { layout: row(3, { gap: 1 }), enter: onTable(0, 0, { delay: 0.5 }), stagger: 0.2 })
    expect(placed.map(({ from }) => from?.delay)).toEqual([0.5, 0.7, 0.9])
    const together = place(none(3), { layout: row(3, { gap: 1 }), enter: onTable(0, 0), stagger: 0 })
    expect(together.map(({ from }) => from?.delay)).toEqual([0, 0, 0])
  })

  it("leaves the entrance alone", () => {
    const enter = onTable(0, -0.5, { y: 3.2 })
    place(none(3), { layout: row(3, { gap: 1 }), enter })
    expect("delay" in enter).toBe(false)
  })

  it("lets a card's own from win over the entrance, and null switch its flight off", () => {
    const own = onTable(4, 4, { delay: 0.1 })
    const placed = place([own, null, undefined], { layout: row(3, { gap: 1 }), enter: onTable(0, 0) })
    expect(placed[0].from).toBe(own)
    expect(placed[1].from).toBeNull()
    expect(placed[2].from?.delay).toBeCloseTo(2 * STAGGER, 12)
  })
})
