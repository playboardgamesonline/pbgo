import * as React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { barHeight, Podium, type PodiumEntry } from "./platform/podium"

// The podium of a profile, by its markup: the first at the left, what put each there written inside its bar, and bars as tall as their amounts are of the first one's.

const entry = (name: string, value: string, amount: number): PodiumEntry => ({ name, value, amount, picture: React.createElement("i", null, name) })
const html = (entries: readonly PodiumEntry[]) => renderToStaticMarkup(React.createElement(Podium, { entries, "aria-label": "Played the longest" }))
const heights = (markup: string) => [...markup.matchAll(/style="height:([\d.]+)rem"/g)].map((match) => Number(match[1]))

describe("the bars of a podium", () => {
  it("are as tall as their amount is of the first one's, which is the tallest", () => {
    expect(barHeight(100, 100)).toBe(3)
    expect(barHeight(75, 100)).toBe(2.25)
    expect(barHeight(50, 100)).toBe(1.5)
  })

  it("are never lower than what holds their words, however small the amount", () => {
    expect(barHeight(1, 100)).toBe(1.25)
    expect(barHeight(0, 100)).toBe(1.25)
    expect(barHeight(5, 0)).toBe(1.25)
  })
})

describe("a podium", () => {
  it("has the first at the left and the others after it, in the order of the list", () => {
    const markup = html([entry("Courtisans", "1 h 03", 3780), entry("Hanabi", "22 min", 1320)])
    expect(markup.indexOf('data-place="1"')).toBeLessThan(markup.indexOf('data-place="2"'))
    expect(markup.indexOf("Courtisans")).toBeLessThan(markup.indexOf("Hanabi"))
    expect(markup).not.toMatch(/order-\d/)
  })

  it("writes what put each one there inside its bar, and no number of its place", () => {
    const markup = html([entry("Courtisans", "1 h 03", 3780), entry("Hanabi", "22 min", 1320)])
    expect(markup).toMatch(/data-slot="podium-bar"[^>]*>1 h 03<\/span>/)
    expect(markup).toMatch(/data-slot="podium-bar"[^>]*>22 min<\/span>/)
    expect(markup).not.toContain("aria-hidden")
  })

  it("draws bars proportional to the amounts, the first at its full height", () => {
    expect(heights(html([entry("a", "100%", 1), entry("b", "75%", 0.75)]))).toEqual([3, 2.25])
    expect(heights(html([entry("a", "2 h", 7200), entry("b", "1 h", 3600)]))).toEqual([3, 1.5])
  })

  it("lets a podium of one have the first alone at its full height, and an empty one draw nothing", () => {
    expect(heights(html([entry("a", "9 min", 540)]))).toEqual([3])
    expect(html([])).not.toContain("<li")
  })

  it("has no more than three", () => {
    expect(html([entry("a", "3", 3), entry("b", "2", 2), entry("c", "1", 1), entry("d", "0", 0)]).match(/<li/g)).toHaveLength(3)
  })
})
