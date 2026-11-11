import { readFileSync } from "node:fs"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import type { GameOverEntry } from "../../lib/game-over"
import type { PublicPlayer } from "../../lib/game-types"
import { rematchOf } from "../../lib/rematch"
import { gameOverTheme, seatTheme } from "../../lib/ui-theme"
import { GameOverCard, type GameOverCardProps, type PodiumPlace } from "./game-over-card"

const player = (id: string, nickname: string, left = false): PublicPlayer => ({ id, nickname, ...(left ? { left: true } : {}) })
const ann = player("a", "Ann")
const bob = player("b", "Bob")
const cy = player("c", "Cy")

const entry = (playerId: string, nickname: string, total: number, rank: number, detail: GameOverEntry["result"]["detail"] = []): GameOverEntry => ({
  result: { playerId, total, rank, detail },
  nickname,
  color: "#d94f4f",
})
const place = (rank: number, entries: GameOverEntry[], label?: string): PodiumPlace => ({ rank, entries, ...(label ? { label } : {}) })

const A = entry("a", "Ann", 9, 1, [
  { key: "cards", label: "Cards", points: 7 },
  { key: "bonus", label: "Bonus", points: 2 },
])
const C = entry("c", "Cy", 6, 2)
const B = entry("b", "Bob", 4, 3)
const THREE = [place(1, [A]), place(2, [C]), place(3, [B])]

/** The markup of the card on the server: what is on it once it is drawn, with no motion in the way. */
function markup(props: Partial<GameOverCardProps> = {}) {
  const all: GameOverCardProps = {
    theme: gameOverTheme(),
    seat: seatTheme(),
    crown: (size) => createElement("i", { className: size }),
    summary: { title: "You won", outcome: "win", place: 1, of: 3, points: 9 },
    places: THREE,
    winners: ["a"],
    meId: "a",
    rematch: rematchOf([ann, bob, cy], [], "a", 2),
    motion: "reduced",
    onRematch: () => {},
    onContinue: () => {},
    ...props,
  }
  return renderToStaticMarkup(createElement(GameOverCard, all))
}

const button = (html: string, word: string) => new RegExp(`<button\\b[^>]*>(?:(?!</button>).)*${word}(?:(?!</button>).)*</button>`, "s").exec(html)?.[0]

/** Whether a button is switched off: its attribute, not the `disabled:` classes that a button may carry. */
const isOff = (tag: string | undefined) => / disabled=""/.test(tag ?? "")

/** The steps of the podium, in the order they are in the page: each `<li>` of its list. */
const steps = (html: string) => (/<ol aria-label="Podium"[^>]*>(.*?)<\/ol>/s.exec(html)?.[1] ?? "").split("<li ").slice(1)
const columnOf = (step: string) => /col-start-(\d)/.exec(step)?.[1]
const crowns = (html: string) => (html.match(/aria-label="Winner"/g) ?? []).length
/** The pictures on a step: the initial of each, as the seat label draws it. */
const faces = (step: string | undefined) => (step?.match(/<span aria-hidden="true" class="ph-mask">/g) ?? []).length

const HERE = fileURLToPath(new URL(".", import.meta.url))

