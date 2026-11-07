import * as React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { GameCard, GameCardVisual, type GameCardProps, type GameCardVisualProps } from "./platform/game-card"

const PICTURE = "https://cdn.example/cover-640x480.webp"
const LOGO = "https://cdn.example/logo-800x300.png"

const renderVisual = (props: GameCardVisualProps = {}) => renderToStaticMarkup(React.createElement(GameCardVisual, props))
const renderCard = (props: Partial<GameCardProps> = {}) => renderToStaticMarkup(React.createElement(GameCard, { href: "/game/catan", name: "Catan", players: "3–4 players", duration: "60 min", ...props }))

/** The pictures of a frame, as their tags. */
const pictures = (html: string) => html.match(/<img[^>]*>/g) ?? []

describe("GameCardVisual", () => {
  it("fills the frame with its picture, cropped to it", () => {
    const [image, ...others] = pictures(renderVisual({ picture: PICTURE }))
    expect(others).toEqual([])
    expect(image).toContain(`src="${PICTURE}"`)
    expect(image).toContain("object-cover")
    expect(image).toContain("absolute inset-0")
  })

  it("lays nothing over the picture: the frame holds the picture and nothing else", () => {
    expect(renderVisual({ picture: PICTURE })).toMatch(/^<div data-slot="game-card-visual"[^>]*><img[^>]*\/><\/div>$/)
  })

  it("does not draw a logo over a picture, even when it is given both", () => {
    const html = renderVisual({ picture: PICTURE, logo: LOGO })
    expect(pictures(html)).toHaveLength(1)
    expect(html).toContain(PICTURE)
    expect(html).not.toContain(LOGO)
  })

  it("draws the logo contained on the plain frame when there is no picture", () => {
    const [image, ...others] = pictures(renderVisual({ logo: LOGO }))
    expect(others).toEqual([])
    expect(image).toContain(`src="${LOGO}"`)
    expect(image).toContain("object-contain")
    expect(image).not.toContain("object-cover")
  })

  it("leaves the frame plain with neither: no picture and no placeholder", () => {
    const html = renderVisual()
    expect(pictures(html)).toEqual([])
    expect(html).toContain("bg-muted")
    expect(html).toMatch(/<div data-slot="game-card-visual"[^>]*><\/div>$/)
  })

  it("is a grey frame in the shape of a card's picture, whatever it holds", () => {
    for (const props of [{ picture: PICTURE }, { logo: LOGO }, {}]) {
      const html = renderVisual(props)
      expect(html).toContain("aspect-4/3")
      expect(html).toContain("bg-muted")
    }
  })

  it("asks for its picture when it comes near, unless it is told it opens the page", () => {
    expect(renderVisual({ picture: PICTURE })).toContain('loading="lazy"')
    expect(renderVisual({ picture: PICTURE, loading: "eager" })).toContain('loading="eager"')
    expect(renderVisual({ logo: LOGO, loading: "eager" })).toContain('loading="eager"')
  })

  it("keeps the class it is given, to shape the frame", () => {
    expect(renderVisual({ picture: PICTURE, className: "rounded-3xl" })).toContain("rounded-3xl")
  })
})

describe("GameCard", () => {
  it("is one link to the game's page, with the picture at its top and the name and the facts under it", () => {
    const html = renderCard({ picture: PICTURE })
    expect(html.match(/<a[\s>]/g)).toHaveLength(1)
    expect(html).toContain('href="/game/catan"')
    expect(html.indexOf(PICTURE)).toBeLessThan(html.indexOf("Catan"))
    expect(html.indexOf("Catan")).toBeLessThan(html.indexOf("3–4 players"))
  })

  it("draws the picture it is given on the frame, and no logo over it", () => {
    const html = renderCard({ picture: PICTURE, logo: LOGO })
    expect(pictures(html)).toHaveLength(1)
    expect(html).toContain(PICTURE)
    expect(html).not.toContain(LOGO)
  })

  it("draws the logo on the plain frame when it has no picture", () => {
    const [image, ...others] = pictures(renderCard({ logo: LOGO }))
    expect(others).toEqual([])
    expect(image).toContain("object-contain")
  })

  it("is a plain frame and its name when it has no art", () => {
    const html = renderCard()
    expect(pictures(html)).toEqual([])
    expect(html).toContain("Catan")
  })

  it("zooms its picture, whichever it is, when the card is hovered", () => {
    expect(renderCard({ picture: PICTURE })).toContain("group-hover/game-card:scale-103")
    expect(renderCard({ logo: LOGO })).toContain("group-hover/game-card:scale-103")
  })

  it("says Coming soon on a game to come, with the same frame", () => {
    const html = renderCard({ variant: "soon", picture: PICTURE })
    expect(html).toContain("Coming soon")
    expect(html).toContain(PICTURE)
    expect(renderCard({ picture: PICTURE })).not.toContain("Coming soon")
  })
})
