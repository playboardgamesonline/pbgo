import * as React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { CreditLink, type CreditLinkProps } from "./platform/credit-link"

function render(props: Partial<CreditLinkProps> = {}): string {
  return renderToStaticMarkup(
    React.createElement(CreditLink, { href: "https://www.libellud.example/", icon: "/api/catalog/hanabi/publisher-0?v=abc", ...props }, "Libellud"),
  )
}

describe("CreditLink", () => {
  it("is one link to the website, which opens in a new tab and takes nothing of this page with it", () => {
    const html = render()
    expect(html.match(/<a[\s>]/g)).toHaveLength(1)
    expect(html).toContain('href="https://www.libellud.example/"')
    expect(html).toContain('target="_blank"')
    expect(html).toContain('rel="noopener noreferrer"')
  })

  it("has the name inside the link, and the place of the icon before it", () => {
    const html = render()
    const link = /<a[^>]*>([\s\S]*)<\/a>/.exec(html)?.[1] ?? ""
    expect(link).toContain("Libellud")
    expect(link.indexOf("size-4")).toBeGreaterThanOrEqual(0)
    expect(link.indexOf("size-4")).toBeLessThan(link.indexOf("Libellud"))
    expect(html).toContain('aria-hidden="true"')
  })

  it("does not ask for the picture before the page is interactive: a picture that failed before it was heard would leave a hole", () => {
    expect(render()).not.toContain("<img")
  })

  it("keeps no place for an icon when it has none", () => {
    const html = render({ icon: undefined })
    expect(html).not.toContain("size-4")
    expect(html).toContain("Libellud")
  })

  it("keeps the class it is given", () => {
    expect(render({ className: "text-sm" })).toContain("text-sm")
  })
})