describe("the end screen", () => {
  it("wears the game's look: the surface, line, corners and ink of the theme, and its accent for the winner", () => {
    const html = markup({ theme: gameOverTheme({ surface: "#f4ecd8", border: "#14110d", radius: "0.25rem", ink: "#14110d", accent: "#c8321e" }) })
    expect(html).toContain("background:#f4ecd8")
    expect(html).toContain("border-color:#14110d")
    expect(html).toContain("border-radius:0.25rem")
    expect(html).toContain("color:#14110d")
    expect(html).toContain("--go-accent:#c8321e")
    expect(html).toContain("color:var(--go-accent)")
  })

  it("follows the tokens of the game's skin by default", () => {
    const html = markup()
    expect(html).toContain("background:var(--surface)")
    expect(html).toContain("--go-accent:var(--accent-game)")
  })

  it("holds nothing of the platform's look: no class of its own, no component of it", () => {
    const html = markup()
    expect(html).not.toMatch(/(?<![\w-])platform(?![\w-])/)
    expect(html).not.toContain("glass")
    for (const file of ["game-over-card.tsx", "game-over.tsx"]) {
      const code = readFileSync(join(HERE, file), "utf8")
      expect(code, `${file} draws a component of the platform`).not.toMatch(/@pbgo\/ui\/platform\//)
      expect(code, `${file} wears the platform class`).not.toMatch(/(?<![\w-])platform(?![\w-])\s+[a-z]/)
    }
  })

  it("says how it ended for the visitor, with their score, in the accent for a win", () => {
    const html = markup()
    expect(html).toContain(">You won</h2>")
    expect(html).toMatch(/<h2[^>]*style="color:var\(--go-accent\)"/)
    expect(html).toContain(">9 pts<")
    expect(markup({ summary: { title: "You lost", outcome: "loss", place: 2, of: 2, points: 1 } })).toContain(">1 pt<")
    expect(markup({ summary: { title: "You lost", outcome: "loss", place: 2, of: 2, points: 1 } })).not.toMatch(/<h2[^>]*style=/)
  })

  it("has a Continue button and a Rematch button, and never a way back home worded as one", () => {
    const html = markup()
    expect(button(html, "Continue")).toBeTruthy()
    expect(button(html, "Rematch")).toBeTruthy()
    expect(html).not.toMatch(/back to home/i)
  })

  it("keeps the scores of every player behind a button, closed to begin with", () => {
    const html = markup()
    expect(html).toMatch(/aria-label="Final ranking" class="[^"]*\bhidden\b/)
    expect(button(html, "Show scores")).toContain('aria-expanded="false"')
    // The lines of each player are in the page for when it opens
    expect(html).toContain("Cards")
    expect(html).toContain("+7")
    expect(html).toContain("Bonus")
  })

  it("writes no score for a game that counts no points", () => {
    const html = markup({ summary: { title: "You won", outcome: "win", place: 1, of: 3, points: null } })
    expect(html).not.toContain(" pts<")
  })

  it("shares the result from the corner, once its picture is drawn", () => {
    const share = (html: string) => /<button\b[^>]*aria-label="Share the result"[^>]*>/.exec(html)?.[0]
    expect(isOff(share(markup()))).toBe(true)
    expect(isOff(share(markup({ onShare: () => {} })))).toBe(false)
  })
})

