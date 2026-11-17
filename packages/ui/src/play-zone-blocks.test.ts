import * as React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { Combobox } from "./platform/combobox"
import { GameSelect } from "./platform/game-select"
import { FriendPicker } from "./platform/invite-friend"
import { LobbyPlayerCount, LobbySettings } from "./platform/lobby-settings"
import { ModeSwitch } from "./platform/mode-switch"
import { AddGameTile, PickedGame } from "./platform/picked-game"
import { PlayerSlots, type SlotPlayer } from "./platform/player-slots"
import { PLAY_ZONE_LABELS, PLAY_ZONE_MODES } from "./play-zone"
import type { Friend } from "./friends"

// The blocks of the signed-in home's play zone, by their markup: the switch that fits its cases, the row of places with the visitor first, the panel of friends of a free place, the games that cannot be picked, the tile that opens its settings and the
// players of a table that is about to be opened.

const render = (element: React.ReactElement): string => renderToStaticMarkup(element)

const ICON = [["path", { d: "M1 1h2", stroke: "currentColor", key: "p" }]] as never

describe("the switch of the play zone", () => {
  const options = PLAY_ZONE_MODES.map((value) => ({ value, label: PLAY_ZONE_LABELS[value], icon: ICON }))
  const html = (props: Partial<React.ComponentProps<typeof ModeSwitch>> = {}) =>
    render(React.createElement(ModeSwitch, { options, value: "normal", onValueChange: () => {}, "aria-label": "What to play", ...props } as React.ComponentProps<typeof ModeSwitch>))

  it("has a case for each mode, each with its icon and its name, and no words under it", () => {
    const markup = html()
    for (const mode of PLAY_ZONE_MODES) expect(markup).toContain(PLAY_ZONE_LABELS[mode])
    expect(markup.match(/data-slot="toggle-group-item"/g)).toHaveLength(3)
    expect(markup.match(/<svg/g)).toHaveLength(3)
    expect(markup).not.toContain("text-xs")
    expect(markup).not.toContain("text-muted-foreground")
  })

  it("has its cases in the order of the modes, Custom on the right of Ranked, and no case for the tournaments", () => {
    const markup = html()
    const places = ["Normal", "Ranked", "Custom"].map((label) => markup.indexOf(`>${label}<`))
    expect(places.every((place) => place > -1)).toBe(true)
    expect([...places].sort((a, b) => a - b)).toEqual(places)
    expect(markup).not.toContain("Tournaments")
  })

  it("fits what it holds: as wide as its cases and no wider than its column, never the width of the page", () => {
    const group = /<div[^>]*data-slot="toggle-group"[^>]*>/.exec(html())?.[0] ?? ""
    expect(group).toContain("w-fit")
    expect(group).toContain("max-w-full")
    expect(group).not.toMatch(/(?<![-\w])w-full\b/)
  })

  it("says which case is picked, and only one", () => {
    const markup = html({ value: "custom" })
    expect(markup.match(/data-state="on"/g)).toHaveLength(1)
    expect(/data-state="on"[^>]*>(?:(?!<\/button>).)*Custom/s.test(markup)).toBe(true)
  })

  it("leaves out the names of the cases that are not picked in a column too narrow for all of them, and keeps the picked one's", () => {
    expect(html()).toContain("@max-xl/mode-switch:group-data-[state=off]/toggle-item:sr-only")
  })

  it("names the cases for the pointer, and a switch that cannot be pressed shows the case that is picked as strong as when it is set", () => {
    const markup = html({ disabled: true })
    expect(markup).toContain('title="Ranked"')
    expect(markup).toContain("data-[state=on]:disabled:opacity-100")
  })
})

