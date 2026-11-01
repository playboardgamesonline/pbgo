import * as React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { CookieBanner } from "@pbgo/ui/platform/cookie-banner"
import { describe, expect, it } from "vitest"
import { ConsentBanner } from "./banner"
import { BANNER_TEXTS } from "./texts"

function render(reopened: boolean): string {
  return renderToStaticMarkup(React.createElement(ConsentBanner, { reopened, onChoose() {}, onClose() {} }))
}

/** The card opened on its choices, with the analytics switch as it stands. */
function renderChoices(analytics: boolean): string {
  return renderToStaticMarkup(
    React.createElement(CookieBanner, {
      texts: BANNER_TEXTS.en,
      moreHref: "/legal/cookies",
      analytics,
      defaultView: "preferences",
      onAccept() {},
      onRefuse() {},
      onSave() {},
    })
  )
}

/** The button that says `label`: where it starts in the markup, its `class` attribute, and the variant and the size it was drawn with. */
function button(html: string, label: string): { at: number; className: string; variant: string; size: string } {
  const match = new RegExp(`<button([^>]*)>${label}</button>`).exec(html)
  if (!match) throw new Error(`no button "${label}"`)
  const attribute = (name: string) => new RegExp(`${name}="([^"]*)"`).exec(match[1])?.[1] ?? ""
  return { at: match.index, className: attribute("class"), variant: attribute("data-variant"), size: attribute("data-size") }
}

/** The switches of the choices, in order: whether each is on and whether it can be set. */
function switches(html: string): { checked: boolean; disabled: boolean }[] {
  return [...html.matchAll(/<button[^>]*role="switch"[^>]*>/g)].map(([tag]) => ({
    checked: /aria-checked="true"/.test(tag),
    disabled: /\sdisabled(=""|\s|>)/.test(tag),
  }))
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

  it("offers Customize, Reject optional and Accept all, in that order, as three buttons of the same size", () => {
    const html = render(false)
    const customize = button(html, BANNER_TEXTS.en.customize)
    const refuse = button(html, BANNER_TEXTS.en.refuse)
    const accept = button(html, BANNER_TEXTS.en.accept)
    expect(customize.at).toBeLessThan(refuse.at)
    expect(refuse.at).toBeLessThan(accept.at)
    expect(html.match(/<button/g)).toHaveLength(3)
    expect(new Set([customize.size, refuse.size, accept.size]).size).toBe(1)
    // Told apart by their fill only: they take the same sizes, so refusing is as easy to hit as accepting
    for (const { className } of [customize, refuse, accept]) {
      for (const name of ["h-11", "px-4", "text-base", "rounded-2xl", "lg:px-5"]) expect(className.split(" ")).toContain(name)
    }
  })

  it("draws Customize and Reject optional as the grey (secondary) button and Accept all as the plain one", () => {
    const html = render(false)
    expect(button(html, BANNER_TEXTS.en.customize).variant).toBe("secondary")
    expect(button(html, BANNER_TEXTS.en.refuse).variant).toBe("secondary")
    expect(button(html, BANNER_TEXTS.en.accept).variant).toBe("default")
  })

  it("ends its sentence with a link to the cookie policy, the full stop after it", () => {
    const html = render(false)
    expect(html).toContain('href="/legal/cookies"')
    expect(html).toMatch(new RegExp(`${BANNER_TEXTS.en.body} <a [^>]*href="/legal/cookies"[^>]*>${BANNER_TEXTS.en.more}</a>\\.</p>`))
  })

  it("has no way to close it until the visitor has answered", () => {
    expect(render(false)).not.toContain(BANNER_TEXTS.en.close)
    expect(render(true)).toContain(BANNER_TEXTS.en.close)
  })
})

describe("the choices of the banner", () => {
  it("list what the site needs, the analytics and the marketing, in that order, under the title of the card", () => {
    const html = renderChoices(false)
    const { label, necessary, analytics, marketing } = BANNER_TEXTS.en
    const at = [label, necessary, analytics, marketing].map((words) => html.indexOf(`>${words}</`))
    expect(at.every((index) => index >= 0), "every row is there").toBe(true)
    expect(at).toEqual([...at].sort((a, b) => a - b))
    expect(html.match(/<h2/g)).toHaveLength(1)
  })

  it("keep what the site needs on and out of reach, and the marketing off and out of reach: only the analytics can be set", () => {
    expect(switches(renderChoices(false))).toEqual([
      { checked: true, disabled: true },
      { checked: false, disabled: false },
      { checked: false, disabled: true },
    ])
  })

  it("open the analytics switch on what the visitor answered before", () => {
    expect(switches(renderChoices(true))[1]).toEqual({ checked: true, disabled: false })
  })

  it("say what stands beside each switch", () => {
    const { required, on, off, unused } = BANNER_TEXTS.en
    const refused = renderChoices(false)
    for (const words of [required, off, unused]) expect(refused).toContain(`>${words}</span>`)
    expect(renderChoices(true)).toContain(`>${on}</span>`)
  })

  it("end with Back and Save, and the same link to the cookie policy", () => {
    const html = renderChoices(false)
    expect(button(html, BANNER_TEXTS.en.back).at).toBeLessThan(button(html, BANNER_TEXTS.en.save).at)
    expect(html).toMatch(new RegExp(`${BANNER_TEXTS.en.intro} <a [^>]*href="/legal/cookies"[^>]*>${BANNER_TEXTS.en.more}</a>\\.</p>`))
  })
})
