import { PLATE_FONT, TABLE_FONT } from "@pbgo/table"
import { describe, expect, it } from "vitest"
import { tableFonts } from "./table-fonts"

const file = (name: string) => ({ url: `https://cdn.sanity.io/files/ky3exlhe/production/${name}`, name })

describe("the fonts of the lettering on the table", () => {
  it("are the display and the body fonts the game uploaded, each before the kit's own as its fallback", () => {
    const { display, body } = tableFonts({ fontBody: file("roboto.ttf"), fontDisplay: file("overpass.ttf") })
    expect(display).toBe(`"Site Title", ${PLATE_FONT}`)
    expect(body).toBe(`"Site Body", ${TABLE_FONT}`)
  })

  it("are the kit's own, left to it, when the game uploaded none", () => {
    expect(tableFonts({ fontBody: null, fontDisplay: null })).toEqual({ display: undefined, body: undefined })
  })

  it("follow each file on its own", () => {
    expect(tableFonts({ fontBody: null, fontDisplay: file("overpass.ttf") })).toEqual({ display: `"Site Title", ${PLATE_FONT}`, body: undefined })
    expect(tableFonts({ fontBody: file("roboto.ttf"), fontDisplay: null })).toEqual({ display: undefined, body: `"Site Body", ${TABLE_FONT}` })
  })
})
