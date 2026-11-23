import { hotspotOf, type Quad, SEAT_SETTINGS, polygonsOverlap } from "@pbgo/table"
import { describe, expect, it } from "vitest"
import {
  CARD,
  cardsBox,
  FIRST_OPPONENT,
  fixedBoxes,
  FLOOR,
  floorPlan,
  frameOf,
  heldBox,
  heldPoses,
  LAYOUT_SETTINGS,
  lineGap,
  linePoses,
  lines,
  opponentScaleOf,
  pilePlaces,
  plateBox,
  seatSpots,
  TABLE_PLAYERS,
  tableQuads,
  tableShapes,
  zoneAreas,
} from "./layout"

const ids = (n: number) => Array.from({ length: n }, (_, i) => `p${i}`)
const SIZES = [3, 4, 5, 6, 7, 8]

/** The setups a table is checked in: the viewer seated, and a spectator with no seat */
const SETUPS = [true, false]

describe("the arrangement of the seats", () => {
  it("gives the angle of the first opponent of every table the game plays, 3 to 8, further from the front the fewer there are", () => {
    let before = 360
    for (let n = TABLE_PLAYERS[0]; n <= TABLE_PLAYERS[1]; n++) {
      const first = FIRST_OPPONENT[n]!
      expect(first, `${n} players`).toBeGreaterThanOrEqual(60)
      expect(first, `${n} players`).toBeLessThanOrEqual(before)
      before = first
    }
    expect(FIRST_OPPONENT).toEqual({ 3: 145, 4: 90, 5: 90, 6: 66, 7: 62, 8: 60 })
  })

  it("makes the opponents mirror each other across the axis of the viewer", () => {
    for (const n of SIZES) {
      const spots = [...seatSpots(ids(n), "p0").values()]
      for (let i = 1; i < n; i++) {
        expect(spots[i]!.x, `${n} players, seats ${i} and ${n - i}`).toBeCloseTo(-spots[n - i]!.x)
        expect(spots[i]!.z, `${n} players, seats ${i} and ${n - i}`).toBeCloseTo(spots[n - i]!.z)
      }
    }
  })

  it("makes the cards of the opponents the smaller the fuller the table, and a little smaller for a spectator of a full table", () => {
    let before = Infinity
    for (const n of SIZES) {
      const scale = opponentScaleOf(n, true)
      expect(scale, `${n} players`).toBeLessThan(before)
      before = scale
    }
    expect(opponentScaleOf(8, false)).toBeLessThan(opponentScaleOf(8, true))
  })
})

describe("the seats", () => {
  it("put the viewer in front, upright, and give every other seat the yaw that turns it to face the middle", () => {
    for (const n of SIZES) {
      const spots = seatSpots(ids(n), "p1")
      expect(spots.size, `${n} players`).toBe(n)
      expect(spots.get("p1"), `${n} players: the viewer`).toMatchObject({ x: 0, yaw: 0 })
      expect(spots.get("p1")!.z).toBeGreaterThan(0)
      for (const [id, spot] of spots) {
        if (id === "p1") continue
        // a face-up card's top edge points along -z at yaw 0; turned by the yaw it points at the middle of the table, as a seated player reads it
        const top = { x: -Math.sin(spot.yaw), z: -Math.cos(spot.yaw) }
        const toMiddle = { x: -spot.x / Math.hypot(spot.x, spot.z), z: -spot.z / Math.hypot(spot.x, spot.z) }
        expect(top.x, `${n} players: ${id}`).toBeCloseTo(toMiddle.x)
        expect(top.z, `${n} players: ${id}`).toBeCloseTo(toMiddle.z)
      }
    }
  })

  it("stand in the upper corners for three and one on each side for four", () => {
    const at = (n: number) => [...seatSpots(ids(n), "p0").values()]
    const [, left3, right3] = at(3)
    expect(left3!.x).toBeLessThan(0)
    expect(right3!.x).toBeGreaterThan(0)
    expect(left3!.z).toBeLessThan(0)
    expect(right3!.z).toBeLessThan(0)
    const [, left, top, right] = at(4)
    expect(left!.yaw).toBeCloseTo(-Math.PI / 2)
    expect(right!.yaw).toBeCloseTo(Math.PI / 2)
    expect(Math.abs(top!.yaw)).toBeCloseTo(Math.PI)
  })

  it("go round on both sides, whatever the size of the table, and make the turn pass to the viewer's left", () => {
    for (const n of SIZES) {
      const spots = seatSpots(ids(n), "p0")
      const xs = [...spots.values()].slice(1).map((spot) => spot.x)
      expect(xs.some((x) => x < -1), `${n} players: left`).toBe(true)
      expect(xs.some((x) => x > 1), `${n} players: right`).toBe(true)
      expect(spots.get("p1")!.x, `${n} players`).toBeLessThan(0)
      expect(spots.get(`p${n - 1}`)!.x, `${n} players`).toBeGreaterThan(0)
    }
  })

  it("seat a spectator, who has no seat, with nobody in front", () => {
    for (const n of SIZES) {
      const spots = [...seatSpots(ids(n), null).values()]
      expect(spots.some((spot) => Math.abs(spot.x) < 1e-6 && spot.z > 0)).toBe(false)
      expect(new Set(spots.map((spot) => spot.x.toFixed(3) + spot.z.toFixed(3))).size).toBe(n)
    }
  })
})

