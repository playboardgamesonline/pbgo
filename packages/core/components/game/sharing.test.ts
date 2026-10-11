import { afterEach, describe, expect, it, vi } from "vitest"
import type { GameBinding } from "../../lib/binding"
import type { Locale } from "../../lib/i18n"
import { baseSkin, fill } from "../../lib/skin"
import { generateShareImage, shareImage, type ShareRow, type ShareText } from "./sharing"

const ADA: ShareRow = { rank: 1, nickname: "Ada", color: "#d94f4f", total: 12, winner: true }
const BOB: ShareRow = { rank: 2, nickname: "Bob", color: "#4f8bd9", total: 7, winner: false }
const CY: ShareRow = { rank: 3, nickname: "Cy", color: "#4fd98b", total: -3, winner: false }

/** A `document` whose canvas records every text drawn on it, in drawing order; the rest of the 2D context does nothing. */
function stubDocument() {
  const drawn: string[] = []
  const gradient = { addColorStop: () => {} }
  const properties: Record<string | symbol, unknown> = {}
  const context = new Proxy(properties, {
    get: (target, name) => {
      if (name === "fillText") return (text: string) => drawn.push(text)
      if (name === "createLinearGradient" || name === "createRadialGradient") return () => gradient
      return name in target ? target[name] : () => {}
    },
    set: (target, name, value) => {
      target[name] = value
      return true
    },
  })
  const canvas = {
    width: 0,
    height: 0,
    getContext: () => context,
    toBlob: (done: (blob: Blob) => void) => done(new Blob(["png"], { type: "image/png" })),
  }
  vi.stubGlobal("document", { fonts: { load: async () => [] }, createElement: () => canvas, querySelector: () => null })
  return drawn
}

/** What the page's `useText()` returns, built from the real texts of the language. */
function textsIn(locale: Locale): ShareText {
  const { texts } = baseSkin({} as GameBinding, locale)
  return (key, params) => fill(texts[key], params)
}

/** Every text of the image but the last one, the date: it follows the clock and the time zone of the machine. */
async function drawnTexts(locale: Locale, rows: ShareRow[]) {
  const drawn = stubDocument()
  await shareImage(rows, null, "Courtisans", locale, textsIn(locale))
  return drawn.slice(0, -1)
}

describe("shareImage", () => {
  afterEach(() => vi.unstubAllGlobals())

  it.each<[Locale, string, string, string]>([
    ["fr", "12 points · Victoire", "7 pts", "-3 pts"],
    ["en", "12 points · Victory", "7 pts", "-3 pts"],
    ["es", "12 puntos · Victoria", "7 pts", "-3 pts"],
    ["de", "12 Punkte · Sieg", "7 Pkt.", "-3 Pkt."],
  ])("writes the headline and the points in the visitor's language (%s)", async (locale, headline, bob, cy) => {
    expect(await drawnTexts(locale, [ADA, BOB, CY])).toEqual(["ADA", headline, "2.", "BOB", bob, "3.", "CY", cy, "COURTISANS"])
  })

  // what the image wrote before its texts were translated
  it("keeps the French texts as they were", async () => {
    expect(await drawnTexts("fr", [ADA, BOB, CY])).toEqual([
      "ADA",
      `${ADA.total} points · Victoire`,
      "2.",
      "BOB",
      `${BOB.total} pts`,
      "3.",
      "CY",
      `${CY.total} pts`,
      "COURTISANS",
    ])
  })

  it("names every winner and gives the points of the first one", async () => {
    const eve: ShareRow = { ...BOB, nickname: "Eve", total: 12, winner: true }
    expect(await drawnTexts("en", [ADA, eve])).toEqual(["ADA & EVE", "12 points · Victory", "COURTISANS"])
  })

  it("writes zero points when nobody won", async () => {
    expect(await drawnTexts("fr", [BOB])).toEqual(["", "0 points · Victoire", "2.", "BOB", "7 pts", "COURTISANS"])
  })
})

describe("generateShareImage", () => {
  afterEach(() => vi.unstubAllGlobals())

  it("hands the visitor's texts to the image it generates", async () => {
    const drawn = stubDocument()
    const file = await generateShareImage([ADA, BOB], "courtisans", "ABCD", "Courtisans", "de", textsIn("de"))
    expect(file.name).toBe("courtisans-ABCD.png")
    expect(drawn).toContain("12 Punkte · Sieg")
    expect(drawn).toContain("7 Pkt.")
  })
})
