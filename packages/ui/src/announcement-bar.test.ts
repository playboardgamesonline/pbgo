import * as React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { AnnouncementBar } from "./platform/announcement-bar"

// The announcement of the signed-in home, by its markup: a slim bar with a title and an arrow, centred by its page, and the rest left to screen readers.

const render = (props: Partial<React.ComponentProps<typeof AnnouncementBar>> = {}): string =>
  renderToStaticMarkup(React.createElement(AnnouncementBar, { title: "A short break tonight", message: "The tables stay open.", ...props }))

describe("the bar of an announcement", () => {
  it("draws the title alone: its message is for a screen reader, after the title", () => {
    const html = render()
    expect(html).toContain(">A short break tonight</span>")
    expect(html).toMatch(/<span class="sr-only">The tables stay open\.<\/span>/)
    expect(html.indexOf("A short break tonight")).toBeLessThan(html.indexOf("The tables stay open."))
  })

  it("is slim and as wide as its title, no wider than a line of text, and rounded as a row is", () => {
    const html = render()
    expect(html).toContain("h-10")
    expect(html).toContain("w-fit")
    expect(html).toContain("max-w-full")
    expect(html).toContain("sm:max-w-xl")
    expect(html).toContain("rounded-2xl")
    expect(html).not.toContain("rounded-full")
  })

  it("is the link, with an arrow, when it leads somewhere, and the arrow is named for a screen reader", () => {
    const html = render({ href: "/about#whats-new", linkLabel: "Read more" })
    expect(html).toContain('<a href="/about#whats-new"')
    expect(html).toContain('aria-hidden="true"')
    expect(html).toMatch(/<span class="sr-only">Read more<\/span>/)
    expect(html.match(/<svg/g)).toHaveLength(1)
  })

  it("has no link and no arrow when it leads nowhere", () => {
    const html = render()
    expect(html).not.toContain("<a ")
    expect(html).not.toContain("<svg")
  })

  it("has a button that closes it only when it can be dismissed, named by its title", () => {
    expect(render()).not.toContain("<button")
    const html = render({ onDismiss: () => {} })
    expect(html).toContain('aria-label="Dismiss: A short break tonight"')
    expect(html.match(/<button/g)).toHaveLength(1)
  })

  it("tints the bar by its tone, and an alert is an alert to a screen reader while the others are a status", () => {
    expect(render({ tone: "alert" })).toContain("border-destructive/40")
    expect(render({ tone: "alert" })).toContain('role="alert"')
    expect(render({ tone: "success" })).toContain("border-success/40")
    expect(render({ tone: "success" })).toContain('role="status"')
    expect(render()).toContain('role="status"')
    expect(render()).toContain('data-tone="info"')
  })
})