describe("the lines of the players", () => {
  it("give every player one, the viewer's in front of them and as wide as the room the seats beside it leave", () => {
    for (const n of SIZES) {
      const all = lines(seatSpots(ids(n), "p0"), "p0")
      expect([...all.keys()].sort()).toEqual(ids(n).sort())
      expect(all.get("p0")!.at.z).toBe(LAYOUT_SETTINGS.viewerZ)
      expect(all.get("p0")!.yaw).toBe(0)
      expect(all.get("p0")!.width, `${n} players`).toBeLessThanOrEqual(LAYOUT_SETTINGS.viewerWidth)
      expect(all.get("p0")!.width, `${n} players`).toBeGreaterThanOrEqual(CARD.width * 4)
    }
  })

  it("keep an opponent's on its seat, turned to face the middle as its player does", () => {
    for (const n of SIZES) {
      const spots = seatSpots(ids(n), "p0")
      for (const [id, line] of lines(spots, "p0")) {
        if (id === "p0") continue
        expect(line.at, `${n} players: ${id}`).toEqual({ x: spots.get(id)!.x, z: spots.get(id)!.z })
        expect(line.yaw, `${n} players: ${id}`).toBe(spots.get(id)!.yaw)
        expect(frameOf(line), `${n} players: ${id}`).toEqual(spots.get(id))
      }
    }
  })

  it("never run into each other, nor into a plate, a pile or the button, even when every line takes all the room it may: no two shapes of the table overlap, at every size of table, for a player and for a spectator", () => {
    for (const seated of SETUPS) {
      for (const n of SIZES) {
        const shapes = tableShapes(n, true, seated)
        for (let i = 0; i < shapes.length; i++) {
          for (let j = i + 1; j < shapes.length; j++) {
            expect(polygonsOverlap(shapes[i]!.shape, shapes[j]!.shape), `${n} players${seated ? "" : ", spectator"}: ${shapes[i]!.name} and ${shapes[j]!.name}`).toBe(false)
          }
        }
      }
    }
  })

  it("give a lone opponent all the room of the table", () => {
    const only = lines(seatSpots(ids(2), "p0"), "p0").get("p1")!
    expect(only.width).toBe(LAYOUT_SETTINGS.viewerWidth)
  })

  it("give an opponent a room for a few cards at least, however full the table", () => {
    for (const n of SIZES) for (const [id, line] of lines(seatSpots(ids(n), "p0"), "p0")) if (id !== "p0") expect(line.width, `${n} players: ${id}`).toBeGreaterThanOrEqual(CARD.width * line.scale * 2.5)
  })
})

