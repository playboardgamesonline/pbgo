import * as React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { Pager } from "./platform/pager"

// The pager by its markup: a track of pages that scrolls sideways, and a dot for each page under it.

const pager = (texts: string[], props: Partial<React.ComponentProps<typeof Pager>> = {}) =>
  renderToStaticMarkup(React.createElement(Pager, { label: "Open tournaments", pages: texts.map((text) => React.createElement("p", { key: text }, text)), ...props }))

describe("the pager", () => {
  it("is a labelled carousel that the keyboard can reach, with its pages in order, each named 'n of m'", () => {
    const html = pager(["one", "two", "three"])
    expect(html).toContain('role="region"')
    expect(html).toContain('aria-roledescription="carousel"')
    expect(html).toContain('aria-label="Open tournaments"')
    expect(html).toContain('tabindex="0"')
    expect(html.match(/data-slot="pager-page"/g)).toHaveLength(3)
    for (const [index, text] of ["one", "two", "three"].entries()) {
      expect(html).toContain(`aria-label="${index + 1} of 3"`)
      expect(html.indexOf(`>${text}<`)).toBeGreaterThan(index === 0 ? -1 : html.indexOf(`>${["one", "two", "three"][index - 1]}<`))
    }
  })

  it("has a dot for each page from two pages on, named for its page, the first one current", () => {
    const html = pager(["one", "two", "three"])
    expect(html.match(/<button/g)).toHaveLength(3)
    expect(html).toContain('aria-label="Page 1 of 3"')
    expect(html).toContain('aria-label="Page 3 of 3"')
    expect(html.match(/aria-current="true"/g)).toHaveLength(1)
    expect(/aria-label="Page 1 of 3"[^>]*aria-current="true"|aria-current="true"[^>]*aria-label="Page 1 of 3"/.test(html)).toBe(true)
  })

  it("has no dot with one page, and keeps the row of the dots at its height, so that what is above it does not move when pages come or go", () => {
    const one = pager(["one"])
    const many = pager(["one", "two"])
    expect(one).not.toContain("<button")
    for (const html of [one, many]) expect(/data-slot="pager-dots"[^>]*class="[^"]*\bh-5\b/.test(html)).toBe(true)
  })

  it("scrolls sideways one page at a time, each page as wide as the pager and snapping to its start, and draws no scrollbar", () => {
    const html = pager(["one", "two"])
    const track = /<div[^>]*data-slot="pager-track"[^>]*>/.exec(html)?.[0] ?? ""
    expect(track).toContain("overflow-x-auto")
    expect(track).toContain("snap-x")
    expect(track).toContain("snap-mandatory")
    expect(track).toContain("[scrollbar-width:none]")
    const page = /<div[^>]*data-slot="pager-page"[^>]*>/.exec(html)?.[0] ?? ""
    expect(page).toContain("w-full")
    expect(page).toContain("shrink-0")
    expect(page).toContain("snap-start")
  })

  it("takes the height it is given, and cuts what a page holds over it", () => {
    const html = pager(["one", "two"], { className: "flex-1" })
    expect(/<div[^>]*data-slot="pager"[^>]*class="[^"]*\bmin-h-0\b[^"]*\bflex-1\b/.test(html)).toBe(true)
    const track = /<div[^>]*data-slot="pager-track"[^>]*>/.exec(html)?.[0] ?? ""
    expect(track).toContain("min-h-0")
    expect(track).toContain("flex-1")
    expect(track).toContain("overflow-y-hidden")
    expect(/<div[^>]*data-slot="pager-page"[^>]*>/.exec(html)?.[0]).toContain("h-full")
  })

  it("is empty of pages and of dots when it has none", () => {
    const html = pager([])
    expect(html).not.toContain('data-slot="pager-page"')
    expect(html).not.toContain("<button")
  })
})
