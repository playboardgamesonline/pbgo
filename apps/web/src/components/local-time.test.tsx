import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { LocalTime } from "./local-time"

// A moment in the reader's own time, by what the server writes of it: the browser's zone is not known there, so it is written in UTC and out of sight, and the browser writes its own as soon as it has the page.

const iso = "2026-11-19T19:00:00.000Z"
const html = (timeFormat?: "auto" | "12h" | "24h") => renderToStaticMarkup(createElement(LocalTime, { iso, timeFormat }))

describe("a moment in the reader's own time", () => {
  it("is written on the server in UTC and out of sight, with the moment itself in its datetime", () => {
    const markup = html()
    expect(markup).toContain(`dateTime="${iso}"`)
    expect(markup).toContain("invisible")
    expect(markup).toContain("Nov 19, 7:00 PM")
  })

  it("is written on the clock that the member chose, of 12 hours or of 24, and by the device's language when they chose none", () => {
    expect(html("12h")).toContain("Nov 19, 7:00 PM")
    expect(html("24h")).toContain("Nov 19, 19:00")
    expect(html("auto")).toContain("Nov 19, 7:00 PM")
  })

  it("leaves the year out and does not name the zone, which is the reader's", () => {
    const markup = html()
    expect(markup).not.toContain("2026,")
    expect(markup).not.toContain("UTC")
  })
})
