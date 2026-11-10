import * as React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { BRANDS, BrandMark, type BrandName } from "./brands"

const render = (brand: BrandName, props: Partial<React.ComponentProps<typeof BrandMark>> = {}) => renderToStaticMarkup(React.createElement(BrandMark, { brand, ...props }))

describe("BrandMark", () => {
  it("wears its brand's colour where it stands by itself: Twitch's and Discord's tokens, and Google's four colours", () => {
    expect(render("twitch")).toContain("text-brand-twitch")
    expect(render("discord")).toContain("text-brand-discord")
    const google = render("google")
    expect(google.match(/fill="#[0-9a-f]{6}"/gi)).toHaveLength(4)
    expect(google).not.toContain("text-brand-")
  })

  it("draws Steam in the colour of the text, since its own near-black cannot be seen on the dark cards", () => {
    const steam = render("steam")
    expect(steam).toContain("text-foreground")
    expect(steam).not.toContain("text-brand-steam")
  })

  it("draws the single-colour marks in the colour of the text when its tile has the brand's colour (`tone=\"current\"`), and keeps Google's four either way", () => {
    for (const brand of BRANDS.filter((candidate) => candidate !== "google")) {
      const html = render(brand, { tone: "current" })
      expect(html, brand).toContain('fill="currentColor"')
      expect(html, brand).not.toMatch(/text-(brand-|foreground)/)
    }
    expect(render("google", { tone: "current" }).match(/fill="#[0-9a-f]{6}"/gi)).toHaveLength(4)
  })

  it("is decoration whatever its colour: hidden from a screen reader, named by its brand, and the class of the caller comes last", () => {
    for (const brand of BRANDS) {
      const html = render(brand, { className: "size-8" })
      expect(html, brand).toContain('aria-hidden="true"')
      expect(html, brand).toContain(`data-brand="${brand}"`)
      expect(html, brand).toMatch(/class="[^"]*size-8"/)
    }
  })
})
