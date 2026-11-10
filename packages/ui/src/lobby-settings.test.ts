import * as React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { LobbySettings, type ExpansionOption, type LobbySettingsProps } from "./platform/lobby-settings"

const plain: ExpansionOption = { id: "smile-life-more", name: "More Smile Life" }
const adults: ExpansionOption = { id: "smile-life-18", name: "Smile Life +18", locked: { reason: "Add your date of birth to play it", kind: "date" } }

function render(props: Partial<LobbySettingsProps> = {}): string {
  return renderToStaticMarkup(React.createElement(LobbySettings, { pace: "normal", expansions: [plain, adults], editable: true, ...props }))
}

/** The card of an expansion, from its opening tag to the next card. */
const cardOf = (html: string, name: string): string => {
  const start = html.indexOf(name)
  expect(start, name).toBeGreaterThan(-1)
  return html.slice(Math.max(0, html.lastIndexOf('data-slot="lobby-expansion"', start)), start + 1200)
}

describe("the expansions of a lobby that the visitor cannot choose", () => {
  it("say why, in the muted line of the figures, with a lock", () => {
    const card = cardOf(render(), "Smile Life +18")
    expect(card).toContain("Add your date of birth to play it")
    expect(card).toMatch(/<svg/)
  })

  it("keep their box unticked, and name the reason as part of what describes the box", () => {
    const html = render()
    const card = cardOf(html, "Smile Life +18")
    expect(card).toContain('role="checkbox"')
    expect(card).toContain('aria-checked="false"')
    const described = /aria-describedby="([^"]+)"/.exec(card)?.[1]
    expect(described, "aria-describedby").toBeTruthy()
    const lockedId = /id="([^"]+-locked)"/.exec(card)?.[1]
    expect(lockedId, "the id of the reason").toBeTruthy()
    expect(described!.split(" ")).toContain(lockedId)
  })

  it("are said nothing of on an expansion that has no lock", () => {
    expect(cardOf(render(), "More Smile Life")).not.toContain("-locked")
  })

  it("lose their lock once they are chosen: one that is on can always be left", () => {
    const html = render({ chosen: ["smile-life-18"] })
    // The reason is for choosing, and the expansion is chosen already
    expect(html).not.toContain("Add your date of birth to play it")
    expect(html).toContain('aria-checked="true"')
  })

  it("are not mentioned by a table that is read, which shows only what it is played with", () => {
    const html = render({ editable: false, chosen: ["smile-life-more"] })
    expect(html).toContain("More Smile Life")
    expect(html).not.toContain("Smile Life +18")
    expect(html).not.toContain("Add your date of birth to play it")
  })
})
