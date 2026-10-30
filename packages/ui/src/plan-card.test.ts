import * as React from "react"
import { DiceIcon } from "@hugeicons/core-free-icons"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { PlanCard, PlanVisual, type PlanCardProps } from "./platform/plan-card"

function render(props: Partial<PlanCardProps> = {}): string {
  return renderToStaticMarkup(
    React.createElement(PlanCard, {
      name: "Plus",
      price: "€0.99",
      period: "/ month",
      description: "For players who come back.",
      features: ["Everything in Free", "A badge next to your name"],
      action: React.createElement("button", null, "Coming soon"),
      ...props,
    }),
  )
}

describe("PlanCard", () => {
  it("is a group named by the name of the plan, which is its heading", () => {
    const html = render()
    const id = /aria-labelledby="([^"]+)"/.exec(html)?.[1]
    expect(html).toContain('role="group"')
    expect(id, "aria-labelledby").toBeTruthy()
    expect(html).toMatch(new RegExp(`<h2 id="${id}"[^>]*>Plus</h2>`))
  })

  it("says the price and what it is for as text, so that it reads as one", () => {
    const html = render()
    expect(html).toContain("€0.99")
    expect(html).toContain("/ month")
  })

  it("has nothing after the price of a free plan", () => {
    const html = render({ price: "€0", period: undefined })
    expect(html).toContain("€0")
    expect(html).not.toContain("/ month")
  })

  it("says how the price is billed under it, before the button", () => {
    const html = render({ note: "Billed monthly" })
    const at = (text: string) => html.indexOf(text)
    expect(at("€0.99")).toBeLessThan(at("Billed monthly"))
    expect(at("Billed monthly")).toBeLessThan(at("Coming soon"))
  })

  it("has no line under the price when it is given none", () => {
    expect(render()).not.toContain("Billed")
  })

  it("draws a picture above the name, which a screen reader skips", () => {
    const html = render({ visual: React.createElement("span", null, "picture") })
    expect(html).toMatch(/<div data-slot="plan-card-visual" aria-hidden="true"[^>]*><span>picture<\/span><\/div>/)
    expect(html.indexOf("picture")).toBeLessThan(html.indexOf(">Plus</h2>"))
  })

  it("draws nothing above the name without a picture", () => {
    expect(render()).not.toContain("plan-card-visual")
  })

  it("lists what the plan includes, one item each, with a tick that a screen reader skips", () => {
    const html = render()
    expect(html.match(/<li/g)).toHaveLength(2)
    expect(html.match(/<svg[^>]*aria-hidden="true"/g)).toHaveLength(2)
    expect(html).toContain("A badge next to your name")
  })

  it("puts the button between the price and the list", () => {
    const html = render()
    const at = (text: string) => html.indexOf(text)
    expect(at("€0.99")).toBeLessThan(at("Coming soon"))
    expect(at("Coming soon")).toBeLessThan(at("Everything in Free"))
  })

  it("is half transparent and told so when the plan cannot be taken", () => {
    const html = render({ disabled: true })
    expect(html).toContain('aria-disabled="true"')
    expect(html).toContain("opacity-50")
  })

  it("is whole otherwise", () => {
    const html = render()
    expect(html).not.toContain("aria-disabled")
    expect(html).not.toContain("opacity-50")
  })

  it("keeps the class it is given", () => {
    expect(render({ className: "md:col-span-2" })).toContain("md:col-span-2")
  })
})

describe("PlanVisual", () => {
  it("is an icon that only decorates", () => {
    const html = renderToStaticMarkup(React.createElement(PlanVisual, { icon: DiceIcon }))
    expect(html).toContain('data-slot="plan-visual"')
    expect(html).toMatch(/<svg[^>]*aria-hidden="true"/)
  })
})
