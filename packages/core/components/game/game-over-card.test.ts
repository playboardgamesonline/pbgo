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
import type { HistoryTurn } from "./ticker"

const player =(id: string, nickname: string, left = false): PublicPlayer => ({ id, nickname, ...(left ? { left: true } : {}) })
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

/** A turn of the history as the board gives it to its ticker: its author and the lines of what they did. */
const turn = (key: number, playerId: string, ...moves: string[]): HistoryTurn => ({ key, playerId, entries: moves.map((node, index) => ({ key: `${key}:${index}`, node })) })
/** Played in this order, and listed the way the board lists it, the newest turn first: Ann a Spy, Bob a Guard then a Noble, Cy a draw, Ann an Assassin. */
const HISTORY = [turn(7, "a", "plays an Assassin"), turn(5, "c", "draws a card"), turn(2, "b", "plays a Guard", "plays a Noble"), turn(0, "a", "plays a Spy")]

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
/** The rows of the table of the scores, in the order they are in the page: each `<li>` of its list. */
const rows = (html: string) => (/aria-label="Final ranking"[^>]*><ol>(.*?)<\/ol>/s.exec(html)?.[1] ?? "").split("<li ").slice(1)
/** The tabs of the card, as their opening tags. */
const tabs = (html: string) => [...html.matchAll(/<button\b[^>]*role="tab"[^>]*>/g)].map((match) => match[0])
/** The values of a column of the statistics, in the order of its players. */
const column = (html: string, title: string) => [...html.matchAll(new RegExp(`aria-label="${title}: (-?\\d+)"`, "g"))].map((match) => Number(match[1]))
/** What a column of the statistics says in its head besides its name: the total over the table. */
const total = (html: string, title: string) => Number(new RegExp(`>${title}</span><span[^>]*>(\\d+)<`).exec(html)?.[1])
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
    for (const file of ["game-over-card.tsx", "game-over-panels.tsx", "game-over-parts.tsx", "game-over.tsx"]) {
      const code = readFileSync(join(HERE, file), "utf8")
      expect(code, `${file} draws a component of the platform`).not.toMatch(/@pbgo\/ui\/platform\//)
      expect(code, `${file} wears the platform class`).not.toMatch(/(?<![\w-])platform(?![\w-])\s+[a-z]/)
    }
  })

  it("says how it ended for the visitor, in the accent for a win and in the ink of the card for a loss", () => {
    const html = markup()
    expect(html).toContain(">You won</h2>")
    expect(html).toMatch(/<h2[^>]*style="color:var\(--go-accent\)"/)
    const lost = markup({ summary: { title: "You lost", outcome: "loss", place: 2, of: 2, points: 1 } })
    expect(lost).toContain(">You lost</h2>")
    expect(lost).not.toMatch(/<h2[^>]*style=/)
  })

  it("has a Continue button and a Rematch button, and never a way back home worded as one", () => {
    const html = markup()
    expect(button(html, "Continue")).toBeTruthy()
    expect(button(html, "Rematch")).toBeTruthy()
    expect(html).not.toMatch(/back to home/i)
  })

  it("writes no score for a game that counts no points", () => {
    const html = markup({ summary: { title: "You won", outcome: "win", place: 1, of: 3, points: null } })
    expect(html).not.toContain(" pts<")
    expect(html).not.toContain(">Score<")
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
    expect(first).toContain("min-h-24")
    expect(second).toContain("min-h-[4.75rem]")
    expect(third).toContain("min-h-[3.75rem]")
  })

  it("writes the name and the score on the face of each step, and no number", () => {
    const [first, second, third] = steps(markup())
    expect(first).toContain(">9 pts<")
    expect(second).toContain(">6 pts<")
    for (const step of [first, second, third]) expect(step).not.toMatch(/>\d<\//)
  })

  it("makes the steps touch each other, so that together they make one podium", () => {
    expect(/<ol aria-label="Podium" class="([^"]*)"/.exec(markup())?.[1]).not.toMatch(/\bgap-/)
  })

  it("puts the players on the steps and the name on their face: the pictures come before the name in a step", () => {
    const [first] = steps(markup())
    expect(first!.indexOf("ph-mask\">A<")).toBeLessThan(first!.indexOf("Ann (you)"))
  })

  it("shares the whole width between two places, the second on the left of the first", () => {
    const html = markup({ places: [place(1, [A]), place(2, [C])] })
    const two = steps(html)
    expect(two).toHaveLength(2)
    expect(/<ol aria-label="Podium" class="([^"]*)"/.exec(html)?.[1]).toContain("grid-cols-2")
    expect(columnOf(two[0]!)).toBe("2")
    expect(columnOf(two[1]!)).toBe("1")
  })

  it("gives a single place the whole width", () => {
    const html = markup({ places: [place(1, [A])] })
    const one = steps(html)
    expect(one).toHaveLength(1)
    expect(/<ol aria-label="Podium" class="([^"]*)"/.exec(html)?.[1]).toContain("grid-cols-1")
    expect(columnOf(one[0]!)).toBe("1")
  })

  it("has three columns for three places or more, the winner in the middle", () => {
    expect(/<ol aria-label="Podium" class="([^"]*)"/.exec(markup())?.[1]).toContain("grid-cols-3")
  })

  it("says how it ended at the very top, above the podium", () => {
    const html = markup()
    expect(html.indexOf("<h2")).toBeGreaterThan(-1)
    expect(html.indexOf("<h2")).toBeLessThan(html.indexOf('aria-label="Podium"'))
    const together = markup({ summary: { title: "Victory", outcome: "win", place: null, of: 3, points: 11 }, places: [place(1, [entry("a", "Ann", 11, 1), entry("b", "Bob", 11, 1)])], winners: ["a", "b"], together: "won" })
    expect(together.indexOf("<h2")).toBeLessThan(together.indexOf('aria-label="Winner"'))
  })

  it("has a step for the first three places only: the others are in the table of the scores with everybody else", () => {
    const D = entry("d", "Dee", 3, 4)
    const E = entry("e", "Eve", 1, 5)
    const html = markup({ places: [...THREE, place(4, [D]), place(5, [E])] })
    expect(steps(html)).toHaveLength(3)
    expect(html).not.toContain('aria-label="Other places"')
    expect(steps(html).join("")).not.toContain("Dee")
    expect(rows(html)).toHaveLength(5)
  })

  it("draws the pictures of the players round, even for a game whose seats are square", () => {
    for (const html of [markup(), markup({ seat: seatTheme({ shape: "square" }) })]) {
      expect(steps(html)[0]).toContain("rounded-full")
      expect(html).not.toContain("rounded-[24%]")
    }
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
    // The step after the tie is the next place, with its own player
    expect(second).toContain("Bob")
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
    // One crown over the whole place, and one before each player in the table of the scores
    expect(crowns(html.slice(0, html.indexOf('aria-label="Details of the game"')))).toBe(1)
    expect(crowns(html)).toBe(4)
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

describe("the scores", () => {
  it("are a table in view as soon as the card is, under the podium, with no button to open", () => {
    const html = markup()
    expect(html).toContain('aria-label="Final ranking"')
    expect(html).not.toMatch(/aria-label="Final ranking"[^>]*class="[^"]*\bhidden\b/)
    expect(html).not.toMatch(/Show scores|Hide scores/)
    expect(html.indexOf('aria-label="Podium"')).toBeLessThan(html.indexOf('aria-label="Final ranking"'))
  })

  it("keep their head apart from the rows, so that the head stays while the rows scroll", () => {
    const html = markup()
    expect(html).toContain(">Player<")
    expect(html).toContain(">Score<")
    expect(html.indexOf(">Player<")).toBeLessThan(html.indexOf('aria-label="Final ranking"'))
  })

  it("have a row for every player from the first place to the last, with their place, their name and their total", () => {
    const [first, second, third] = rows(markup())
    expect(first).toContain("Ann")
    expect(first).toContain(">9<")
    expect(crowns(first!)).toBe(1)
    expect(second).toContain("Cy")
    expect(second).toContain(">2<")
    expect(second).toContain(">6<")
    expect(crowns(second!)).toBe(0)
    expect(third).toContain("Bob")
    expect(third).toContain(">3<")
    expect(third).toContain(">4<")
  })

  it("write the lines of each score under the player on a narrow card, and beside them on a wide one", () => {
    const [first] = rows(markup())
    expect(first).toContain("Cards")
    expect(first).toContain("+7")
    expect(first).toContain("Bonus")
    expect(first).toContain("+2")
    // Under the player by default, beside them once the card is wide enough for it
    expect(first).toContain("row-start-2")
    expect(first).toContain("@xl:col-start-3")
    expect(first).toContain("@xl:row-start-1")
  })

  it("light the row of the visitor and mark it, and no other", () => {
    const [first, second] = rows(markup())
    expect(first).toContain("bg-current/10")
    expect(first).toContain("(you)")
    expect(second).not.toContain("bg-current/10")
    expect(second).not.toContain("(you)")
  })

  it("light the row of a visitor who is after the third place", () => {
    const D = entry("d", "Dee", 3, 4)
    const all = rows(markup({ places: [...THREE, place(4, [D])], meId: "d", winners: ["a"] }))
    expect(all).toHaveLength(4)
    expect(all[3]).toContain("bg-current/10")
    expect(all[3]).toContain("(you)")
  })

  it("show the lines the way the game draws them, when it gives its own rendering", () => {
    const [first] = rows(markup({ renderDetail: (result) => createElement("em", null, `lines of ${result.playerId}`) }))
    expect(first).toContain("<em>lines of a</em>")
    expect(first).not.toContain("Cards")
  })

  it("have the places and the players only for a game that counts no points", () => {
    const html = markup({ summary: { title: "You won", outcome: "win", place: 1, of: 3, points: null } })
    const [first] = rows(html)
    expect(first).toContain("Ann")
    expect(first).not.toContain(">9<")
    expect(first).not.toContain("Cards")
    expect(html).not.toContain(">Score<")
  })

  it("name the team a player is on, after their name", () => {
    const D = entry("d", "Dee", 12, 1)
    const [first, , third] = rows(markup({ places: [place(1, [A, D], "Red team"), place(2, [C, B], "Blue team")], winners: ["a", "d"] }))
    expect(first).toContain("Red team")
    expect(third).toContain("Blue team")
  })

  it("number nobody at a table that plays together, and crown every player of a table that won", () => {
    const all = place(1, [entry("a", "Ann", 11, 1), entry("b", "Bob", 11, 1)])
    const won = markup({ summary: { title: "Victory", outcome: "win", place: null, of: 2, points: 11 }, places: [all], winners: ["a", "b"], together: "won" })
    expect(rows(won)).toHaveLength(2)
    expect(rows(won).map(crowns)).toEqual([1, 1])
    const lost = markup({ summary: { title: "Defeat", outcome: "loss", place: null, of: 2, points: 11 }, places: [all], winners: [], together: "lost" })
    expect(rows(lost).map(crowns)).toEqual([0, 0])
    for (const row of rows(lost)) expect(row).not.toMatch(/opacity-55">1</)
  })
})

describe("the tabs", () => {
  it("are not there while the game gives no history: the table of the scores is all that lies under the podium", () => {
    const html = markup()
    expect(html).not.toContain('role="tablist"')
    expect(tabs(html)).toHaveLength(0)
    expect(html).not.toContain('role="tabpanel"')
  })

  it("are the scores, the statistics and the history for a game that gives its history, the scores open", () => {
    const html = markup({ history: HISTORY })
    const all = tabs(html)
    expect(all).toHaveLength(3)
    expect(all[0]).toContain('aria-selected="true"')
    expect(all[0]).toContain('tabindex="0"')
    for (const other of all.slice(1)) {
      expect(other).toContain('aria-selected="false"')
      expect(other).toContain('tabindex="-1"')
    }
    expect(html).toMatch(/role="tab"[^>]*>(?:<svg(?:(?!<\/svg>).)*<\/svg>)?Scores</s)
    expect(html).toMatch(/role="tab"[^>]*>(?:<svg(?:(?!<\/svg>).)*<\/svg>)?Stats</s)
    expect(html).toMatch(/role="tab"[^>]*>(?:<svg(?:(?!<\/svg>).)*<\/svg>)?History</s)
  })

  it("call the first one the ranking when the game counts no points", () => {
    const html = markup({ history: HISTORY, summary: { title: "You won", outcome: "win", place: 1, of: 3, points: null } })
    expect(html).toMatch(/role="tab"[^>]*>(?:<svg(?:(?!<\/svg>).)*<\/svg>)?Ranking</s)
    expect(html).not.toMatch(/role="tab"[^>]*>(?:<svg(?:(?!<\/svg>).)*<\/svg>)?Scores</s)
  })

  it("open the tab they are told to, and only that one", () => {
    const stats = markup({ history: HISTORY, defaultTab: "stats" })
    expect(tabs(stats)[1]).toContain('aria-selected="true"')
    expect(stats).toContain('aria-label="Statistics"')
    expect(stats).not.toContain('aria-label="Final ranking"')
    expect(stats).not.toContain('aria-label="History of the game"')
    const history = markup({ history: HISTORY, defaultTab: "history" })
    expect(tabs(history)[2]).toContain('aria-selected="true"')
    expect(history).toContain('aria-label="History of the game"')
    expect(history).not.toContain('aria-label="Final ranking"')
  })

  it("fall back to the scores when the tab asked for is not there", () => {
    expect(markup({ defaultTab: "history" })).toContain('aria-label="Final ranking"')
    expect(markup({ history: [], defaultTab: "stats" })).toContain('aria-label="Final ranking"')
  })

  it("point the open tab at its panel, and the panel back at the tab", () => {
    const html = markup({ history: HISTORY, defaultTab: "stats" })
    const open = tabs(html)[1]!
    const id = /\bid="([^"]+)"/.exec(open)?.[1]
    const controls = /aria-controls="([^"]+)"/.exec(open)?.[1]
    expect(id).toBeTruthy()
    expect(html).toContain(`role="tabpanel" id="${controls}" aria-labelledby="${id}"`)
  })
})

