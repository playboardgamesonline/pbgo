import { describe, expect, it } from "vitest"
import { type Box, boxesOverlap, CARD, fixedBoxes, FLOOR, fitPrompt, floorPlan, wrapWords, zones, cornersOf, heldPlace, heldPoses, LAYOUT_SETTINGS, lineGap, linePoses, lines, pilePlaces, plateAt, plateBox, seatAngle, seatSpots, tableBoxes, tableQuads, uprightYaw } from "./layout"

const ids = (n: number) => Array.from({ length: n }, (_, i) => `p${i}`)
const SIZES = [3, 4, 5, 6, 7, 8]

/** Whether two turned rectangles share any area (the separating axis test), with a hair of tolerance so that boxes that touch do not count */
function boxesMeet(a: Box, b: Box): boolean {
  const ca = cornersOf(a)
  const cb = cornersOf(b)
  const axes = [ca, cb].flatMap((corners) => [
    { x: corners[1]!.x - corners[0]!.x, z: corners[1]!.z - corners[0]!.z },
    { x: corners[2]!.x - corners[1]!.x, z: corners[2]!.z - corners[1]!.z },
  ])
  return axes.every((axis) => {
    const project = (corners: typeof ca) => corners.map((corner) => corner.x * axis.x + corner.z * axis.z)
    const [pa, pb] = [project(ca), project(cb)]
    const length = Math.hypot(axis.x, axis.z)
    return Math.min(Math.max(...pa), Math.max(...pb)) - Math.max(Math.min(...pa), Math.min(...pb)) > 1e-6 * length
  })
}

describe("the angle of a seat", () => {
  const angles = (n: number, seated = true) => Array.from({ length: n }, (_, i) => seatAngle(i, n, seated))

  it("puts the viewer in front and the others around the table, clockwise from them, at every size of table from two to eight", () => {
    for (const n of [2, ...SIZES]) {
      const all = angles(n)
      expect(all[0], `${n} players`).toBe(0)
      for (let i = 1; i < n; i++) expect(all[i]!, `${n} players, seat ${i}`).toBeGreaterThan(all[i - 1]!)
      expect(all[n - 1]!, `${n} players`).toBeLessThan(360)
    }
  })

  it("is the same on both sides of the viewer: the opponents mirror each other", () => {
    for (const n of [2, ...SIZES]) {
      const all = angles(n)
      for (let i = 1; i < n; i++) expect(all[i]! + all[n - i]!, `${n} players, seats ${i} and ${n - i}`).toBeCloseTo(360)
    }
  })

  it("is the table of the arrangement: who sits where", () => {
    expect(angles(2)).toEqual([0, 180])
    expect(angles(3)).toEqual([0, 145, 215])
    expect(angles(4)).toEqual([0, 90, 180, 270])
    expect(angles(5)).toEqual([0, 90, 150, 210, 270])
    expect(angles(6).map(Math.round)).toEqual([0, 66, 123, 180, 237, 294])
    expect(angles(7).map(Math.round)).toEqual([0, 62, 109, 156, 204, 251, 298])
    expect(angles(8).map(Math.round)).toEqual([0, 60, 100, 140, 180, 220, 260, 300])
  })

  it("keeps the first and the last opponent off the viewer's sides, further from the front the fewer there are", () => {
    let before = 360
    for (const n of [2, ...SIZES]) {
      const first = seatAngle(1, n)
      expect(first, `${n} players`).toBeGreaterThanOrEqual(60)
      expect(first, `${n} players`).toBeLessThan(before + 1e-9)
      before = first
    }
  })

  it("seats a spectator at the places a table with one more player has, the empty chair in front being nobody's", () => {
    for (const n of [2, ...SIZES]) {
      const all = angles(n, false)
      const full = angles(n + 1)
      expect(all, `${n} players`).toEqual(full.slice(1))
      expect(all.every((angle) => angle >= 60 && angle <= 300)).toBe(true)
    }
  })
})

