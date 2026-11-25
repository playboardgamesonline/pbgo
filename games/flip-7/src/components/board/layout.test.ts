import { cornersOfArea, cornersOfBox, hotspotOf, type Quad, SEAT_SETTINGS, polygonsOverlap } from "@pbgo/table"
import { describe, expect, it } from "vitest"
import {
  CARD,
  cardScaleOf,
  cardsBox,
  chairsOf,
  dealtFrom,
  FIRST_OPPONENT,
  fixedBoxes,
  FLOOR,
  floorPlan,
  frameOf,
  heldBox,
  heldPoses,
  heldShapes,
  LAYOUT_SETTINGS,
  lineGap,
  linePoses,
  lines,
  pilePlaces,
  plateBox,
  seatSpots,
  stripShift,
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
    expect(FIRST_OPPONENT).toEqual({ 3: 136, 4: 90, 5: 87, 6: 69, 7: 60, 8: 60 })
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
})

describe("the cards that lie on the table", () => {
  it("are all of one size, as at a real table: the line of the viewer and those of the opponents, the cards set aside, the draw pile, the discard and the action card to give, and the cards dealt", () => {
    const failures: string[] = []
    for (const seated of SETUPS) {
      for (const n of SIZES) {
        const chairs = chairsOf(n, seated)
        const scale = cardScaleOf(chairs)
        const label = `${n} players${seated ? "" : ", spectator"}`
        const viewer = seated ? "p0" : null
        for (const [id, line] of lines(seatSpots(ids(n), viewer), viewer)) {
          if (line.scale !== scale) failures.push(`${label}: the line of ${id} is at ${line.scale}, not ${scale}`)
          for (const pose of linePoses(6, line)) if (pose.scale !== scale) failures.push(`${label}: a card of the line of ${id} is at ${pose.scale}`)
          for (const pose of heldPoses(3, line)) if (pose.scale !== scale) failures.push(`${label}: a card set aside by ${id} is at ${pose.scale}`)
        }
        if (floorPlan(chairs).card.scale !== scale) failures.push(`${label}: the action card to give is at ${floorPlan(chairs).card.scale}`)
        if (dealtFrom(chairs).scale !== scale) failures.push(`${label}: the cards are dealt at ${dealtFrom(chairs).scale}`)
        // the piles are as wide as a card of the table, and the strip between them is measured from them
        const [strip, deck, discard] = fixedBoxes(chairs)
        for (const pile of [deck!, discard!]) if (Math.abs(pile.box.maxX - pile.box.minX - CARD.width * scale) > 1e-9) failures.push(`${label}: the ${pile.name} is not as wide as a card`)
        if (Math.abs(floorPlan(chairs).strip.width - (strip!.box.maxX - strip!.box.minX)) > 1e-9) failures.push(`${label}: the strip is not the one between the piles`)
      }
    }
    expect(failures).toEqual([])
  })

  it("are smaller as the table fills, from the table of three to the table of eight, a spectator's one with its extra chair included", () => {
    let before = Infinity
    for (let chairs = TABLE_PLAYERS[0]; chairs <= TABLE_PLAYERS[1] + 1; chairs++) {
      expect(cardScaleOf(chairs), `${chairs} chairs`).toBeLessThanOrEqual(before + 1e-9)
      before = cardScaleOf(chairs)
    }
    expect(cardScaleOf(3)).toBeCloseTo(LAYOUT_SETTINGS.cardScale3, 9)
    expect(cardScaleOf(8)).toBeCloseTo(LAYOUT_SETTINGS.cardScale8, 9)
    expect(cardScaleOf(8)).toBeLessThan(cardScaleOf(3))
  })

  it("are laid for the chairs of the table, one more for a spectator, who has none in front", () => {
    expect(chairsOf(5)).toBe(5)
    expect(chairsOf(5, false)).toBe(6)
    expect(cardScaleOf(chairsOf(5, false))).toBeLessThan(cardScaleOf(chairsOf(5)))
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
      expect(all.get("p0")!.width, `${n} players`).toBeGreaterThanOrEqual(CARD.width * all.get("p0")!.scale * 4)
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
  const line = { at: { x: 2, z: -2.6 }, yaw: Math.PI, scale: 0.62, width: 2.8 }

  it("lie beyond their line, on the side of the player, away from the middle of the table, where the plate is not", () => {
    const poses = heldPoses(3, line)
    expect(poses).toHaveLength(3)
    // in the frame of the seat, whose least z is toward the middle: beyond the line is a greater z
    for (const pose of poses) expect(pose.position.z).toBeGreaterThan(cardsBox(line).maxZ)
    expect(heldBox(line).minZ).toBeGreaterThanOrEqual(cardsBox(line).maxZ)
    expect(heldBox(line).maxZ).toBeGreaterThan(cardsBox(line).maxZ)
    expect(plateBox(line).maxZ).toBeLessThan(heldBox(line).minZ)
  })

  it("are the size of the cards of the line, in a row of their own that never lies over it", () => {
    const poses = heldPoses(3, line)
    expect(poses.every((pose) => pose.scale === line.scale)).toBe(true)
    expect(heldBox(line).maxZ - heldBox(line).minZ).toBeCloseTo(CARD.height * line.scale)
    expect(heldBox(line).minZ).toBeGreaterThanOrEqual(cardsBox(line).maxZ - 1e-9)
  })

  it("spread as the cards of the line do: closer, over one another, when the room of the line is narrow, and never wider than it", () => {
    for (const width of [2.2, 2.8, 6]) {
      const narrow = { ...line, width }
      const xs = heldPoses(3, narrow).map((pose) => pose.position.x)
      const card = CARD.width * line.scale
      expect(xs[2]! - xs[0]! + card, `width ${width}`).toBeLessThanOrEqual(Math.max(width, card * (1 + 2 * LAYOUT_SETTINGS.closest)) + 1e-9)
      expect(heldBox(narrow).maxX - heldBox(narrow).minX, `width ${width}`).toBeLessThanOrEqual(width + 1e-9)
      for (const x of xs) expect(Math.abs(x) + card / 2, `width ${width}`).toBeLessThanOrEqual((heldBox(narrow).maxX - heldBox(narrow).minX) / 2 + 1e-9)
    }
  })

  it("lie clear of everything else on the table, at every table, a spectator's too: the lines, the plates, the piles and the cards set aside by the other seats", () => {
    const failures: string[] = []
    for (const seated of SETUPS) {
      for (const n of SIZES) {
        const held = heldShapes(n, seated)
        const others = tableShapes(n, true, seated)
        held.forEach((own, i) => {
          for (const { name, shape } of others) if (polygonsOverlap(own.shape, shape)) failures.push(`${n} players${seated ? "" : ", spectator"}: ${own.name} and the ${name}`)
          for (const other of held.slice(i + 1)) if (polygonsOverlap(own.shape, other.shape)) failures.push(`${n} players${seated ? "" : ", spectator"}: ${own.name} and ${other.name}`)
        })
      }
    }
    expect(failures).toEqual([])
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

describe("the strip while the discard has no card", () => {
  const { deck, discard } = pilePlaces()
  /** The tables the strip is laid for: every chairs count of a seated table, and a spectator's extra chair */
  const CHAIRS = [3, 4, 5, 6, 7, 8, 9]

  it("is the three, the draw pile, the pad and the discard, centred on the table once the discard is there", () => {
    expect(deck.x + discard.x).toBeCloseTo(0)
    for (const chairs of CHAIRS) expect(floorPlan(chairs).pad.x, `${chairs} chairs`).toBeCloseTo(0)
  })

  it("is shifted by half a card and a gap, so that the draw pile and the pad lie centred on the table with the discard away", () => {
    for (const chairs of CHAIRS) {
      const card = CARD.width * cardScaleOf(chairs)
      const shift = stripShift(chairs)
      expect(shift, `${chairs} chairs`).toBeCloseTo((card + FLOOR.gap) / 2)
      const plan = floorPlan(chairs)
      const left = deck.x + shift - card / 2
      const right = plan.pad.x + shift + plan.pad.width / 2
      expect((left + right) / 2, `${chairs} chairs`).toBeCloseTo(0)
    }
  })

  it("is less at a fuller table, where the cards are smaller, and always to the right", () => {
    let before = Infinity
    for (const chairs of CHAIRS) {
      expect(stripShift(chairs), `${chairs} chairs`).toBeGreaterThan(0)
      expect(stripShift(chairs), `${chairs} chairs`).toBeLessThanOrEqual(before + 1e-9)
      before = stripShift(chairs)
    }
  })

  it("keeps the draw pile and the pad inside the room that the two piles and the strip keep clear of the seats, so that the camera and the press areas are what they are", () => {
    for (const chairs of CHAIRS) {
      const shift = stripShift(chairs)
      const [, pileBox, discardBox] = fixedBoxes(chairs)
      const plan = floorPlan(chairs)
      expect(deck.x + shift - (CARD.width * cardScaleOf(chairs)) / 2, `${chairs} chairs`).toBeGreaterThanOrEqual(pileBox!.box.minX - 1e-9)
      expect(plan.pad.x + shift + plan.pad.width / 2, `${chairs} chairs`).toBeLessThanOrEqual(discardBox!.box.maxX + 1e-9)
    }
  })

  it("lies clear of every plate, line, card set aside and press area at every table, a spectator's included, with the count under the draw pile and the word over it", () => {
    const failures: string[] = []
    for (const seated of SETUPS) {
      for (const n of SIZES) {
        const chairs = chairsOf(n, seated)
        const shift = stripShift(chairs)
        const [strip, pileBox] = fixedBoxes(chairs)
        const moved = [strip!, pileBox!].map(({ name, box }) => ({ name: `${name} shifted`, shape: cornersOfBox({ minX: box.minX + shift, maxX: box.maxX + shift, minZ: box.minZ, maxZ: box.maxZ }, { x: 0, z: 0 }) }))
        const others = [
          ...tableShapes(n, true, seated).filter(({ name }) => name.startsWith("plate") || name.startsWith("line")),
          ...heldShapes(n, seated),
          ...zoneAreas(n, seated).map((area, i) => ({ name: `area of seat ${i}`, shape: cornersOfArea(area) })),
        ]
        for (const a of moved) for (const b of others) if (polygonsOverlap(a.shape, b.shape)) failures.push(`${n} players${seated ? "" : ", spectator"}: the ${a.name} overlaps the ${b.name}`)
      }
    }
    expect(failures).toEqual([])
  })

  it("deals from above the draw pile where it lies: the shift moves the place the cards come from, and no shift leaves it", () => {
    for (const chairs of CHAIRS) {
      const shift = stripShift(chairs)
      expect(dealtFrom(chairs, shift).position.x, `${chairs} chairs`).toBeCloseTo(deck.x + shift)
      expect(dealtFrom(chairs).position.x, `${chairs} chairs`).toBeCloseTo(deck.x)
      expect(dealtFrom(chairs, shift).position.z, `${chairs} chairs`).toBe(deck.z)
    }
  })
})

describe("the floor between the piles", () => {
  const { deck, discard } = pilePlaces()
  const edges = (pad: { x: number; width: number }) => [pad.x - pad.width / 2, pad.x + pad.width / 2] as const
  /** The tables the floor is laid for: every chairs count of a seated table, and a spectator's extra chair */
  const CHAIRS = [3, 4, 5, 6, 7, 8, 9]

  it("has one pad, for Stay and for Deal, as deep as the piles and on their line", () => {
    for (const chairs of CHAIRS) {
      const plan = floorPlan(chairs)
      expect(plan.pad.depth, `${chairs} chairs`).toBeCloseTo(CARD.height * cardScaleOf(chairs))
      expect(plan.pad.z, `${chairs} chairs`).toBe(deck.z)
    }
  })

  it("keeps one gap, the same length, between the draw pile and the pad and between the pad and the discard", () => {
    for (const chairs of CHAIRS) {
      const pile = (CARD.width * cardScaleOf(chairs)) / 2
      const [left, right] = edges(floorPlan(chairs).pad)
      expect(left - (deck.x + pile), `${chairs} chairs`).toBeCloseTo(FLOOR.gap)
      expect(discard.x - pile - right, `${chairs} chairs`).toBeCloseTo(FLOOR.gap)
    }
  })

  it("is wide enough for the word of its button, at every table: three units across, where the longest word of the board (Distribuer, the French Deal) is set at three quarters of the size of the lettering", () => {
    for (const chairs of CHAIRS) expect(floorPlan(chairs).pad.width, `${chairs} chairs`).toBeGreaterThanOrEqual(3)
  })

  it("puts the action card where the pad begins, and nothing runs into the discard", () => {
    for (const chairs of CHAIRS) {
      const plan = floorPlan(chairs)
      const pile = (CARD.width * cardScaleOf(chairs)) / 2
      const [padLeft] = edges(plan.pad)
      expect(plan.card.x - (CARD.width * plan.card.scale) / 2, `${chairs} chairs`).toBeCloseTo(padLeft)
      expect(discard.x - pile - (plan.card.x + (CARD.width * plan.card.scale) / 2), `${chairs} chairs`).toBeGreaterThan(FLOOR.gap)
    }
  })

  it("lies clear of the viewer's line and of the plate above it, in the middle band", () => {
    for (const n of SIZES) {
      const plan = floorPlan(chairsOf(n))
      const line = lines(seatSpots(ids(n), "p0"), "p0").get("p0")!
      expect(plan.strip.z + plan.strip.depth / 2, `${n} players`).toBeLessThan(line.at.z - (CARD.height * line.scale) / 2)
      const plate = plateBox(line)
      // the box of the plate in the world: the viewer's frame is the world's
      expect(line.at.z + plate.maxZ, `${n} players`).toBeLessThan(line.at.z + cardsBox(line).minZ)
    }
  })

  it("keeps the room for the count under the draw pile and for the word over it", () => {
    for (const chairs of CHAIRS) {
      const [strip, deckBox] = fixedBoxes(chairs)
      const half = (CARD.height * cardScaleOf(chairs)) / 2
      expect(strip!.name).toBe("strip")
      expect(deckBox!.name).toBe("draw pile")
      expect(deckBox!.box.maxZ, `${chairs} chairs`).toBeGreaterThan(deck.z + half + 0.5)
      expect(deckBox!.box.minZ, `${chairs} chairs`).toBeLessThan(deck.z - half - 1)
    }
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
  it("are the plate and the line of each seat, the two piles, the strip between them, and the area and the cards set aside of each seat, whatever the number of players", () => {
    for (const n of SIZES) expect(tableQuads(n), `${n} players`).toHaveLength(2 * n + 3 + 2 * n)
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