describe("the statistics", () => {
  const stats = (props: Partial<GameOverCardProps> = {}) => markup({ history: HISTORY, defaultTab: "stats", ...props })

  it("count the turns and the moves of each player from the history of the game, with the totals in the head of their columns", () => {
    const html = stats()
    // The players are in the order of the places: Ann, Cy, Bob
    expect(column(html, "Turns")).toEqual([2, 1, 1])
    expect(total(html, "Turns")).toBe(4)
    expect(column(html, "Moves")).toEqual([2, 1, 2])
    expect(total(html, "Moves")).toBe(5)
  })

  it("have a column of the scores for a game that counts points, and none for one that does not", () => {
    expect(column(stats(), "Score")).toEqual([9, 6, 4])
    const none = stats({ summary: { title: "You won", outcome: "win", place: 1, of: 3, points: null } })
    expect(column(none, "Score")).toEqual([])
    expect(column(none, "Turns")).toEqual([2, 1, 1])
  })

  it("keep the players in the order of the places, one row each", () => {
    const html = /aria-label="Statistics".*$/s.exec(stats())?.[0] ?? ""
    expect(html.indexOf("Ann")).toBeLessThan(html.indexOf("Cy"))
    expect(html.indexOf("Cy")).toBeLessThan(html.indexOf("Bob"))
    expect(html.match(/>Ann</g)).toHaveLength(1)
  })

  it("draw the bar of a player in the colour of their seat", () => {
    expect(stats()).toContain("background-color:#d94f4f")
  })

  it("light the highest value of a column in the accent", () => {
    const html = stats()
    expect(html).toMatch(/style="color:var\(--go-accent\)">9</)
    expect(html).not.toMatch(/style="color:var\(--go-accent\)">6</)
    // Ann took two turns, the others one
    expect(html).toMatch(/style="color:var\(--go-accent\)">2</)
  })

  it("light nobody in a column where everybody has the same value", () => {
    const even = [turn(2, "c", "plays a Spy"), turn(1, "b", "plays a Guard"), turn(0, "a", "plays a Noble")]
    const html = markup({ history: even, defaultTab: "stats", summary: { title: "You won", outcome: "win", place: 1, of: 3, points: null } })
    expect(column(html, "Turns")).toEqual([1, 1, 1])
    expect(html).not.toMatch(/style="color:var\(--go-accent\)">1</)
  })
})