describe("the plates", () => {
  const placed = (n: number, seated = true) => {
    const viewer = seated ? "p0" : null
    return lines(seatSpots(ids(n), viewer), viewer)
  }

  it("stand on the side of the line that faces the middle of the table, at every seat and the viewer's too: above the cards in the frame of the seat", () => {
    for (const seated of SETUPS) {
      for (const n of SIZES) {
        for (const [id, line] of placed(n, seated)) {
          const cards = cardsBox(line)
          const plate = plateBox(line)
          expect(plate.maxZ, `${n} players: ${id}`).toBeLessThanOrEqual(cards.minZ + 1e-9)
          // the plate is centred on the axis of the seat, like the line
          expect((plate.minX + plate.maxX) / 2, `${n} players: ${id}`).toBeCloseTo(0)
        }
      }
    }
  })

  it("stand clear of the line by the gap of the kit's plate, so that nothing lies under the plate", () => {
    for (const n of SIZES) for (const [id, line] of placed(n)) expect(cardsBox(line).minZ - plateBox(line).maxZ, `${n} players: ${id}`).toBeCloseTo(SEAT_SETTINGS.plateGap)
  })

  it("lie nearer to the middle of the table than their line, for every seat", () => {
    for (const n of SIZES) {
      for (const [id, line] of placed(n)) {
        const frame = frameOf(line)
        const box = plateBox(line)
        // the middle of the plate on the table
        const x = frame.x + ((box.minX + box.maxX) / 2) * Math.cos(frame.yaw) + ((box.minZ + box.maxZ) / 2) * Math.sin(frame.yaw)
        const z = frame.z - ((box.minX + box.maxX) / 2) * Math.sin(frame.yaw) + ((box.minZ + box.maxZ) / 2) * Math.cos(frame.yaw)
        expect(Math.hypot(x, z), `${n} players: ${id}`).toBeLessThan(Math.hypot(frame.x, frame.z))
      }
    }
  })
})

describe("a line of cards", () => {
  const line = { scale: 1, width: 10 }
  const widest = CARD.width * LAYOUT_SETTINGS.gap

  it("spreads at the widest gap while it fits", () => {
    expect(lineGap(1, line)).toBe(widest)
    expect(lineGap(4, line)).toBeCloseTo(widest)
  })

  it("draws its cards closer, over one another, when it does not fit", () => {
    const gap = lineGap(12, line)
    expect(gap).toBeLessThan(widest)
    // the whole line, the last card included, is no wider than the room it has
    expect(gap * 11 + CARD.width).toBeLessThanOrEqual(line.width + 1e-9)
  })

  it("never goes closer than the closest gap, so that the figure of each card can be read", () => {
    expect(lineGap(14, { scale: 0.62, width: 1.2 })).toBeCloseTo(CARD.width * 0.62 * LAYOUT_SETTINGS.closest)
  })

  it("is a row centred on its seat, the first card on the left and each one a hair above the one before", () => {
    const poses = linePoses(5, line)
    expect(poses).toHaveLength(5)
    expect(poses.map((pose) => pose.position.x).reduce((sum, x) => sum + x, 0)).toBeCloseTo(0)
    for (let i = 1; i < poses.length; i++) {
      expect(poses[i]!.position.x).toBeGreaterThan(poses[i - 1]!.position.x)
      expect(poses[i]!.position.y).toBeGreaterThan(poses[i - 1]!.position.y)
    }
    expect(poses.every((pose) => pose.scale === 1)).toBe(true)
  })

  it("is nothing for no card", () => {
    expect(linePoses(0, line)).toEqual([])
  })
})

describe("the cards set aside during a Flip Three", () => {
  it("lie beyond their line, on the side of the player, away from the middle of the table, where the plate is not", () => {
    const line = { at: { x: 2, z: -2.6 }, yaw: Math.PI, scale: 0.62, width: 2 }
    const poses = heldPoses(3, line)
    expect(poses).toHaveLength(3)
    // in the frame of the seat, whose least z is toward the middle: beyond the line is a greater z
    for (const pose of poses) expect(pose.position.z).toBeGreaterThan(cardsBox(line).maxZ - CARD.height * line.scale * 0.5)
    expect(heldBox(line).minZ).toBeGreaterThanOrEqual(cardsBox(line).minZ)
    expect(heldBox(line).maxZ).toBeGreaterThan(cardsBox(line).maxZ)
    expect(plateBox(line).maxZ).toBeLessThan(heldBox(line).minZ)
  })

  it("are smaller than the line, in a row of their own", () => {
    const poses = heldPoses(3, { scale: 1 })
    expect(poses[0]!.scale).toBeLessThan(1)
  })
})

describe("the piles", () => {
  it("lie either side of the middle of the table", () => {
    const { deck, discard } = pilePlaces()
    expect(deck.x).toBeLessThan(0)
    expect(discard.x).toBeGreaterThan(0)
    expect(deck.z).toBe(discard.z)
  })
})