describe("the podium", () => {
  it("puts the winner in the middle, the second on its left and the third on its right, in the order of the places", () => {
    const [first, second, third] = steps(markup())
    expect(columnOf(first!)).toBe("2")
    expect(columnOf(second!)).toBe("1")
    expect(columnOf(third!)).toBe("3")
    expect(first).toContain("Ann (you)")
    expect(second).toContain("Cy")
    expect(third).toContain("Bob")
  })

  it("crowns the winner only, and makes the first step the highest", () => {
    const [first, second, third] = steps(markup())
    expect(crowns(first!)).toBe(1)
    expect(crowns(second!)).toBe(0)
    expect(crowns(third!)).toBe(0)
    expect(first).toContain("h-20")
    expect(second).toContain("h-14")
    expect(third).toContain("h-10")
  })

  it("writes the rank on each step and the score under each name", () => {
    const [first, second] = steps(markup())
    expect(first).toContain(">1</span></div>")
    expect(second).toContain(">2</span></div>")
    expect(first).toContain(">9 pts<")
    expect(second).toContain(">6 pts<")
  })

  it("keeps the winner in the middle at a table of two, with the other player on its left", () => {
    const two = steps(markup({ places: [place(1, [A]), place(2, [C])] }))
    expect(two).toHaveLength(2)
    expect(columnOf(two[0]!)).toBe("2")
    expect(columnOf(two[1]!)).toBe("1")
  })

  it("keeps a single player in the middle too", () => {
    const one = steps(markup({ places: [place(1, [A])] }))
    expect(one).toHaveLength(1)
    expect(columnOf(one[0]!)).toBe("2")
  })

  it("has a step for the first three places and a row under the podium for each place after them", () => {
    const D = entry("d", "Dee", 3, 4)
    const E = entry("e", "Eve", 1, 5)
    const html = markup({ places: [...THREE, place(4, [D]), place(5, [E])] })
    expect(steps(html)).toHaveLength(3)
    const rows = /<ol aria-label="Other places"[^>]*>(.*?)<\/ol>/s.exec(html)?.[1] ?? ""
    expect(rows.split("<li ").length - 1).toBe(2)
    expect(rows.indexOf("Dee")).toBeLessThan(rows.indexOf("Eve"))
    expect(rows).toContain(">4<")
    expect(rows).toContain(">5<")
  })

  it("has no rows under the podium when everybody is on a step", () => {
    expect(markup()).not.toContain('aria-label="Other places"')
  })

  it("lights the row of the visitor when they are after the third place", () => {
    const D = entry("d", "Dee", 3, 4)
    const html = markup({ places: [...THREE, place(4, [D])], meId: "d", winners: ["a"] })
    expect(/<ol aria-label="Other places"[^>]*>(.*?)<\/ol>/s.exec(html)?.[1]).toContain("bg-current/10")
  })

  it("draws the pictures of the players in the shape the game picked for its seats", () => {
    const round = steps(markup())[0]
    expect(round).toContain("rounded-full")
    const square = steps(markup({ seat: seatTheme({ shape: "square" }) }))[0]
    expect(square).toContain("rounded-[24%]")
  })

  it("writes a name in the colour of its seat when the game asks for it, and in the ink of the card when it does not", () => {
    expect(steps(markup())[0]).toMatch(/<p[^>]*style="color:#d94f4f"/)
    expect(steps(markup({ seat: seatTheme({ name: "ink" }) }))[0]).not.toMatch(/<p[^>]*style="color:#d94f4f"/)
  })

  it("draws the crown the game gives it", () => {
    expect(steps(markup({ crown: (size) => createElement("b", { "data-mark": "host", className: size }) }))[0]).toContain('data-mark="host"')
  })
})

describe("a tie and a team", () => {
  it("puts the players who share a place on one step, side by side, with their names together", () => {
    const D = entry("d", "Dee", 9, 1)
    const html = markup({ places: [place(1, [A, D]), place(3, [B])], winners: ["a", "d"] })
    const [first, second] = steps(html)
    expect(first).toContain("Ann (you) and Dee")
    expect(faces(first)).toBe(2)
    // The step after the tie is the third, and it keeps its rank
    expect(second).toContain(">3</span></div>")
    expect(crowns(first!)).toBe(1)
  })

  it("names a team by its label, with the names of its players under it", () => {
    const D = entry("d", "Dee", 12, 1)
    const html = markup({ places: [place(1, [A, D], "Red team"), place(2, [C, B], "Blue team")], winners: ["a", "d"] })
    const [first, second] = steps(html)
    expect(first).toContain("Red team")
    expect(first).toContain("Ann (you) and Dee")
    expect(second).toContain("Blue team")
    expect(second).toContain("Cy and Bob")
    expect(first?.indexOf("Red team")).toBeLessThan(first?.indexOf("Ann (you) and Dee") ?? 0)
  })
})

