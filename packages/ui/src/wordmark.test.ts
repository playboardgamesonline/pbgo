import * as React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { Wordmark } from "./platform/wordmark"

function render(props: React.ComponentProps<typeof Wordmark> = {}): string {
  return renderToStaticMarkup(React.createElement(Wordmark, props))
}

describe("Wordmark", () => {
  it("never takes the pointer: its text lies over the row above it, where the footer's links are", () => {
    expect(render()).toContain("pointer-events-none")
  })

  it("is decorative, hidden from assistive technology", () => {
    expect(render()).toContain('aria-hidden="true"')
  })

  it("keeps the class it is given", () => {
    expect(render({ className: "mt-3" })).toContain("mt-3")
  })
})