describe("the row of players", () => {
  const you: SlotPlayer = { id: "you", name: "Oré", you: true }
  const ann: SlotPlayer = { id: "ann", name: "Ann", tag: "0042", status: "online", leader: true }
  const bob: SlotPlayer = { id: "bob", name: "Bob", pending: true, status: "online" }
  const row = (props: Partial<React.ComponentProps<typeof PlayerSlots>> = {}) => render(React.createElement(PlayerSlots, { players: [you], size: 5, ...props }))
  const cellsOf = (html: string) => html.split('<li ').slice(1)

  it("has as many places on one line as it is given, nine at the most, and none for the others", () => {
    for (const size of [1, 3, 5, 6, 9]) {
      const html = row({ size })
      expect(html).toContain(`data-places="${size}"`)
      expect(cellsOf(html)).toHaveLength(size)
    }
    expect(cellsOf(row({ size: 40 }))).toHaveLength(9)
  })

  it("makes every place a cell of one grid, a person's and a free place's: the same width, as large as the row allows for the places there are, never fixed by a width of its own", () => {
    const html = row({ players: [you, ann], size: 6 })
    const list = /<ul[^>]*>/.exec(html)?.[0] ?? ""
    expect(list).toContain("grid-cols-5 @xl:grid-cols-6")
    for (const place of cellsOf(html)) {
      expect(place).not.toMatch(/[\s"]w-\d/)
      expect(place).not.toContain("flex-1")
    }
    expect(html.match(/data-size="xl"/g)).toHaveLength(6)
  })

  it("is plain Tailwind classes, with no arbitrary value and no custom property: as many columns as places, five to a row at the most in a narrow section, and a width that is that many places", () => {
    const listOf = (size: number) => /<ul[^>]*>/.exec(row({ size }))?.[0] ?? ""
    expect(listOf(5)).toContain("grid-cols-5")
    expect(listOf(5)).not.toContain("@xl:grid-cols")
    expect(listOf(3)).toContain("grid-cols-3")
    expect(listOf(9)).toContain("grid-cols-5 @xl:grid-cols-9")
    for (const size of [1, 2, 3, 4, 5, 6, 7, 8, 9]) {
      expect(listOf(size)).not.toMatch(/class="[^"]*\[/)
      expect(listOf(size)).not.toContain("--n")
      expect(listOf(size)).toContain("max-w-")
    }
  })

  it("makes the row as wide as that many places of the most a place has plus the room between two, a step at a time as the section grows", () => {
    // Five places: 4.5rem each and 0.75rem between, then 6rem and 1.25rem from `@3xl`, 7rem, 8rem and 10rem
    const list = /<ul[^>]*>/.exec(row({ size: 5 }))?.[0] ?? ""
    for (const part of ["max-w-102", "@3xl:max-w-140", "@4xl:max-w-160", "@5xl:max-w-180", "@7xl:max-w-220", "gap-x-3", "@3xl:gap-x-5"]) expect(list).toContain(part)
  })

  it("is aligned to the left and wraps to a second line of the others in a column too narrow for the places, rather than shrink them below a least width", () => {
    const list = /<ul[^>]*>/.exec(row({ players: [you, ann], size: 9 }))?.[0] ?? ""
    expect(list).toContain("grid-cols-5 @xl:grid-cols-9")
    expect(list).not.toContain("justify-center")
    expect(list).not.toContain("justify-items-center")
  })

  it("puts the visitor in the first place, the others after them, and their name 'You' under their picture", () => {
    const cells = cellsOf(row({ players: [you, ann], size: 5 }))
    expect(cells[0]).toContain("You")
    expect(cells[0]).not.toContain('data-free=""')
    expect(cells[1]).toContain("Ann")
    // The visitor is never called by their own nickname in the row
    expect(row({ players: [you, ann], size: 5 })).not.toContain(">Oré<")
  })

  it("opens every place that nobody has, even with no game picked: a circle with a plus, the outline and the background of a free slot of the games, as many as the row has", () => {
    const cells = cellsOf(row({ players: [you], size: 5 }))
    expect(cells.filter((cell) => cell.includes('data-free=""'))).toHaveLength(4)
    expect(cells.filter((cell) => cell.includes("border border-border bg-background/40"))).toHaveLength(4)
    expect(row()).not.toContain("border-dashed")
  })

  it("scales the dot of presence with the picture, in fractions of it and not a fixed size: a badge 3/10 of the picture, the dot 3/4 of the badge", () => {
    const html = row({ players: [you, ann], size: 5 })
    expect(html).toContain("group-data-[size=xl]/avatar:size-3/10")
    expect(html).toContain("size-3/4")
    expect(html).toContain("ring-0")
    // The fixed size and ring of an extra large picture's dot are the ones that the fractions take the place of, and nothing is a custom value
    expect(html).not.toContain("group-data-[size=xl]/avatar:size-4")
    expect(html).not.toContain("group-data-[size=xl]/avatar:ring-4")
    expect(html).not.toMatch(/cqw|--presence-/)
    // The ring of a friend who is away is a hole of half the dot's width, in proportion too
    const away = row({ players: [you, { id: "cy", name: "Cy", status: "offline" }], size: 5 })
    expect(away).toContain("size-1/2")
    expect(away).not.toContain("group-data-[size=xl]/avatar:border-4")
  })

  it("has the free places after the people, so a row grows to the right as the row of games does", () => {
    const cells = cellsOf(row({ players: [you], size: 3 }))
    expect(cells).toHaveLength(3)
    expect(cells[0]).not.toContain('data-free=""')
    expect(cells[1]).toContain('data-free=""')
    expect(cells[2]).toContain('data-free=""')
  })

  it("crowns the one who leads and marks the dot of their presence, and has no label of its own", () => {
    const html = row({ players: [you, ann], size: 5 })
    expect(html.match(/<svg[^>]*>(?:(?!<\/svg>).)*<\/svg>/gs)?.length ?? 0).toBeGreaterThan(1)
    expect(html).toContain('data-status="online"')
    expect(html).not.toMatch(/<h\d/)
    expect(html).toContain('aria-label="Players"')
  })

  it("draws an invitation that waits as a faint picture with a dashed outline and no dot of presence", () => {
    const html = row({ players: [you, bob], size: 5 })
    expect(html).toContain("outline-dashed")
    expect(html).toContain("opacity-60")
    expect(html).not.toContain('data-status="online"')
    expect(html).toContain("Bob, invited")
  })

  it("makes a free place a button that opens the panel of the friends when the page gives one, and only draws it otherwise", () => {
    expect(row()).not.toContain('aria-label="Add a player"')
    const html = row({ picker: React.createElement("p", null, "friends") })
    expect(html.match(/aria-label="Add a player"/g)).toHaveLength(4)
    expect(html).toContain('aria-haspopup="dialog"')
  })

  it("makes only the first free place a stop for the keyboard's Tab: they all open the same panel", () => {
    const html = row({ picker: React.createElement("p", null, "friends") })
    expect(html.match(/tabindex="-1"/g)).toHaveLength(3)
  })

  it("makes a person a button that opens their menu when the page has one for them, and a plain picture when it has not", () => {
    const html = row({ players: [you, ann], size: 5, menu: (player) => (player.you ? null : React.createElement("span", null, "menu")) })
    expect(html.match(/aria-haspopup="menu"/g)).toHaveLength(1)
    expect(html).toContain("Ann#0042, leader: more")
    expect(html).toContain('role="img"')
  })

  it("is not pressed while a search is on or a table is being opened", () => {
    const html = row({ picker: React.createElement("p", null, "friends"), disabled: true })
    expect(html.match(/disabled=""/g)).toHaveLength(4)
  })
})

describe("the panel of friends of a free place", () => {
  const friend = (id: string, status: Friend["status"]): Friend => ({ id, nickname: `Friend ${id}`, tag: "1000", status })
  const friends = [friend("a", "online"), friend("b", "offline"), friend("c", "online"), friend("d", "offline"), friend("e", "offline")]
  const picker = (props: Partial<React.ComponentProps<typeof FriendPicker>> = {}) => render(React.createElement(FriendPicker, { friends, onInvite: () => true, ...props }))

  it("lists the connected friends first, then the others, with a search field", () => {
    const html = picker()
    expect(html).toContain('aria-label="Search your friends"')
    expect(html.indexOf("Online")).toBeLessThan(html.indexOf("Offline"))
    expect(html.indexOf("Friend a")).toBeLessThan(html.indexOf("Friend b"))
    expect(html.indexOf("Friend c")).toBeLessThan(html.indexOf("Friend b"))
  })

  it("lists at most the limit, the connected ones before the others, and says how many the search will find", () => {
    const html = picker({ limit: 3 })
    expect(html.match(/data-slot="invite-friend"/g)).toHaveLength(3)
    expect(html).toContain("Friend a")
    expect(html).toContain("Friend c")
    expect(html).toContain("Friend b")
    expect(html).not.toContain("Friend d")
    expect(html).toContain("Search to see 2 more.")
    expect(picker({ limit: 5 })).not.toContain("Search to see")
  })

  it("says what a press does in the page's words, and shows the friends that are done in them", () => {
    expect(picker()).toContain(">Invite<")
    const html = picker({ labels: { action: "Add", done: "Added" }, invited: new Set(["a"]) })
    expect(html).toContain(">Add<")
    expect(html).toContain(">Added<")
    expect(html).toContain("Friend a is added")
    expect(html).toContain("Add Friend c")
  })

  it("has a way to copy a link under the list for the page that has one, and none otherwise", () => {
    expect(picker()).not.toContain("Copy link")
    expect(picker({ link: { onCopy: () => {} } })).toContain("Copy link")
    expect(picker({ link: { onCopy: () => {}, copied: true } })).toContain("Link copied")
  })
})

describe("a game that cannot be picked now", () => {
  const options = [
    { value: "courtisans", label: "Courtisans" },
    { value: "duel", label: "Duel", unavailable: "Your group has 3 players and this game takes 2 at most." },
  ]
  const list = (props: Partial<React.ComponentProps<typeof Combobox>> = {}) =>
    render(React.createElement(Combobox, { options, value: [], onValueChange: () => {}, placeholder: "Search games...", empty: "No game matches.", "aria-label": "Games", ...props }))

  it("says why under its name, with a warning at its end, and is off", () => {
    const html = list()
    expect(html).toContain("Your group has 3 players and this game takes 2 at most.")
    const row = html.slice(html.indexOf("Duel") - 400)
    expect(row).toContain('aria-disabled="true"')
    expect(row).toContain("text-destructive")
  })

  it("leaves the other games as they are, and makes every row as tall as a row with a second line", () => {
    const html = list()
    expect(html.match(/aria-disabled="true"/g)).toHaveLength(1)
    expect(html.match(/h-12/g)).toHaveLength(2)
  })

  it("keeps a game that is picked and became unavailable pickable off, so that it can be put back", () => {
    const html = list({ value: ["duel"] })
    expect(html).toContain('aria-selected="true"')
    expect(html).not.toContain('aria-disabled="true"')
  })

  it("has rows a step less round than the panel that holds them", () => {
    expect(list()).toContain("rounded-xl")
    expect(list()).not.toContain("rounded-2xl")
  })
})

describe("the panel that picks the games", () => {
  const options = [{ value: "courtisans", label: "Courtisans" }, { value: "flip-7", label: "Flip 7" }]
  const trigger = React.createElement(AddGameTile, { label: "Add a game" })
  const select = (props: Partial<Omit<React.ComponentProps<typeof GameSelect>, "children">> = {}) =>
    render(React.createElement(GameSelect, { options, value: [], onValueChange: () => {}, max: 10, searchPlaceholder: "Search games...", empty: "No game matches.", "aria-label": "Games", ...props } as React.ComponentProps<typeof GameSelect>, trigger))

  it("is opened by the element it is given, and has no field of its own: no search bar before the tiles", () => {
    const html = select()
    // The trigger of a popover names its own slot: what is drawn is the tile
    expect(html).toContain('aria-label="Add a game"')
    expect(html).toContain("bg-background/40")
    expect(html).toContain('aria-haspopup="dialog"')
    expect(html).toContain('aria-expanded="false"')
    expect(html).not.toContain('role="combobox"')
    expect(html).not.toContain("Search games...")
  })

  it("draws its panel only once it is open, whichever the number of games it picks", () => {
    expect(select({ max: 1, value: ["flip-7"] })).not.toContain("Flip 7")
    expect(select({ value: ["courtisans", "flip-7"] })).not.toContain("Courtisans")
  })

  it("is open when the page says so, which is how every free slot of the row opens the one panel: the first is its trigger, the others set the page's state", () => {
    expect(select({ open: true })).toContain('aria-expanded="true"')
    expect(select({ open: false })).toContain('aria-expanded="false"')
    // With nothing said it keeps its own state, shut to begin with
    expect(select()).toContain('aria-expanded="false"')
  })
})

describe("the tile that adds a game", () => {
  const tile = (props: Partial<React.ComponentProps<typeof AddGameTile>> = {}) => render(React.createElement(AddGameTile, { label: "Add a game", ...props }))

  it("is a button with a plus in a dark, translucent frame, named for a screen reader, with no label drawn", () => {
    const html = tile()
    expect(html).toContain('type="button"')
    expect(html).toContain('aria-label="Add a game"')
    expect(html).toContain("bg-background/40")
    expect(html).toContain("<svg")
    // The label is what a screen reader hears: no text is drawn, as the free places of the row of players have none
    expect(html).not.toContain(">Add a game<")
    expect(html.replace(/<svg.*?<\/svg>/gs, "").replace(/<[^>]*>/g, "")).toBe("")
  })

  it("has the frame of a picture, as big as the tiles of the games, with their corners", () => {
    const html = tile({ className: "w-36" })
    expect(html).toContain("w-36")
    expect(html).toContain("aspect-4/3")
    expect(html).toContain("rounded-2xl")
    expect(html).toContain("@max-[8.5rem]/tile:rounded-xl")
  })

  it("takes the props of a button, so that it can open a panel", () => {
    expect(tile({ disabled: true })).toContain('disabled=""')
  })

  it("has the outline and the background of a free place of the row of players: thin, solid, a dark translucent fill", () => {
    const place = render(React.createElement(PlayerSlots, { players: [{ id: "you", name: "Oré", you: true }], size: 3 }))
    const html = tile()
    for (const markup of [place, html]) {
      expect(markup).toContain("border border-border bg-background/40")
      expect(markup).not.toContain("border-dashed")
    }
    expect(html).toContain("group-hover/add:border-foreground/50")
    expect(place).toContain("group-hover/slot:border-foreground/50")
    expect(html).not.toContain("ring-foreground/10")
  })

  it("is as tall as the tile of a game: the room of a name is left empty under its frame, outside the button, so that only the frame is pressed", () => {
    const html = tile()
    expect(html).toContain('<span aria-hidden="true" class="min-h-10.5"></span>')
    expect(html.indexOf("</button>")).toBeLessThan(html.indexOf('class="min-h-10.5"'))
    // A game's tile keeps the same room for its name and its rank
    expect(render(React.createElement(PickedGame, { name: "Courtisans" }))).toContain("min-h-10.5")
  })

  it("leaves that room only in the row that holds the games: a row of free slots needs none, so the players are as high as they can be", () => {
    expect(tile({ named: false })).not.toContain("min-h-10.5")
    expect(tile({ named: false })).toContain("aspect-4/3")
    expect(tile({ named: true })).toContain("min-h-10.5")
  })
})

describe("the tile of a game in a search", () => {
  const tile = (props: Partial<React.ComponentProps<typeof PickedGame>> = {}) => render(React.createElement(PickedGame, { name: "Courtisans", picture: "https://cdn.example/c.webp", ...props }))

  it("opens the settings of the game when it has some, from a button on its picture", () => {
    const html = tile({ config: React.createElement("p", null, "settings") })
    expect(html).toContain('aria-label="Settings of Courtisans"')
    expect(tile()).not.toContain("Settings of")
  })

  it("opens its settings in a window from its picture, with a gear at its corner that shows under the pointer and always on a screen that cannot hover", () => {
    const html = tile({ config: React.createElement("p", null, "settings") })
    expect(html).toContain('aria-haspopup="dialog"')
    expect(html).toContain("[@media(hover:hover)]:opacity-0")
    expect(html).toContain("group-hover/config:opacity-100")
    expect(html).not.toContain("[@media(hover:hover)]:hidden")
  })

  it("says that its settings are not the usual ones with a dot", () => {
    expect(tile({ config: React.createElement("p"), configured: true })).toContain("bg-primary")
    expect(tile({ config: React.createElement("p") })).not.toContain("ring-background")
  })

  it("is off when the game cannot be played, with a warning that says why, and has no settings to open", () => {
    const html = tile({ config: React.createElement("p", null, "settings"), unavailable: "Your group is too large." })
    expect(html).toContain('data-unavailable=""')
    expect(html).toContain('aria-label="Courtisans: Your group is too large."')
    expect(html).toContain("grayscale")
    expect(html).not.toContain("Settings of")
  })

  it("has its name centred under its picture, cut with an ellipsis on one line", () => {
    expect(tile()).toMatch(/<span class="[^"]*\bitems-center\b[^"]*\btext-center\b[^"]*"><span class="[^"]*\bmax-w-full\b[^"]*\btruncate\b[^"]*">Courtisans<\/span>/)
  })

  it("says the rank under its name, with the small emblem of the tier at the left of the rank's name, and none beside 'Unranked'", () => {
    const ranked = tile({ showRank: true, rank: { tier: "Gold", division: 2 } })
    expect(ranked.indexOf(">Courtisans<")).toBeLessThan(ranked.indexOf('data-slot="rank-emblem"'))
    expect(ranked.indexOf('data-slot="rank-emblem"')).toBeLessThan(ranked.indexOf("Gold II"))
    expect(ranked).toMatch(/data-slot="rank-emblem"[^>]*>G<\/span>/)
    const unranked = tile({ showRank: true, rank: null })
    expect(unranked).toContain("Unranked")
    expect(unranked).not.toContain("rank-emblem")
    expect(tile({ rank: { tier: "Gold", division: 2 } })).not.toContain("rank-emblem")
  })

  it("keeps its cross, which takes the game out of the search whatever it is", () => {
    expect(tile({ onRemove: () => {}, unavailable: "No." })).toContain('aria-label="Take Courtisans out"')
    expect(tile()).not.toContain("Take Courtisans out")
  })
})

describe("the settings of a game's tile", () => {
  const settings = (props: Partial<React.ComponentProps<typeof LobbySettings>> = {}) => render(React.createElement(LobbySettings, { pace: "normal", editable: true, ...props }))

  it("have the speed, and leave it out for a ranked search, which is played at the usual one", () => {
    expect(settings()).toContain("Speed")
    expect(settings({ speed: false })).not.toContain("Speed")
    expect(settings({ speed: false })).not.toContain("Speed of the game")
  })

  it("have the number of players of a table about to be opened, a chip for each count of the game", () => {
    const html = render(React.createElement(LobbyPlayerCount, { range: { min: 2, max: 5 }, count: 3, onCountChange: () => {} }))
    expect(html).toContain("Players")
    expect(html.match(/data-slot="toggle-group-item"/g)).toHaveLength(4)
    expect(html).toMatch(/data-state="on"[^>]*>(?:(?!<\/button>).)*3/s)
  })

  it("have the most players a search accepts above the speed, the same chips under another name, a chip for each count of the game", () => {
    const count = (props: Partial<React.ComponentProps<typeof LobbyPlayerCount>> = {}) =>
      React.createElement(LobbyPlayerCount, { title: "Max players", label: "Most players at the table", range: { min: 2, max: 6 }, count: 6, onCountChange: () => {}, ...props })
    const html = settings({ beforeSpeed: count(), expansions: [{ id: "x", name: "Expansion X" }] })
    expect(html).toContain("Max players")
    expect(html).toContain('aria-label="Most players at the table"')
    expect(html.indexOf("Max players")).toBeLessThan(html.indexOf("Speed"))
    expect(html.indexOf("Speed")).toBeLessThan(html.indexOf("Expansion X"))
    // One chip for each count from the game's least to its most, the most on: the default asks nothing
    const chips = render(count())
    expect(chips.match(/data-slot="toggle-group-item"/g)).toHaveLength(5)
    expect(chips).toMatch(/data-state="on"[^>]*>(?:(?!<\/button>).)*6/s)
    // A ranked search has no speed and still has it
    const ranked = settings({ speed: false, beforeSpeed: count() })
    expect(ranked).toContain("Max players")
    expect(ranked).not.toContain("Speed")
  })

  it("name the count of players Players and Number of players unless the page says more", () => {
    const html = render(React.createElement(LobbyPlayerCount, { range: { min: 2, max: 4 }, count: 2, onCountChange: () => {} }))
    expect(html).toContain("Players")
    expect(html).toContain('aria-label="Number of players"')
    expect(html).not.toContain("Max players")
  })

  it("put the players between the speed and the expansions", () => {
    const html = settings({ afterSpeed: React.createElement(LobbyPlayerCount, { range: { min: 2, max: 4 }, count: 2, onCountChange: () => {} }), expansions: [{ id: "x", name: "Expansion X" }] })
    expect(html.indexOf("Speed")).toBeLessThan(html.indexOf("Players"))
    expect(html.indexOf("Players")).toBeLessThan(html.indexOf("Expansion X"))
  })
})
