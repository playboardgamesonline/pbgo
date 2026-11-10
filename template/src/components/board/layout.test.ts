import { describe, expect, it } from "vitest"
import { BID, bidPose, bidRowPose, CLOCK, seats } from "./layout"
import { CARD_SIZE } from "./textures"

type Rect = { x: number; z: number; yaw: number; width: number; depth: number }

/** The card a pose lays on the table, as a rectangle on it: where its middle is, how it is turned, and how wide and deep it is */
function cardAt(pose: { position: { x: number; z: number } }, yaw: number, scale: number): Rect {
  return { x: pose.position.x, z: pose.position.z, yaw, width: CARD_SIZE.width * scale, depth: CARD_SIZE.height * scale }
}

/** Whether two rectangles on the table overlap, by the axes of their sides: they are apart when a gap shows on any of them */
function overlap(a: Rect, b: Rect): boolean {
  const axes = [a, b].flatMap((rect) => [
    [Math.cos(rect.yaw), -Math.sin(rect.yaw)],
    [Math.sin(rect.yaw), Math.cos(rect.yaw)],
  ])
  const reach = (rect: Rect, [ax, az]: number[]) => {
    const along = [Math.cos(rect.yaw), -Math.sin(rect.yaw)]
    const across = [Math.sin(rect.yaw), Math.cos(rect.yaw)]
    return (rect.width / 2) * Math.abs(along[0]! * ax! + along[1]! * az!) + (rect.depth / 2) * Math.abs(across[0]! * ax! + across[1]! * az!)
  }
  return axes.every((axis) => Math.abs((b.x - a.x) * axis[0]! + (b.z - a.z) * axis[1]!) < reach(a, axis) + reach(b, axis))
}

const ids = (count: number) => Array.from({ length: count }, (_, i) => `p${i}`)

describe("the bid cards of the table", () => {
  it("lie in a row across the middle, the lowest bid on the left and the row centred", () => {
    const row = Array.from({ length: 6 }, (_, k) => bidRowPose(k, 6).position)
    expect(row.map((place) => place.x)).toEqual([...row.map((place) => place.x)].sort((a, b) => a - b))
    expect(row[0]!.x).toBeCloseTo(-row[5]!.x, 6)
    row.forEach((place) => expect(place.z).toBeCloseTo(BID.z, 6))
    expect(row[1]!.x - row[0]!.x).toBeCloseTo(BID.gap, 6)
  })

  it("never touch one another in the row, however many there are", () => {
    for (const count of [1, 2, 6, 11]) {
      const row = Array.from({ length: count }, (_, k) => cardAt(bidRowPose(k, count), 0, BID.scale))
      for (let i = 0; i < count; i++) for (let j = i + 1; j < count; j++) expect(overlap(row[i]!, row[j]!), `${i} and ${j} of ${count}`).toBe(false)
    }
  })

  it("rise toward the viewer when the pointer is over one", () => {
    const rest = bidRowPose(3, 6)
    const raised = bidRowPose(3, 6, true)
    expect(raised.position.y).toBeGreaterThan(rest.position.y)
    expect(raised.position.z).toBeGreaterThan(rest.position.z)
  })

  it("lie face up or face down at the seat, on the line to the middle, turned as the seat is", () => {
    const seat = seats(ids(4), "p0").get("p2")!
    const up = bidPose(seat, true)
    const down = bidPose(seat, false)
    expect(up.position.x).toBeCloseTo(seat.x * BID.toward, 6)
    expect(up.position.z).toBeCloseTo(seat.z * BID.toward, 6)
    // The two lie on the same spot, one turned over
    expect(down.position.equals(up.position)).toBe(true)
    expect(down.quaternion.equals(up.quaternion)).toBe(false)
  })

  it("leave room for one another, for the clock and for the row, at a table of two to six players, whoever the viewer is", () => {
    for (let count = 2; count <= 6; count++) {
      for (let viewer = 0; viewer < count; viewer++) {
        const players = ids(count)
        const ring = seats(players, players[viewer]!)
        const bids = players.map((id) => cardAt(bidPose(ring.get(id)!, true), ring.get(id)!.yaw, BID.scale))
        // The most bids a viewer can make: eleven cards, from none to ten
        const row = Array.from({ length: 11 }, (_, k) => cardAt(bidRowPose(k, 11), 0, BID.scale))
        for (let i = 0; i < bids.length; i++) {
          for (let j = i + 1; j < bids.length; j++) expect(overlap(bids[i]!, bids[j]!), `bids of ${i} and ${j}, ${count} players, viewer ${viewer}`).toBe(false)
          row.forEach((card, k) => expect(overlap(bids[i]!, card), `bid of ${i} and row card ${k}, ${count} players, viewer ${viewer}`).toBe(false))
          // The hourglass takes a disc of about its own width
          const clock: Rect = { x: CLOCK.at.x, z: CLOCK.at.z, yaw: 0, width: CLOCK.size * 0.9, depth: CLOCK.size * 0.9 }
          expect(overlap(bids[i]!, clock), `bid of ${i} and the clock, ${count} players, viewer ${viewer}`).toBe(false)
        }
        row.forEach((card, k) => expect(overlap(card, { x: CLOCK.at.x, z: CLOCK.at.z, yaw: 0, width: CLOCK.size * 0.9, depth: CLOCK.size * 0.9 }), `row card ${k} and the clock`).toBe(false))
      }
    }
  })
})
