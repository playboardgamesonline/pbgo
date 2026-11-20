import { describe, expect, it } from "vitest"
import { LETTERING_WEIGHT, letteringOf } from "./lettering"
import { PLATE_FONT } from "./seat/seat"
import { TABLE_FONT } from "./seat/table-text"

const file = { url: "https://cdn.sanity.io/files/x/production/a.woff2", name: "a.woff2" }

describe("the lettering of the table", () => {
  it("is the fonts the game uploaded, each before the kit's own as its fallback", () => {
    const { display, body } = letteringOf({ fontDisplay: file, fontBody: file })
    expect(display).toBe(`"Site Title", ${PLATE_FONT}`)
    expect(body).toBe(`"Site Body", ${TABLE_FONT}`)
  })

  it("is the kit's own for a game that uploaded none, or when no game is shown", () => {
    expect(letteringOf({ fontDisplay: null, fontBody: null })).toEqual({ display: PLATE_FONT, body: TABLE_FONT, weight: LETTERING_WEIGHT })
    expect(letteringOf(null)).toEqual({ display: PLATE_FONT, body: TABLE_FONT, weight: LETTERING_WEIGHT })
  })

  it("follows each file on its own", () => {
    expect(letteringOf({ fontDisplay: file, fontBody: null })).toMatchObject({ display: `"Site Title", ${PLATE_FONT}`, body: TABLE_FONT })
    expect(letteringOf({ fontDisplay: null, fontBody: file })).toMatchObject({ display: PLATE_FONT, body: `"Site Body", ${TABLE_FONT}` })
  })

  it("is bold at 700", () => {
    expect(LETTERING_WEIGHT).toBe(700)
  })
})