describe("a table that plays together", () => {
  const all = place(1, [entry("a", "Ann", 11, 1), entry("b", "Bob", 11, 1), entry("c", "Cy", 11, 1)])

  it("has no podium: one place for everybody, crowned and in the accent when the table won", () => {
    const html = markup({ summary: { title: "Victory", outcome: "win", place: null, of: 3, points: 11 }, places: [all], winners: ["a", "b", "c"], together: "won" })
    expect(html).not.toContain('aria-label="Podium"')
    expect(html).toContain(">Victory</h2>")
    expect(html).toMatch(/<h2[^>]*style="color:var\(--go-accent\)"/)
    expect(html).toContain("Ann (you), Bob and Cy")
    expect(crowns(html)).toBe(1)
    expect(html).toContain(">11 pts<")
  })

  it("is not crowned when the table lost, and says defeat in the ink of the card", () => {
    const html = markup({ summary: { title: "Defeat", outcome: "loss", place: null, of: 3, points: 11 }, places: [all], winners: [], together: "lost" })
    expect(html).not.toContain('aria-label="Podium"')
    expect(html).toContain(">Defeat</h2>")
    expect(html).not.toMatch(/<h2[^>]*style=/)
    expect(crowns(html)).toBe(0)
    expect(html).toContain("Ann (you), Bob and Cy")
  })
})

describe("the rank points", () => {
  it("shows what a ranked game gave, in the accent, once it is known", () => {
    const html = markup({ rank: { recorded: true, ranked: true, points: 18 } })
    expect(html).toContain(">Ranked<")
    expect(html).toContain("+18")
    expect(html).toContain("rank points")
  })

  it("shows what it took, with a real minus and less of the ink", () => {
    const html = markup({ rank: { recorded: true, ranked: true, points: -11 } })
    expect(html).toContain("−11")
    expect(html).toMatch(/opacity-70[^>]*>−11 rank points/)
  })

  it("says nothing of the rank for a game that did not count, for a guest, or while it is not known", () => {
    for (const rank of [undefined, null, { recorded: false, ranked: false, points: null }, { recorded: true, ranked: false, points: null }]) {
      const html = markup({ rank })
      expect(html).not.toContain(">Ranked<")
      expect(html).not.toContain("rank points")
    }
  })

  it("says it was ranked even when the game gave no points to this player", () => {
    const html = markup({ rank: { recorded: true, ranked: true, points: null } })
    expect(html).toContain(">Ranked<")
    expect(html).not.toContain("rank points")
  })
})

describe("the rematch", () => {
  it("is open to the visitor while nobody asked", () => {
    const html = markup()
    expect(isOff(button(html, "Rematch"))).toBe(false)
    expect(html).not.toContain('role="status"')
  })

  it("says who asked and how many of the players there agreed", () => {
    const html = markup({ rematch: rematchOf([ann, bob, cy], ["b"], "a", 2) })
    expect(html).toContain("Bob wants a rematch.")
    expect(html).toContain(">1/3<")
    expect(isOff(button(html, "Rematch"))).toBe(false)
  })

  it("is off once the visitor agreed, and says whom the table waits for", () => {
    const html = markup({ rematch: rematchOf([ann, bob, cy], ["a"], "a", 2) })
    expect(isOff(button(html, "Rematch"))).toBe(true)
    expect(html).toContain("Waiting for Bob and Cy.")
  })

  it("is off while the vote is being sent", () => {
    expect(isOff(button(markup({ voting: true }), "Rematch"))).toBe(true)
  })

  it("is off when too few players are left for another game, and says who left", () => {
    const html = markup({ rematch: rematchOf([ann, player("b", "Bob", true)], [], "a", 2) })
    expect(isOff(button(html, "Rematch"))).toBe(true)
    expect(html).toContain("Not enough players are left for another game. Bob left the table.")
    expect(html).not.toMatch(/>\d\/\d</)
  })

  it("does not count a player who left among those who answer", () => {
    const html = markup({ rematch: rematchOf([ann, player("b", "Bob", true), cy], ["c"], "a", 2) })
    expect(html).toContain(">1/2<")
  })

  it("has both buttons off where there is nothing to act on, as in a preview", () => {
    const html = markup({ onRematch: undefined, onContinue: undefined })
    expect(isOff(button(html, "Rematch"))).toBe(true)
    expect(isOff(button(html, "Continue"))).toBe(true)
  })
})
