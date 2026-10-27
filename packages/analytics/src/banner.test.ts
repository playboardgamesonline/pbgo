import * as React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { ConsentBanner } from "./banner"
import { BANNER_TEXTS } from "./texts"

function render(reopened: boolean): string {
  return renderToStaticMarkup(React.createElement(ConsentBanner, { reopened, onChoose() {}, onClose() {} }))
}

/** The button that says `label`: where it starts in the markup, and its `class` attribute. */
function button(html: string, label: string): { at: number; className: string } {
  const match = new RegExp(`<button[^>]*class="([^"]*)"[^>]*>${label}</button>`).exec(html)
  if (!match) throw new Error(`no button "${label}"`)
  return { at: match.index, className: match[1] }
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

  it("offers Refuse and Accept as the same button, Refuse first", () => {
    const html = render(false)
    const refuse = button(html, BANNER_TEXTS.en.refuse)
    const accept = button(html, BANNER_TEXTS.en.accept)
    expect(refuse.className).toBe(accept.className)
    expect(refuse.at).toBeLessThan(accept.at)
  })

  it("links to the part of the legal notice about cookies", () => {
    expect(render(false)).toContain('href="/legal#cookies"')
  })

  it("has no way to close it until the visitor has answered", () => {
    expect(render(false)).not.toContain(BANNER_TEXTS.en.close)
    expect(render(true)).toContain(BANNER_TEXTS.en.close)
  })
})
