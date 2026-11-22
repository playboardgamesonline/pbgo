import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import type { Motion } from "../../lib/motion-preference"
import { hasPrompt, PromptLine } from "./prompt-line"

const render = (prompt?: React.ReactNode, motionMode: Motion = "calm") => renderToStaticMarkup(createElement(PromptLine, { prompt, motionMode }))

/** What the polite live region holds: it is there whether or not there is a sentence, so that a sentence that comes is announced */
const announced = (html: string) => html.match(/<div role="status" aria-live="polite" class="ph-mask sr-only">(.*?)<\/div>/)?.[1]

describe("the prompt line", () => {
  it("says a sentence twice: read out for those who do not see the screen, and drawn, hidden from them, for those who do", () => {
    const html = render("Choose a card to play")
    expect(announced(html)).toBe("Choose a card to play")
    expect(html).toMatch(/<p aria-hidden="true"[^>]*>Choose a card to play<\/p>/)
  })

  it.each([undefined, null, false, ""])("says nothing for %j and keeps its live region", (prompt) => {
    const html = render(prompt)
    expect(announced(html)).toBe("")
    expect(html).not.toContain("<p")
    expect(hasPrompt(prompt)).toBe(false)
  })

  it("takes a node, for a sentence that names a player", () => {
    const html = render(createElement("span", null, "Give it to ", createElement("b", null, "Ann")))
    expect(announced(html)).toBe("<span>Give it to <b>Ann</b></span>")
    expect(html).toMatch(/<p aria-hidden="true"[^>]*><span>Give it to <b>Ann<\/b><\/span><\/p>/)
  })

  it("draws the sentence at rest for a visitor who asks for less motion: no travel", () => {
    expect(render("Choose a card to play", "reduced")).not.toMatch(/translateY\((?!0)/)
  })
})
