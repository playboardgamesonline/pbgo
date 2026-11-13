import * as React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { TableEntry, type TableEntryProps } from "./platform/table-entry"

const seats = [{ name: "Marly", host: true }, null, null]
const render = (props: Partial<TableEntryProps> = {}) => renderToStaticMarkup(React.createElement(TableEntry, { state: "waiting", seats, age: "Opened just now", action: "join", ...props }))

/** The Join button of the row, as its tag. */
const joinButton = (html: string) => html.match(/<(?:button|a)[^>]*data-slot="table-entry-join"[^>]*>/)?.[0]

describe("the Join button of a row", () => {
  it("is a button on the right of the seats when the page sits the visitor down itself", () => {
    const html = render({ onJoin: () => {}, href: "/courtisans/game/ABC234" })
    const button = joinButton(html)
    expect(button).toMatch(/^<button[^>]*type="button"/)
    expect(button).toContain('aria-label="Join the table hosted by Marly"')
    expect(html.indexOf('data-slot="table-entry-seats"')).toBeLessThan(html.indexOf('data-slot="table-entry-join"'))
  })

  it("is a link to the table's page when the row has no way to sit down", () => {
    const html = render({ href: "/courtisans/game/ABC234" })
    expect(joinButton(html)).toMatch(/^<a[^>]*href="\/courtisans\/game\/ABC234"/)
  })

  it("is hidden until the row is hovered or the keyboard is in it, and always there on a screen that cannot hover", () => {
    const classes = joinButton(render({ onJoin: () => {} })) ?? ""
    for (const rule of ["opacity-0", "group-hover/entry:opacity-100", "group-has-focus-visible/entry:opacity-100", "focus-visible:opacity-100", "[@media(hover:none)]:opacity-100"]) expect(classes).toContain(rule)
  })

  it("is in the row of a list that leads to the table too, raised over the link that is stretched on the row", () => {
    const html = render({ onJoin: () => {}, to: "/game/courtisans/ABC234" })
    expect(joinButton(html)).toContain("z-10")
    expect(html).toContain('data-slot="table-entry-link"')
  })

  it("is not drawn at the visitor's own table, at a full table, or at one that has no way in", () => {
    expect(joinButton(render({ onJoin: () => {}, mine: true, href: "/courtisans/game/ABC234" }))).toBeUndefined()
    expect(joinButton(render({ onJoin: () => {}, action: "full" }))).toBeUndefined()
    expect(joinButton(render({ onJoin: () => {}, action: null }))).toBeUndefined()
    expect(joinButton(render({}))).toBeUndefined()
  })
})
