import * as React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { PlanCard, type PlanCardProps } from "./platform/plan-card"

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

  it("keeps the class it is given", () => {
    expect(render({ className: "md:col-span-2" })).toContain("md:col-span-2")
  })
})