describe("the floor between the piles", () => {
  const plan = floorPlan()
  const { deck, discard } = pilePlaces()
  const pile = (CARD.width * LAYOUT_SETTINGS.pileScale) / 2
  const edges = (pad: { x: number; width: number }) => [pad.x - pad.width / 2, pad.x + pad.width / 2] as const

  it("has one pad, for Stay and for Deal, as deep as the piles and on their line", () => {
    expect(plan.pad.depth).toBeCloseTo(CARD.height * LAYOUT_SETTINGS.pileScale)
    expect(plan.pad.z).toBe(deck.z)
  })

  it("keeps one gap, the same length, between the draw pile and the pad and between the pad and the discard", () => {
    const [left, right] = edges(plan.pad)
    expect(left - (deck.x + pile)).toBeCloseTo(FLOOR.gap)
    expect(discard.x - pile - right).toBeCloseTo(FLOOR.gap)
  })

  it("puts the action card where the pad begins, and nothing runs into the discard", () => {
    const [padLeft] = edges(plan.pad)
    expect(plan.card.x - (CARD.width * plan.card.scale) / 2).toBeCloseTo(padLeft)
    expect(discard.x - pile - (plan.card.x + (CARD.width * plan.card.scale) / 2)).toBeGreaterThan(FLOOR.gap)
  })

  it("lies clear of the viewer's line and of the plate above it, in the middle band", () => {
    const line = lines(seatSpots(ids(5), "p0"), "p0").get("p0")!
    expect(plan.strip.z + plan.strip.depth / 2).toBeLessThan(line.at.z - (CARD.height * line.scale) / 2)
    const plate = plateBox(line)
    // the box of the plate in the world: the viewer's frame is the world's
    expect(line.at.z + plate.maxZ).toBeLessThan(line.at.z + cardsBox(line).minZ)
  })

  it("keeps the room for the count under the draw pile and for the word over it", () => {
    const [strip, deckBox] = fixedBoxes()
    expect(strip!.name).toBe("strip")
    expect(deckBox!.name).toBe("draw pile")
    expect(deckBox!.box.maxZ).toBeGreaterThan(deck.z + (CARD.height * LAYOUT_SETTINGS.pileScale) / 2 + 0.5)
    expect(deckBox!.box.minZ).toBeLessThan(deck.z - (CARD.height * LAYOUT_SETTINGS.pileScale) / 2 - 1)
  })
})

