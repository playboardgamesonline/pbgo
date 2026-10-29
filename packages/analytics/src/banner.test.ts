import * as React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { ConsentBanner } from "./banner"
import { BANNER_TEXTS } from "./texts"

function render(reopened: boolean): string {
  return renderToStaticMarkup(React.createElement(ConsentBanner, { reopened, onChoose() {}, onClose() {} }))
}

/** The button that says `label`: where it starts in the markup, its `class` attribute, and the variant and the size it was drawn with. */
function button(html: string, label: string): { at: number; className: string; variant: string; size: string } {
  const match = new RegExp(`<button([^>]*)>${label}</button>`).exec(html)
  if (!match) throw new Error(`no button "${label}"`)
  const attribute = (name: string) => new RegExp(`${name}="([^"]*)"`).exec(match[1])?.[1] ?? ""
  return { at: match.index, className: attribute("class"), variant: attribute("data-variant"), size: attribute("data-size") }
}

describe("ConsentBanner", () => {
  it("keeps its own clicks out of autocapture, the answer being reported by the cookie_consent event", () => {
    const html = render(false)
    expect(html).toMatch(/data-slot="cookie-banner" class="[^"]*\bph-no-capture\b/)
  })

  it("is a dialog named by its title and spoken in the visitor's language", () => {
    const html = render(false)
    expect(html).toContain('role="dialog"')
    expect(html).toContain('lang="en"')
    const title = /aria-labelledby="([^"]+)"/.exec(html)?.[1]
    expect(title, "aria-labelledby").toBeTruthy()
    expect(html).toMatch(new RegExp(`<h2 id="${title}"[^>]*>${BANNER_TEXTS.en.label}</h2>`))
  })

  it("offers Reject optional, Manage preferences and Accept all, in that order, as three small buttons", () => {
    const html = render(false)
    const refuse = button(html, BANNER_TEXTS.en.refuse)
    const customize = button(html, BANNER_TEXTS.en.customize)
    const accept = button(html, BANNER_TEXTS.en.accept)
    expect(refuse.at).toBeLessThan(customize.at)
    expect(customize.at).toBeLessThan(accept.at)
    expect([refuse.size, customize.size, accept.size]).toEqual(["sm", "sm", "sm"])
  })

  it("draws refusing as a ghost button, preferences as an outline one, and accepting as the plain one", () => {
    const html = render(false)
    expect(button(html, BANNER_TEXTS.en.refuse).variant).toBe("ghost")
    expect(button(html, BANNER_TEXTS.en.customize).variant).toBe("outline")
    expect(button(html, BANNER_TEXTS.en.accept).variant).toBe("default")
  })

  it("keeps the choices one by one behind Manage preferences", () => {
    const html = render(false)
    expect(html).not.toContain(BANNER_TEXTS.en.essential)
    expect(html).not.toContain(BANNER_TEXTS.en.recordings)
  })

  it("links to the part of the legal notice about cookies", () => {
    expect(render(false)).toContain('href="/legal#cookies"')
  })

  it("has no way to close it until the visitor has answered", () => {
    expect(render(false)).not.toContain(BANNER_TEXTS.en.close)
    expect(render(true)).toContain(BANNER_TEXTS.en.close)
  })
})
