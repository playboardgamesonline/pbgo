import { describe, expect, it } from "vitest"
import { CARD, lines, seatSpots, stickerPlaces } from "./layout"

const ids = (n: number) => Array.from({ length: n }, (_, i) => `p${i}`)
const SIZES = [3, 4, 5, 6, 7, 8]
/** The proportions of the two pictures: the BUST! stamp is 266 by 148, the bonus badge 660 by 400 */
const BUST = 266.25 / 148.5
const BONUS = 660 / 400

/** How far a turn is from upright, in degrees */
const away = (yaw: number) => (Math.abs(Math.atan2(Math.sin(yaw), Math.cos(yaw))) * 180) / Math.PI

describe("the stickers of a seat", () => {
  for (const n of SIZES) {
    it(`lie by the line of each seat of a table of ${n}, upright from the viewer's side, the badge away from the middle`, () => {
      const placed = lines(seatSpots(ids(n), "p0"), "p0")
      for (const [id, line] of placed) {
        const { bust, bonus } = stickerPlaces(line, BUST, BONUS)
        // the stamp is across the middle of the line
        expect(bust.x, id).toBeCloseTo(line.at.x, 9)
        expect(bust.z, id).toBeCloseTo(line.at.z, 9)
        // neither is ever read upside down
        expect(away(bust.yaw), id).toBeLessThanOrEqual(90 + 1e-6)
        expect(away(bonus.yaw), id).toBeLessThanOrEqual(90 + 1e-6)
        // the badge lies farther from the middle of the table than the line does, by about the room it takes: the plate stands on the other side
        expect(Math.hypot(bonus.x, bonus.z), id).toBeGreaterThan(Math.hypot(line.at.x, line.at.z))
      }
    })
  }

  it("grow and shrink with the cards of the table: every line of a table has the same size of stickers, and a fuller table has smaller ones", () => {
    const [few, full] = [lines(seatSpots(ids(3), "p0"), "p0"), lines(seatSpots(ids(8), "p0"), "p0")]
    const widths = (placed: typeof few) => [...placed.values()].map((line) => stickerPlaces(line, BUST, BONUS).bust.width)
    expect(new Set(widths(full)).size).toBe(1)
    expect(new Set(widths(few)).size).toBe(1)
    expect(widths(full)[0]!).toBeLessThan(widths(few)[0]!)
    const mine = full.get("p0")!
    expect(stickerPlaces(mine, BUST, BONUS).bust.width / (CARD.width * mine.scale)).toBeGreaterThan(2)
  })

  it("put the badge below the viewer's own line, on their side of it, and clear of the plate above it", () => {
    const line = lines(seatSpots(ids(5), "p0"), "p0").get("p0")!
    const { bonus } = stickerPlaces(line, BUST, BONUS)
    expect(bonus.x).toBeCloseTo(line.at.x, 9)
    expect(bonus.z).toBeGreaterThan(line.at.z + ((CARD.height * line.scale) / 2) * 0.99)
  })
})
