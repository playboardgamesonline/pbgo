import * as React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { optionMatches } from "./match-options"
import { Combobox } from "./platform/combobox"
import { CountedTextarea } from "./platform/counted-textarea"
import { CoverTile } from "./platform/cover-tile"
import { MultiSelect } from "./platform/multi-select"
import { SearchSelect } from "./platform/search-select"

const render = (element: React.ReactElement): string => renderToStaticMarkup(element)

const GAMES = [
  { value: "courtisans", label: "Courtisans", cover: { picture: "https://cdn.example/courtisans.webp" } },
  { value: "flip-7", label: "Flip 7", cover: { logo: "https://cdn.example/flip-7.svg" } },
  { value: "hanabi", label: "Hanabi", cover: null },
]

describe("optionMatches", () => {
  it("holds the text wherever it is, whatever the case and the accents, and everything for no text", () => {
    expect(optionMatches("Stratégie", "strat")).toBe(true)
    expect(optionMatches("Flip 7", "  P 7")).toBe(true)
    expect(optionMatches("Hanabi", "zz")).toBe(false)
    expect(optionMatches("Hanabi", "   ")).toBe(true)
  })
})

describe("Combobox with a limit", () => {
  const list = (props: Partial<React.ComponentProps<typeof Combobox>>) =>
    render(React.createElement(Combobox, { options: GAMES, value: [], onValueChange: () => {}, placeholder: "Search games...", empty: "No game matches.", "aria-label": "Games", ...props }))

  it("shows the label of an option, not its value, and a cover before it (an empty place for an option with none)", () => {
    const html = list({})
    expect(html).toContain("Courtisans")
    expect(html).not.toContain(">courtisans<")
    expect(html).toContain("https://cdn.example/courtisans.webp")
    expect(html.match(/data-slot="cover-tile"/g)).toHaveLength(3)
  })

  it("leaves the options that are not picked off once the limit is reached, and only those", () => {
    const html = list({ value: ["courtisans", "flip-7"], max: 2 })
    expect(html.match(/aria-disabled="true"/g)).toHaveLength(1)
    expect(html).toMatch(/aria-selected="true"[^>]*>(?:(?!<li).)*Courtisans/s)
  })

  it("is not multiselectable as a single choice", () => {
    expect(list({ max: 1 })).not.toContain("aria-multiselectable")
    expect(list({})).toContain('aria-multiselectable="true"')
  })
})

describe("MultiSelect", () => {
  const field = (props: Partial<React.ComponentProps<typeof MultiSelect>>) =>
    render(React.createElement(MultiSelect, { options: GAMES, value: [], onValueChange: () => {}, max: 5, placeholder: "Add a game", searchPlaceholder: "Search games...", empty: "No game matches.", "aria-label": "Favourite games", ...props }))

  it("says how many are picked of how many can be", () => {
    expect(field({ value: ["flip-7", "hanabi"] })).toContain("2 of 5")
    expect(field({})).toContain("0 of 5")
    expect(field({ value: ["flip-7"], counter: (count, max) => `${count}/${max}` })).toContain("1/5")
  })

  it("draws a chip for each pick, in the order they were picked, each with a button that puts it back", () => {
    const html = field({ value: ["hanabi", "courtisans"] })
    expect(html.indexOf("Hanabi")).toBeLessThan(html.indexOf("Courtisans"))
    expect(html).toContain('aria-label="Remove Hanabi"')
    expect(html).toContain('aria-label="Remove Courtisans"')
  })

  it("turns the button that adds one off when there is no room for a sixth", () => {
    expect(field({ value: ["a", "b", "c", "d", "e"] })).toMatch(/<button[^>]*disabled=""[^>]*>Add a game/)
    expect(field({ value: ["a"] })).not.toMatch(/<button[^>]*disabled=""[^>]*>Add a game/)
  })

  it("names a pick that is not among the options by what it is", () => {
    expect(field({ value: ["gone-game"] })).toContain("gone-game")
  })
})