describe("the seats", () => {
  it("put the viewer in front, upright, and give every other seat the yaw that turns it to face its player", () => {
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

  it("stand one opposite the viewer for two, in the upper corners for three, one on each side for four", () => {
    const at = (n: number) => [...seatSpots(ids(n), "p0").values()]
    const [, across] = at(2)
    expect(across!.x).toBeCloseTo(0)
    expect(Math.abs(Math.abs(across!.yaw) - Math.PI)).toBeLessThan(1e-9)
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

  it("go round on both sides and across, whatever the size of the table: seats on the left half, the right half and the far end", () => {
    for (const n of SIZES) {
      const xs = [...seatSpots(ids(n), "p0").values()].slice(1).map((spot) => spot.x)
      expect(xs.some((x) => x < -1), `${n} players: left`).toBe(true)
      expect(xs.some((x) => x > 1), `${n} players: right`).toBe(true)
    }
  })

  it("make the turn pass to the viewer's left", () => {
    for (const n of SIZES) {
      const spots = seatSpots(ids(n), "p0")
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

  it("keep an opponent's on its seat, turned to face its player", () => {
    for (const n of SIZES) {
      const spots = seatSpots(ids(n), "p0")
      for (const [id, line] of lines(spots, "p0")) {
        if (id === "p0") continue
        expect(line.at, `${n} players: ${id}`).toEqual({ x: spots.get(id)!.x, z: spots.get(id)!.z })
        expect(line.yaw, `${n} players: ${id}`).toBe(spots.get(id)!.yaw)
      }
    }
  })

  it("lie flat to the viewer when the lines are told not to face their seat", () => {
    const was = LAYOUT_SETTINGS.faceSeat
    LAYOUT_SETTINGS.faceSeat = 0
    try {
      for (const line of lines(seatSpots(ids(5), "p0"), "p0").values()) expect(line.yaw).toBe(0)
    } finally {
      LAYOUT_SETTINGS.faceSeat = was
    }
  })

  it("never run into each other, nor into a plate, a pile or the button, even when every line takes all the room it may: no two boxes of the table overlap, at every size of table, for a player and for a spectator", () => {
    for (const seated of [true, false]) {
      for (const n of SIZES) {
        const boxes = tableBoxes(n, true, seated)
        const names = (i: number) => (i < 2 * n ? `${i % 2 === 0 ? "plate" : "line"} of seat ${Math.floor(i / 2)}` : ["draw pile", "discard", "button"][i - 2 * n]!)
        for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) expect(boxesMeet(boxes[i]!, boxes[j]!), `${n} players${seated ? "" : ", spectator"}: ${names(i)} and ${names(j)}`).toBe(false)
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
  it("turn with their seat but are never read upside down: at most a quarter turn from upright", () => {
    for (const n of SIZES) for (const spot of seatSpots(ids(n), "p0").values()) expect(Math.abs(uprightYaw(spot.yaw)), `${n} players`).toBeLessThanOrEqual(Math.PI / 2 + 1e-9)
  })

  it("keep the yaw of a seat that reads upright, and turn back by half a turn one that would not", () => {
    expect(uprightYaw(0)).toBe(0)
    expect(uprightYaw(-Math.PI / 2)).toBeCloseTo(-Math.PI / 2)
    expect(uprightYaw(Math.PI / 2)).toBeCloseTo(Math.PI / 2)
    expect(uprightYaw(Math.PI)).toBeCloseTo(0)
    expect(uprightYaw(-Math.PI)).toBeCloseTo(0)
    expect(uprightYaw((3 * Math.PI) / 4)).toBeCloseTo(-Math.PI / 4)
  })

  it("stand out from the line, away from the middle of the table", () => {
    for (const n of SIZES) {
      const spots = seatSpots(ids(n), "p0")
      const placed = lines(spots, "p0")
      for (const [id, spot] of spots) {
        const line = placed.get(id)!
        const plate = plateAt(spot, line)
        expect(Math.hypot(plate.x, plate.z), `${n} players: ${id}`).toBeGreaterThan(Math.hypot(line.at.x, line.at.z))
      }
    }
  })

  it("read upright for everybody when the plates are told not to turn", () => {
    const was = LAYOUT_SETTINGS.textTurn
    LAYOUT_SETTINGS.textTurn = 0
    try {
      const spots = seatSpots(ids(5), "p0")
      const placed = lines(spots, "p0")
      for (const [id, spot] of spots) expect(plateAt(spot, placed.get(id)!).yaw).toBe(0)
    } finally {
      LAYOUT_SETTINGS.textTurn = was
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

  it("is a row centred on its place, the first card on the left and each one a hair above the one before", () => {
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
  it("lie toward the viewer, beyond their own line, and toward the middle for an opponent", () => {
    const mine = { at: { x: 0, z: 3.1 }, yaw: 0, scale: 1, width: 13 }
    expect(heldPlace(mine, true).z).toBeGreaterThan(mine.at.z)
    const theirs = { at: { x: 2, z: -2.6 }, yaw: Math.PI, scale: 0.62, width: 2 }
    const place = heldPlace(theirs, false)
    expect(Math.hypot(place.x, place.z)).toBeLessThan(Math.hypot(theirs.at.x, theirs.at.z))
  })

  it("are smaller than the line, in a row of their own", () => {
    const poses = heldPoses(3, { scale: 1 })
    expect(poses).toHaveLength(3)
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

  it("has Hit and Stay side by side, as deep as the piles", () => {
    const depth = CARD.height * LAYOUT_SETTINGS.pileScale
    expect(plan.hit.depth).toBeCloseTo(depth)
    expect(plan.stay.depth).toBeCloseTo(depth)
    expect(plan.hit.z).toBe(deck.z)
    expect(plan.stay.z).toBe(deck.z)
    expect(plan.hit.x).toBeLessThan(plan.stay.x)
    expect(plan.hit.width).toBeCloseTo(plan.stay.width)
  })

  it("keeps one gap, the same length, between the draw pile and Hit, Hit and Stay, and Stay and the discard", () => {
    const [hitLeft, hitRight] = edges(plan.hit)
    const [stayLeft, stayRight] = edges(plan.stay)
    expect(hitLeft - (deck.x + pile)).toBeCloseTo(FLOOR.gap)
    expect(stayLeft - hitRight).toBeCloseTo(FLOOR.gap)
    expect(discard.x - pile - stayRight).toBeCloseTo(FLOOR.gap)
  })

  it("has Deal across the room of the two, as deep as they are", () => {
    const [left] = edges(plan.hit)
    const [, right] = edges(plan.stay)
    const [dealLeft, dealRight] = edges(plan.deal)
    expect(dealLeft).toBeCloseTo(left)
    expect(dealRight).toBeCloseTo(right)
    expect(plan.deal.depth).toBeCloseTo(plan.hit.depth)
  })

  it("puts the action card where Hit is and the words after it, with the same gaps, and nothing runs into the discard", () => {
    const [hitLeft] = edges(plan.hit)
    expect(plan.card.x - (CARD.width * plan.card.scale) / 2).toBeCloseTo(hitLeft)
    const [promptLeft, promptRight] = edges(plan.prompt)
    expect(promptLeft - (plan.card.x + (CARD.width * plan.card.scale) / 2)).toBeCloseTo(FLOOR.gap)
    expect(discard.x - pile - promptRight).toBeCloseTo(FLOOR.gap)
    expect(plan.prompt.width).toBeGreaterThan(2)
  })

  it("lies clear of the viewer's line, in the middle band", () => {
    expect(plan.strip.z + plan.strip.depth / 2).toBeLessThan(LAYOUT_SETTINGS.viewerZ - (CARD.height * LAYOUT_SETTINGS.viewerScale) / 2)
  })
})

describe("wrapWords", () => {
  it("breaks at the spaces into lines of at most the length", () => {
    expect(wrapWords("Choose the player who gets this Freeze", 14)).toEqual(["Choose the", "player who", "gets this", "Freeze"])
    for (const line of wrapWords("Choose the player who gets this Second Chance", 16)) expect(Array.from(line).length).toBeLessThanOrEqual(16)
  })
  it("keeps a word longer than a line whole, and says nothing for nothing", () => {
    expect(wrapWords("Supercalifragilistic go", 6)).toEqual(["Supercalifragilistic", "go"])
    expect(wrapWords("   ", 10)).toEqual([])
  })
})

describe("fitPrompt", () => {
  it("keeps the size asked for when the sentence fits the room, and writes it on lines that fit the width", () => {
    const { lines, height } = fitPrompt("Choose the player who gets this Freeze", 3.2, 1.7)
    expect(height).toBeLessThanOrEqual(0.42)
    for (const line of lines) expect(Array.from(line).length * height * 0.62).toBeLessThanOrEqual(3.2 + 1e-9)
  })
  it("shrinks the letters, to a least, for a long sentence in a small room", () => {
    const long = "Elige al jugador que recibe esta carta Segunda oportunidad ahora mismo"
    const { lines, height, step } = fitPrompt(long, 2, 1.9)
    expect(height).toBeLessThan(0.42)
    expect(height).toBeGreaterThanOrEqual(0.24)
    expect(lines.length * step).toBeLessThanOrEqual(1.9 + 1e-9)
  })
  it("fits the three English prompts into the room beside the action card", () => {
    const { prompt } = floorPlan()
    for (const text of ["Choose the player who gets this Freeze", "Choose the player who gets this Flip Three", "Choose the player who gets this Second Chance"]) {
      const { lines, step } = fitPrompt(text, prompt.width, prompt.depth)
      expect(lines.length * step, text).toBeLessThanOrEqual(prompt.depth + 1e-9)
    }
  })
})

describe("the zones the viewer presses to give a card", () => {
  const overlap = boxesOverlap
  const setup = (n: number, seated: boolean) => {
    const ids = Array.from({ length: n }, (_, i) => String(i))
    const viewer = seated ? "0" : null
    const spots = seatSpots(ids, viewer)
    const placed = lines(spots, viewer)
    const all = zones(spots, placed, viewer)
    return ids.map((id) => ({ id, zone: all.get(id)!, line: placed.get(id)!, plate: plateBox(spots.get(id)!, placed.get(id)!) }))
  }
  const inside = (zone: Box, p: { x: number; z: number }) => {
    const dx = p.x - zone.x
    const dz = p.z - zone.z
    const u = dx * Math.cos(zone.yaw) - dz * Math.sin(zone.yaw)
    const v = dx * Math.sin(zone.yaw) + dz * Math.cos(zone.yaw)
    return Math.abs(u) <= zone.halfWidth + 1e-9 && Math.abs(v) <= zone.halfDepth + 1e-9
  }

  it("never overlap each other, from 3 to 8 players, for a player and for a spectator", () => {
    for (const seated of [true, false]) for (const n of SIZES) {
      const all = setup(n, seated)
      all.forEach((a, i) => all.slice(i + 1).forEach((b) => expect(overlap(a.zone, b.zone), `${n} players, seated ${seated}: zones ${a.id} and ${b.id}`).toBe(false)))
    }
  })

  it("never overlap the plate of another seat, the piles or the strip of the buttons", () => {
    for (const seated of [true, false]) for (const n of SIZES) {
      const all = setup(n, seated)
      for (const { id, zone } of all) {
        for (const other of all.filter((item) => item.id !== id)) expect(overlap(zone, other.plate), `${n} players, seated ${seated}: zone ${id} and the plate of ${other.id}`).toBe(false)
        fixedBoxes().forEach((box, j) => expect(overlap(zone, box), `${n} players, seated ${seated}: zone ${id} and fixed box ${j}`).toBe(false))
      }
    }
  })

  it("hold the plate of their seat, whole, and the cards of its line: one zone for the play area and the name", () => {
    for (const seated of [true, false]) for (const n of SIZES) for (const { id, zone, line, plate } of setup(n, seated)) {
      for (const corner of cornersOf(plate)) expect(inside(zone, corner), `${n} players, seated ${seated}, zone ${id}: a corner of its plate is outside`).toBe(true)
      const cards = cornersOf({ x: line.at.x, z: line.at.z, halfWidth: Math.min(line.width, CARD.width * line.scale * 3) / 2, halfDepth: (CARD.height * line.scale) / 2, yaw: line.yaw })
      for (const corner of cards) expect(inside(zone, corner), `${n} players, seated ${seated}, zone ${id}: a card is outside`).toBe(true)
    }
  })

  it("take a press on the name: the middle of the plate is inside the zone, so is a point of each piece of its lettering", () => {
    for (const n of SIZES) for (const { id, zone, plate } of setup(n, true)) expect(inside(zone, { x: plate.x, z: plate.z }), `${n} players, zone ${id}`).toBe(true)
  })

  it("are padded on the sides with room: bigger than the play area they hold", () => {
    for (const n of [3, 4]) for (const { id, zone, line, plate } of setup(n, true)) {
      expect(zone.halfDepth * 2, `${n} players, zone ${id}`).toBeGreaterThan(CARD.height * line.scale + plate.halfDepth * 2)
    }
  })

  it("are big enough to hit: at least a card across on the short side", () => {
    for (const n of SIZES) for (const { id, zone } of setup(n, true)) expect(Math.min(zone.halfWidth, zone.halfDepth) * 2, `${n} players, zone ${id}`).toBeGreaterThan(CARD.width * 0.8)
  })
})

describe("the footprints of a table", () => {
  it("are the plate and the line of each seat, the two piles, the strip between them and the zone of each seat, whatever the number of players", () => {
    for (const n of SIZES) expect(tableQuads(n), `${n} players`).toHaveLength(2 * n + 3 + n)
  })

  it("are four corners with some area between them", () => {
    for (const n of SIZES) for (const quad of tableQuads(n)) {
      expect(quad).toHaveLength(4)
      // the shoelace formula: a turned rectangle has the same area whichever way it is turned
      const area = Math.abs(quad.reduce((sum, corner, i) => sum + corner.x * quad[(i + 1) % 4]!.z - quad[(i + 1) % 4]!.x * corner.z, 0)) / 2
      expect(area, `${n} players`).toBeGreaterThan(0.5)
    }
  })

  it("put the viewer's plate nearest to the viewer, below its line", () => {
    for (const n of SIZES) {
      const [plate, line] = tableQuads(n)
      expect(Math.min(...plate!.map((corner) => corner.z)), `${n} players`).toBeGreaterThanOrEqual(Math.max(...line!.map((corner) => corner.z)) - 1e-9)
    }
  })
})