describe("the areas the viewer presses to give a card", () => {
  const setup = (n: number, seated: boolean) => {
    const viewer = seated ? "0" : null
    const names = Array.from({ length: n }, (_, i) => String(i))
    const placed = lines(seatSpots(names, viewer), viewer)
    const areas = zoneAreas(n, seated)
    return names.map((id, i) => ({ id, area: areas[i]!, line: placed.get(id)! }))
  }
  const shapeOf = ({ frame, box }: (typeof setup extends (...a: never[]) => (infer T)[] ? T : never)["area"]): Quad => {
    const { at, width, depth } = hotspotOf({ frame, box })
    const [c, s] = [Math.cos(at.yaw ?? 0), Math.sin(at.yaw ?? 0)]
    return [
      [-1, -1],
      [1, -1],
      [1, 1],
      [-1, 1],
    ].map(([a, b]) => ({ x: at.x + (a! * width * c) / 2 + (b! * depth * s) / 2, z: at.z - (a! * width * s) / 2 + (b! * depth * c) / 2 }))
  }

  it("never overlap each other, from 3 to 8 players, for a player and for a spectator", () => {
    for (const seated of SETUPS) {
      for (const n of SIZES) {
        const all = setup(n, seated)
        all.forEach((a, i) => all.slice(i + 1).forEach((b) => expect(polygonsOverlap(shapeOf(a.area), shapeOf(b.area)), `${n} players, seated ${seated}: areas ${a.id} and ${b.id}`).toBe(false)))
      }
    }
  })

  it("never overlap the plate of another seat, the piles or the strip of the buttons", () => {
    for (const seated of SETUPS) {
      for (const n of SIZES) {
        const all = setup(n, seated)
        const fixed = tableShapes(n, false, seated).filter(({ name }) => !name.startsWith("line of") && !name.startsWith("plate of"))
        for (const { id, area } of all) {
          for (const other of all.filter((item) => item.id !== id)) {
            const plate = tableShapes(n, false, seated).find(({ name }) => name === `plate of seat ${other.id}`)!
            expect(polygonsOverlap(shapeOf(area), plate.shape), `${n} players, seated ${seated}: area ${id} and the plate of ${other.id}`).toBe(false)
          }
          for (const { name, shape } of fixed) expect(polygonsOverlap(shapeOf(area), shape), `${n} players, seated ${seated}: area ${id} and the ${name}`).toBe(false)
        }
      }
    }
  })

  it("hold the plate of their seat, whole, and the cards of its line: one area for the play area and the name", () => {
    for (const seated of SETUPS) {
      for (const n of SIZES) {
        for (const { id, area, line } of setup(n, seated)) {
          const plate = plateBox(line)
          expect(area.box.minX, `${n} players, seated ${seated}, area ${id}: the plate`).toBeLessThanOrEqual(plate.minX + 1e-9)
          expect(area.box.maxX, `${n} players, seated ${seated}, area ${id}: the plate`).toBeGreaterThanOrEqual(plate.maxX - 1e-9)
          expect(area.box.minZ, `${n} players, seated ${seated}, area ${id}: the plate`).toBeLessThanOrEqual(plate.minZ + 1e-9)
          // a few cards of the line, at least
          const cards = cardsBox(line, Math.min(line.width, CARD.width * line.scale * 3))
          expect(area.box.minX, `${n} players, seated ${seated}, area ${id}: the cards`).toBeLessThanOrEqual(cards.minX + 1e-9)
          expect(area.box.maxX, `${n} players, seated ${seated}, area ${id}: the cards`).toBeGreaterThanOrEqual(cards.maxX - 1e-9)
          expect(area.box.maxZ, `${n} players, seated ${seated}, area ${id}: the cards`).toBeGreaterThanOrEqual(cards.maxZ - 1e-9)
        }
      }
    }
  })

  it("take a press on the name: the middle of the plate is inside the area", () => {
    for (const n of SIZES) {
      for (const { id, area, line } of setup(n, true)) {
        const plate = plateBox(line)
        const [x, z] = [(plate.minX + plate.maxX) / 2, (plate.minZ + plate.maxZ) / 2]
        expect(x >= area.box.minX && x <= area.box.maxX && z >= area.box.minZ && z <= area.box.maxZ, `${n} players, area ${id}`).toBe(true)
      }
    }
  })

  it("are padded on the sides with room: bigger than the play area they hold", () => {
    for (const n of [3, 4]) {
      for (const { id, area, line } of setup(n, true)) {
        expect(area.box.maxZ - area.box.minZ, `${n} players, area ${id}`).toBeGreaterThan(CARD.height * line.scale + (plateBox(line).maxZ - plateBox(line).minZ))
      }
    }
  })

  it("are big enough to hit: at least a card across on the short side", () => {
    for (const n of SIZES) for (const { id, area } of setup(n, true)) expect(Math.min(area.box.maxX - area.box.minX, area.box.maxZ - area.box.minZ), `${n} players, area ${id}`).toBeGreaterThan(CARD.width * 0.8)
  })
})

describe("the footprints of a table", () => {
  it("are the plate and the line of each seat, the two piles, the strip between them and the area of each seat, whatever the number of players", () => {
    for (const n of SIZES) expect(tableQuads(n), `${n} players`).toHaveLength(2 * n + 3 + n)
  })

  it("are four corners with some area between them", () => {
    for (const n of SIZES)
      for (const quad of tableQuads(n)) {
        expect(quad).toHaveLength(4)
        // the shoelace formula: a turned rectangle has the same area whichever way it is turned
        const area = Math.abs(quad.reduce((sum, corner, i) => sum + corner.x * quad[(i + 1) % 4]!.z - quad[(i + 1) % 4]!.x * corner.z, 0)) / 2
        expect(area, `${n} players`).toBeGreaterThan(0.5)
      }
  })

  it("put the viewer's plate above its line, toward the middle of the table", () => {
    for (const n of SIZES) {
      const [plate, line] = tableQuads(n)
      expect(Math.max(...plate!.map((corner) => corner.z)), `${n} players`).toBeLessThanOrEqual(Math.min(...line!.map((corner) => corner.z)) + 1e-9)
    }
  })
})