describe("SearchSelect", () => {
  const select = (props: Partial<React.ComponentProps<typeof SearchSelect>>) =>
    render(React.createElement(SearchSelect, { options: GAMES, value: null, onValueChange: () => {}, placeholder: "Select a game", searchPlaceholder: "Search...", empty: "None.", "aria-label": "Game", ...props }))

  it("says what it is for until something is picked, and then the label of the pick", () => {
    expect(select({})).toContain("Select a game")
    const picked = select({ value: "flip-7" })
    expect(picked).toContain("Flip 7")
    expect(picked).not.toContain("Select a game")
  })

  it("is a combobox that names itself and is closed to begin with", () => {
    const html = select({})
    expect(html).toContain('role="combobox"')
    expect(html).toContain('aria-expanded="false"')
    expect(html).toContain('aria-label="Game"')
  })
})

describe("CountedTextarea", () => {
  it("says the characters that are left, and describes the field with them", () => {
    const html = render(React.createElement(CountedTextarea, { left: 150, "aria-describedby": "bio-help" }))
    expect(html).toContain("150")
    expect(html).toContain("characters left")
    expect(html).toMatch(/aria-describedby="bio-help [^"]+-left"/)
  })

  it("turns red once they run out", () => {
    expect(render(React.createElement(CountedTextarea, { left: -3 }))).toContain("text-destructive")
    expect(render(React.createElement(CountedTextarea, { left: 0 }))).not.toContain("text-destructive")
  })
})

describe("CoverTile", () => {
  it("draws a picture that fills it, else a logo contained, else a plain frame", () => {
    expect(render(React.createElement(CoverTile, { picture: "https://cdn.example/a.webp", logo: "https://cdn.example/l.svg" }))).toContain("object-cover")
    expect(render(React.createElement(CoverTile, { logo: "https://cdn.example/l.svg" }))).toContain("object-contain")
    expect(render(React.createElement(CoverTile, {}))).not.toContain("<img")
  })
})

describe("Combobox with options found by the caller", () => {
  const remote = (props: Partial<React.ComponentProps<typeof Combobox>>) =>
    render(React.createElement(Combobox, { options: [], value: [], onValueChange: () => {}, onQueryChange: () => {}, placeholder: "Search cities...", empty: "No city matches.", "aria-label": "City", ...props }))

  it("says what to do while nothing is typed and there is nothing to show, and that it is searching while the answer is on its way", () => {
    expect(remote({ prompt: "Type the first letters." })).toContain("Type the first letters.")
    expect(remote({ prompt: "Type the first letters." })).not.toContain("No city matches.")
    expect(remote({ prompt: "Type the first letters.", loading: true })).toContain("Searching...")
    expect(remote({})).toContain("No city matches.")
  })

  it("shows the options as they come, each with its description under its name", () => {
    const html = remote({ options: [{ value: "2996944", label: "Lyon", description: "Auvergne-Rhône-Alpes, France" }] })
    expect(html).toContain("Lyon")
    expect(html).toContain("Auvergne-Rhône-Alpes, France")
    expect(html).toContain("h-12")
  })

  it("keeps a list that is its own to filter: with no caller it still filters nothing at the start, and the descriptions make the rows tall", () => {
    const html = render(React.createElement(Combobox, { options: [{ value: "a", description: "x" }, { value: "b" }], value: [], onValueChange: () => {}, placeholder: "Search", empty: "None", "aria-label": "Letters" }))
    expect(html.match(/role="option"/g)).toHaveLength(2)
    expect(html).toContain("h-12")
  })
})

describe("SearchSelect with a pick the options do not hold", () => {
  it("says the pick by its own label", () => {
    const html = render(React.createElement(SearchSelect, { options: [], value: "2996944", selectedLabel: "Lyon, France", onValueChange: () => {}, onQueryChange: () => {}, placeholder: "Not set", searchPlaceholder: "Search cities...", empty: "None", "aria-label": "City" }))
    expect(html).toContain("Lyon, France")
    expect(html).not.toContain("Not set")
  })
})
