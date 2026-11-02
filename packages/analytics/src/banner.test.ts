import * as React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { CookieBanner, type CookiePreferences } from "@pbgo/ui/platform/cookie-banner"
import { describe, expect, it } from "vitest"
import { ConsentBanner } from "./banner"
import { BANNER_TEXTS } from "./texts"

function render(reopened: boolean): string {
  return renderToStaticMarkup(React.createElement(ConsentBanner, { reopened, onChoose() {}, onClose() {} }))
}

const NOTHING: CookiePreferences = { analytics: false, marketing: false }
const EVERYTHING: CookiePreferences = { analytics: true, marketing: true }

/** The card opened on its choices, with the switches as they stand. */
function renderChoices(preferences: CookiePreferences): string {
  return renderToStaticMarkup(
    React.createElement(CookieBanner, {
      texts: BANNER_TEXTS.en,
      moreHref: "/legal/cookies",
      preferences,
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
      for (const name of ["h-10", "px-4", "text-sm", "rounded-2xl", "lg:px-5"]) expect(className.split(" ")).toContain(name)
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
    const html = renderChoices(NOTHING)
    const { label, necessary, analytics, marketing } = BANNER_TEXTS.en
    const at = [label, necessary, analytics, marketing].map((words) => html.indexOf(`>${words}</`))
    expect(at.every((index) => index >= 0), "every row is there").toBe(true)
    expect(at).toEqual([...at].sort((a, b) => a - b))
    expect(html.match(/<h2/g)).toHaveLength(1)
  })

  it("keep what the site needs on and out of reach, and let the visitor set the analytics and the marketing, off to begin with", () => {
    expect(switches(renderChoices(NOTHING))).toEqual([
      { checked: true, disabled: true },
      { checked: false, disabled: false },
      { checked: false, disabled: false },
    ])
  })

  it("open the switches on what the visitor answered before, each on its own", () => {
    expect(switches(renderChoices(EVERYTHING))).toEqual([
      { checked: true, disabled: true },
      { checked: true, disabled: false },
      { checked: true, disabled: false },
    ])
    expect(switches(renderChoices({ analytics: true, marketing: false })).map((s) => s.checked)).toEqual([true, true, false])
    expect(switches(renderChoices({ analytics: false, marketing: true })).map((s) => s.checked)).toEqual([true, false, true])
  })

  it("say what stands beside each switch", () => {
    const { required, on, off } = BANNER_TEXTS.en
    const count = (html: string, words: string) => html.match(new RegExp(`>${words}</span>`, "g"))?.length ?? 0
    const refused = renderChoices(NOTHING)
    expect([count(refused, required), count(refused, on), count(refused, off)]).toEqual([1, 0, 2])
    const accepted = renderChoices(EVERYTHING)
    expect([count(accepted, required), count(accepted, on), count(accepted, off)]).toEqual([1, 2, 0])
  })

  it("end with Back and Save, and the same link to the cookie policy", () => {
    const html = renderChoices(NOTHING)
    expect(button(html, BANNER_TEXTS.en.back).at).toBeLessThan(button(html, BANNER_TEXTS.en.save).at)
    expect(html).toMatch(new RegExp(`${BANNER_TEXTS.en.intro} <a [^>]*href="/legal/cookies"[^>]*>${BANNER_TEXTS.en.more}</a>\\.</p>`))
  })
})
