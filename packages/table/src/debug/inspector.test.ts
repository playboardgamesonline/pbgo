import { describe, expect, it } from "vitest"
import { type CardReading, describeCard, inspector } from "./inspector"

const reading = (over: Partial<CardReading> = {}): CardReading => ({
  id: "c-7",
  position: [1.2, 0.04, -3.1],
  target: [0, 0.04, 2],
  scale: 1,
  targetScale: 1.25,
  flight: null,
  glow: null,
  ...over,
})

describe("the card under the pointer", () => {
  it("is read from the card that put itself forward, when it is asked for", () => {
    const key = Symbol("a")
    let moved = 0
    inspector.enter(key, () => reading({ id: `c-${++moved}` }))
    expect(inspector.reading()?.id).toBe("c-1")
    expect(inspector.reading()?.id).toBe("c-2")
    inspector.leave(key)
  })

  it("is nobody once the card has left", () => {
    const key = Symbol("a")
    inspector.enter(key, () => reading())
    inspector.leave(key)
    expect(inspector.reading()).toBeNull()
  })

  it("is the card the pointer came onto last, and the one it left before does not take it back", () => {
    const first = Symbol("first")
    const second = Symbol("second")
    inspector.enter(first, () => reading({ id: "first" }))
    inspector.enter(second, () => reading({ id: "second" }))
    inspector.leave(first)
    expect(inspector.reading()?.id).toBe("second")
    inspector.leave(second)
    expect(inspector.reading()).toBeNull()
  })
})

describe("the lines of the Inspector", () => {
  it("say that there is no card when the pointer is on none", () => {
    expect(describeCard(null).card).toBe("none")
  })

  it("write the places to two decimals, with the size it has and the size it goes to", () => {
    const lines = describeCard(reading())
    expect(lines.at).toBe("1.20 · 0.04 · -3.10")
    expect(lines.target).toBe("0.00 · 0.04 · 2.00")
    expect(lines.scale).toBe("1.00 → 1.25")
  })

  it("say a card at rest is at rest, one that waits its turn how long, and one in flight how far along", () => {
    expect(describeCard(reading()).flight).toBe("at rest")
    expect(describeCard(reading({ flight: { time: -0.3, duration: 1.2 } })).flight).toBe("waits 0.30 s")
    expect(describeCard(reading({ flight: { time: 0.6, duration: 1.2 } })).flight).toBe("50 % of 1.20 s")
    expect(describeCard(reading({ flight: { time: 2, duration: 1.2 } })).flight).toBe("100 % of 1.20 s")
  })

  it("name the glow, or say there is none", () => {
    expect(describeCard(reading({ glow: "selection" })).glow).toBe("selection")
    expect(describeCard(reading()).glow).toBe("none")
  })
})