describe("the history", () => {
  const history = (props: Partial<GameOverCardProps> = {}) => markup({ history: HISTORY, defaultTab: "history", ...props })
  const region = (html: string) => /aria-label="History of the game".*?<\/ol><\/div>/s.exec(html)?.[0] ?? ""

  it("tells the game from its first turn to its last, whereas the board lists the newest turn first", () => {
    const html = region(history())
    const order = ["plays a Spy", "plays a Guard", "plays a Noble", "draws a card", "plays an Assassin"].map((line) => html.indexOf(line))
    expect(order.every((at) => at > -1)).toBe(true)
    expect(order).toEqual([...order].sort((a, b) => a - b))
  })

  it("number the turns from one", () => {
    expect([...region(history()).matchAll(/opacity-45">(\d+)</g)].map((match) => match[1])).toEqual(["1", "2", "3", "4"])
  })

  it("name who took each turn, and light and mark the turns of the visitor", () => {
    const html = region(history())
    for (const name of ["Ann", "Bob", "Cy"]) expect(html).toContain(name)
    expect(html).toContain("(you)")
    expect((html.match(/bg-current\/\[0\.06\]/g) ?? []).length).toBe(2)
  })

  it("put the lines of a turn under one another", () => {
    const html = region(history())
    expect(html.indexOf("plays a Guard")).toBeLessThan(html.indexOf("plays a Noble"))
    expect(/<li class="min-w-0[^"]*">plays a Guard<\/li><li class="min-w-0[^"]*">plays a Noble<\/li>/.test(html)).toBe(true)
  })

  it("have the picture of the player and no name before a line for a game whose lines say who did what themselves", () => {
    const html = region(history({ sentences: true }))
    for (const name of ["Ann", "Bob", "Cy"]) expect(html).not.toContain(name)
    expect(html).not.toContain("(you)")
    expect(html).toContain("ph-mask")
    expect(html).toContain("plays a Spy")
  })

  it("draw what the game rendered, a node as well as a text", () => {
    const html = region(markup({ history: [{ key: 1, playerId: "a", entries: [{ key: "1:0", node: createElement("strong", null, "a Queen") }] }], defaultTab: "history" }))
    expect(html).toContain("<strong>a Queen</strong>")
  })
})

describe("the experience", () => {
  it("shows what the game gave, in any mode: with the rank points of a ranked game and alone for a normal one", () => {
    const normal = markup({ rank: { recorded: true, ranked: false, points: null, xp: 24 } })
    expect(normal).toContain("+24 XP")
    expect(normal).not.toContain(">Ranked<")
    const ranked = markup({ rank: { recorded: true, ranked: true, points: 18, xp: 31 } })
    expect(ranked).toContain("+31 XP")
    expect(ranked).toContain("+18")
  })

  it("says nothing of it for a guest, while the game is not written down, where it is not known, or when the game gave none", () => {
    for (const rank of [undefined, null, { recorded: false, ranked: false, points: null, xp: 24 }, { recorded: true, ranked: false, points: null }, { recorded: true, ranked: false, points: null, xp: null }, { recorded: true, ranked: false, points: null, xp: 0 }]) {
      expect(markup({ rank })).not.toContain(" XP")
    }
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
    expect(html).toMatch(/class="[^"]*opacity-70[^"]*">(?:<svg(?:(?!<\/svg>).)*<\/svg>)?−11</s)
    expect(html).toContain("rank points")
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
