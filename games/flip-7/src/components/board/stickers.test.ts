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
    it(`lie by the line of each seat of a table of ${n}, upright from the viewer's side, the badge toward the middle`, () => {
      const placed = lines(seatSpots(ids(n), "p0"), "p0")
      for (const [id, line] of placed) {
        const { bust, bonus } = stickerPlaces(line, BUST, BONUS)
        // the stamp is across the middle of the line
        expect(bust.x, id).toBeCloseTo(line.at.x, 9)
        expect(bust.z, id).toBeCloseTo(line.at.z, 9)
        // neither is ever read upside down
        expect(away(bust.yaw), id).toBeLessThanOrEqual(90 + 1e-6)
        expect(away(bonus.yaw), id).toBeLessThanOrEqual(90 + 1e-6)
        // the badge lies nearer to the middle of the table than the line does, by about the room it takes
        expect(Math.hypot(bonus.x, bonus.z), id).toBeLessThan(Math.hypot(line.at.x, line.at.z))
      }
    })
  }

  it("grow and shrink with the line: an opponent's line is smaller than the viewer's, and so are its stickers", () => {
    const placed = lines(seatSpots(ids(8), "p0"), "p0")
    const [mine, theirs] = [placed.get("p0")!, placed.get("p4")!]
    expect(theirs.scale).toBeLessThan(mine.scale)
    expect(stickerPlaces(theirs, BUST, BONUS).bust.width).toBeLessThan(stickerPlaces(mine, BUST, BONUS).bust.width)
    expect(stickerPlaces(mine, BUST, BONUS).bust.width / (CARD.width * mine.scale)).toBeGreaterThan(2)
  })

  it("put the badge above the viewer's own line, on the side of the middle, and clear of the plate below it", () => {
    const line = lines(seatSpots(ids(5), "p0"), "p0").get("p0")!
    const { bonus } = stickerPlaces(line, BUST, BONUS)
    expect(bonus.x).toBeCloseTo(line.at.x, 9)
    expect(bonus.z).toBeLessThan(line.at.z - (CARD.height * line.scale) / 2 * 0.99)
  })
})
