import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import type { GameOverEntry } from "../../lib/game-over"
import { gameOverTheme, seatTheme } from "../../lib/ui-theme"
import { GameOverPanel, type GameOverPanelProps } from "./game-over-panel"

const entry = (playerId: string, nickname: string, total: number, rank: number): GameOverEntry => ({
  result: { playerId, total, rank, detail: [] },
  nickname,
  color: "#d94f4f",
})

const labels = { scoreboard: "Scoreboard", winnerTitle: "Winner:", defeatTitle: "Defeat", shareResult: "Share the result", points: (n: number) => `${n} pts` }

/** The markup of the panel on the server: the texts and the crowns that are there once it is drawn, with no motion in the way. */
function markup(props: Partial<GameOverPanelProps>) {
  const all: GameOverPanelProps = {
    theme: gameOverTheme(),
    seat: seatTheme(),
    motion: "reduced",
    winners: [],
    others: [],
    labels,
    crown: () => createElement("i", { "data-crown": "" }),
    footer: "",
    thumbnail: null,
    ...props,
  }
  return renderToStaticMarkup(createElement(GameOverPanel, all))
}

const crowns = (html: string) => (html.match(/data-crown/g) ?? []).length

describe("the game-over panel", () => {
  it("says winner over the hero and crowns the winners", () => {
    const html = markup({ winners: [entry("a", "Ada", 9, 1)], others: [entry("b", "Bob", 4, 2)] })
    expect(html).toContain("Winner:")
    expect(html).not.toContain("Defeat")
    expect(crowns(html)).toBe(1)
  })

  it("says defeat over the ranking of a table that lost together, with nobody crowned", () => {
    const html = markup({ lost: true, others: [entry("a", "Ada", 7, 1), entry("b", "Bob", 7, 1)] })
    expect(html).toContain("Defeat")
    expect(html).not.toContain("Winner:")
    expect(html).not.toContain("Scoreboard")
    expect(html).toContain("Ada")
    expect(html).toContain("Bob")
    expect(crowns(html)).toBe(0)
  })

  it("says scoreboard when nobody won and the table did not lose together", () => {
    const html = markup({ others: [entry("a", "Ada", 7, 1)] })
    expect(html).toContain("Scoreboard")
    expect(html).not.toContain("Defeat")
  })

  it("keeps the winners' title for a table that won together, whatever `lost` says", () => {
    const html = markup({ winners: [entry("a", "Ada", 12, 1), entry("b", "Bob", 12, 1)], lost: false })
    expect(html).toContain("Winner:")
    expect(crowns(html)).toBe(2)
  })
})
