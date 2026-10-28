import { describe, expect, it } from "vitest"
import { buildCatalog } from "./catalog"
import {
  AGE_LIMITS,
  COMPLEXITY_LEVELS,
  DURATION_STOPS,
  FIRST_PICKS,
  MANY_PLAYERS,
  NO_FILTER,
  PLAYER_COUNTS,
  canStep,
  categoriesOf,
  complexityLevel,
  durationFromParam,
  durationRangeOf,
  durationStopsOf,
  durationToParam,
  filterFromParams,
  filterGames,
  filterToParams,
  indexEntry,
  isFiltered,
  normalize,
  optionOf,
  stepOption,
  words,
  type DurationRange,
  type GameFilter,
} from "./filter"
import { notionGame, registryGame } from "./testing"

// A catalog in the shape of the real one: the live games in registry order, each with its Notion row or, with none, the line the
// registry makes of it, then the games to come by name. Players, durations, complexities, ages and categories cover what the real games have:
// a fixed count, a range, "N or more", a game that does not say, a game with several categories, a game with none, a weight on each side of
// a rounding (2.49 and 2.5).
const catalog = buildCatalog(
  [
    // No Notion row: the registry's line, its name and its figures (a duration only when the registry gives one figure, not a range)
    registryGame("courtisans", { name: "Courtisans", live: true, players: { min: 2, max: 5 }, duration: { min: 30, max: 30 } }),
    // A Notion row, which wins over the registry, whose Skyjo takes 15 to 45 minutes
    registryGame("skyjo", { name: "Skyjo", live: true, players: { min: 2, max: 8 }, duration: { min: 15, max: 45 } }),
    registryGame("tichu", { name: "Tichu", live: true }),
  ],
  [
    notionGame("skyjo", { name: "Skyjo", players: { min: 2, max: 8 }, duration: 45, complexity: 1.13, age: 8, categories: ["Cards"], authors: ["Nadia Okafor"] }),
    notionGame("zen", { name: "Zen" }),
    notionGame("6-nimmt", { name: "6 nimmt!", players: { min: 2, max: 10 }, duration: 45, complexity: 1.15, age: 10, categories: ["Cards", "Party"] }),
    notionGame("flip-7", {
      name: "Flip 7",
      players: { min: 3, max: null },
      duration: 20,
      complexity: 1.06,
      age: 8,
      categories: ["Cards"],
      authors: ["Eric Olsen"],
      publishers: [{ name: "The Op Games", url: null }],
    }),
    notionGame("hanabi", { name: "Hanabi", players: { min: 2, max: 5 }, duration: 25, complexity: 1.74, age: 8, categories: ["Co-op", "Cards"], authors: ["Antoine Bauza"] }),
    notionGame("mystery-night", {
      name: "Mystery Night",
      players: { min: 4, max: 7 },
      duration: 30,
      complexity: 2.49,
      age: 12,
      categories: ["Bluffing", "Party"],
      authors: ["Hervé Marly"],
      illustrators: ["Régis Torres"],
      publishers: [{ name: "Spiral Éditions", url: "https://example.com" }],
    }),
    notionGame("millers-hollow", {
      name: "Werewolves of Miller's Hollow",
      players: { min: 8, max: null },
      duration: 30,
      complexity: 2.5,
      age: 10,
      categories: ["Bluffing", "Party"],
    }),
    notionGame("solo-quest", { name: "Solo Quest", players: { min: 1, max: 1 }, duration: 15, complexity: 4.6, age: 6, categories: ["Co-op"] }),
    notionGame("time-bomb", {
      name: "Time Bomb",
      players: { min: 4, max: 8 },
      categories: ["Bluffing"],
      descriptions: { en: "A game of bluffing and secret roles" },
    }),
  ],
)
const games = catalog.map(indexEntry)

/** The categories the fixture offers. */
const OFFERED = categoriesOf(games)

const slugs = (list: readonly { slug: string }[]) => list.map((game) => game.slug)
const kept = (filter: Partial<GameFilter>) => slugs(filterGames(games, { ...NO_FILTER, ...filter }))

describe("normalize", () => {
  it("lower-cases and drops the marks of accented letters", () => {
    expect(normalize("Hervé RÉGIS Spiral Éditions")).toBe("herve regis spiral editions")
  })

  it("reads an accent the same composed or apart", () => {
    expect(normalize("é")).toBe("e")
    expect(normalize("é")).toBe("e")
  })

  it("spells out the letters that have no mark to drop", () => {
    expect(normalize("Œuvre Æsir Straße Øye Łódź")).toBe("oeuvre aesir strasse oye lodz")
  })

  it("drops the apostrophes, straight or curly", () => {
    expect(normalize("Miller's Hollow, Miller’s Hollow")).toBe("millers hollow, millers hollow")
  })

  it("leaves digits and punctuation alone", () => {
    expect(normalize("6 nimmt!")).toBe("6 nimmt!")
  })
})

describe("words", () => {
  it("splits on anything that is not a letter or a digit, and normalises", () => {
    expect(words("  Hervé   Marly ")).toEqual(["herve", "marly"])
    expect(words("flip-7")).toEqual(["flip", "7"])
    expect(words("6 nimmt!")).toEqual(["6", "nimmt"])
  })

  it("keeps an apostrophe out of the way: one word, not two", () => {
    expect(words("Miller's")).toEqual(["millers"])
  })

  it("is empty for a query of blanks or punctuation", () => {
    expect(words("")).toEqual([])
    expect(words("   ")).toEqual([])
    expect(words("!? - ,")).toEqual([])
  })
})

describe("the options", () => {
  it("offers 1 to 7 players, then 8 or more as the last", () => {
    expect(PLAYER_COUNTS).toEqual([1, 2, 3, 4, 5, 6, 7, 8])
    expect(PLAYER_COUNTS.at(-1)).toBe(MANY_PLAYERS)
  })

  it("offers a scale of 0, 15, 30, 45, 60, 90 and 120 minutes, whose two ends are no limit", () => {
    expect(DURATION_STOPS).toEqual([0, 15, 30, 45, 60, 90, 120])
  })

  it("offers the five levels of the weight BoardGameGeek gives a game", () => {
    expect(COMPLEXITY_LEVELS).toEqual([1, 2, 3, 4, 5])
  })

  it("offers the ages of 6, 8, 10, 12 and 14 years", () => {
    expect(AGE_LIMITS).toEqual([6, 8, 10, 12, 14])
  })

  it("starts the stepper on one of its own options", () => {
    expect(PLAYER_COUNTS).toContain(FIRST_PICKS.players)
  })

  it("finds the option that a text spells exactly, else none", () => {
    expect(optionOf(PLAYER_COUNTS, "4")).toBe(4)
    expect(optionOf(COMPLEXITY_LEVELS, "3")).toBe(3)
    expect(optionOf(AGE_LIMITS, "12")).toBe(12)
    for (const bad of [null, "", "any", "04", "4.0", "9", " 4"]) expect(optionOf(PLAYER_COUNTS, bad)).toBeNull()
    expect(optionOf(["soon"], "SOON")).toBeNull()
  })
})

describe("stepping along the options", () => {
  it("picks what the stepper shows on the first press, whichever way it goes", () => {
    expect(stepOption(PLAYER_COUNTS, null, 1, FIRST_PICKS.players)).toBe(3)
    expect(stepOption(PLAYER_COUNTS, null, -1, FIRST_PICKS.players)).toBe(3)
  })

  it("then moves one place at a time and stays at the ends", () => {
    expect(stepOption(PLAYER_COUNTS, 3, 1, 3)).toBe(4)
    expect(stepOption(PLAYER_COUNTS, 3, -1, 3)).toBe(2)
    expect(stepOption(PLAYER_COUNTS, 1, -1, 3)).toBe(1)
    expect(stepOption(PLAYER_COUNTS, MANY_PLAYERS, 1, 3)).toBe(MANY_PLAYERS)
    expect(stepOption(AGE_LIMITS, 10, 1, 8)).toBe(12)
    expect(stepOption(AGE_LIMITS, 8, -1, 8)).toBe(6)
  })

  it("reads a pick that is not an option as no pick", () => {
    expect(stepOption(PLAYER_COUNTS, 99, 1, 3)).toBe(3)
    expect(canStep(PLAYER_COUNTS, 99, -1)).toBe(true)
  })

  it("can step while nothing is picked, then until either end", () => {
    expect(canStep(PLAYER_COUNTS, null, -1)).toBe(true)
    expect(canStep(PLAYER_COUNTS, null, 1)).toBe(true)
    expect(canStep(PLAYER_COUNTS, 1, -1)).toBe(false)
    expect(canStep(PLAYER_COUNTS, 1, 1)).toBe(true)
    expect(canStep(PLAYER_COUNTS, MANY_PLAYERS, 1)).toBe(false)
    expect(canStep(PLAYER_COUNTS, MANY_PLAYERS, -1)).toBe(true)
  })

  it("walks every option up and down, and never off either end", () => {
    for (const options of [PLAYER_COUNTS, AGE_LIMITS]) {
      let current: number = options[0]
      for (const expected of options.slice(1)) {
        expect(canStep(options, current, 1)).toBe(true)
        current = stepOption(options, current, 1, options[0])
        expect(current).toBe(expected)
      }
      expect(canStep(options, current, 1)).toBe(false)
      expect(stepOption(options, current, 1, options[0])).toBe(current)
      for (const expected of [...options].reverse().slice(1)) {
        expect(canStep(options, current, -1)).toBe(true)
        current = stepOption(options, current, -1, options[0])
        expect(current).toBe(expected)
      }
      expect(canStep(options, current, -1)).toBe(false)
      expect(stepOption(options, current, -1, options[0])).toBe(current)
    }
  })
})

describe("the duration slider", () => {
  const last = DURATION_STOPS.length - 1

  it("makes no range of thumbs on the two ends: nothing is then filtered", () => {
    expect(durationRangeOf(0, last)).toBeNull()
    expect(durationStopsOf(null)).toEqual([0, last])
  })

  it("leaves a side open when its thumb is on the end of the scale", () => {
    expect(durationRangeOf(0, 2)).toEqual({ min: null, max: 30 })
    expect(durationRangeOf(4, last)).toEqual({ min: 60, max: null })
    expect(durationRangeOf(2, 4)).toEqual({ min: 30, max: 60 })
    expect(durationRangeOf(1, 5)).toEqual({ min: 15, max: 90 })
  })

  it("never lets the thumbs meet or cross", () => {
    expect(durationRangeOf(3, 3)).toEqual({ min: 45, max: 60 })
    expect(durationRangeOf(5, 2)).toEqual({ min: 90, max: null })
  })

  it("puts the thumbs back where the range came from", () => {
    for (let from = 0; from < last; from++) {
      for (let to = from + 1; to <= last; to++) expect(durationStopsOf(durationRangeOf(from, to))).toEqual([from, to])
    }
  })

  it("puts the thumbs on the ends for a limit that is not a stop", () => {
    expect(durationStopsOf({ min: 20, max: 50 })).toEqual([0, last])
    expect(durationStopsOf({ min: 60, max: 30 })).toEqual([0, last])
  })
})

describe("complexityLevel", () => {
  it("rounds a weight to the nearest level", () => {
    expect(complexityLevel(1)).toBe(1)
    expect(complexityLevel(1.49)).toBe(1)
    expect(complexityLevel(1.5)).toBe(2)
    expect(complexityLevel(2.35)).toBe(2)
    expect(complexityLevel(2.5)).toBe(3)
    expect(complexityLevel(4.49)).toBe(4)
    expect(complexityLevel(5)).toBe(5)
  })

  it("keeps a weight that is off the scale on it", () => {
    expect(complexityLevel(0.4)).toBe(1)
    expect(complexityLevel(5.4)).toBe(5)
  })
})

describe("the duration in a link", () => {
  it("writes the limits the way a person says them", () => {
    expect(durationToParam({ min: 30, max: 60 })).toBe("30-60")
    expect(durationToParam({ min: null, max: 30 })).toBe("-30")
    expect(durationToParam({ min: 60, max: null })).toBe("60-")
  })

  it.each<[string, DurationRange]>([
    ["30-60", { min: 30, max: 60 }],
    ["-30", { min: null, max: 30 }],
    ["60-", { min: 60, max: null }],
    ["15-90", { min: 15, max: 90 }],
  ])("reads %s", (text, expected) => {
    expect(durationFromParam(text)).toEqual(expected)
  })

  it("ignores what the slider cannot make", () => {
    const bad = [null, "", "-", "30", "0-30", "20-60", "60-30", "30-30", "30-120", "120-", "-0", "030-60", "30--60", "30-60-90", "30 - 60", "30min", "a-b", "-1e1"]
    for (const text of bad) expect(durationFromParam(text), String(text)).toBeNull()
  })
})

describe("indexEntry", () => {
  const entry = (slug: string) => {
    const found = catalog.find((candidate) => candidate.slug === slug)
    if (!found) throw new Error(`no ${slug} in the fixture`)
    return found
  }

  it("indexes a live game with no Notion row by its name, with the players and the duration of the registry", () => {
    expect(indexEntry(entry("courtisans"))).toEqual({
      slug: "courtisans",
      live: true,
      text: "courtisans",
      players: { min: 2, max: 5 },
      duration: 30,
      complexity: null,
      age: null,
      categories: [],
    })
  })

  it("indexes a live game with a Notion row like any other game: by what the row says", () => {
    expect(indexEntry(entry("skyjo"))).toEqual({
      slug: "skyjo",
      live: true,
      text: "skyjo nadia okafor",
      players: { min: 2, max: 8 },
      duration: 45,
      complexity: 1.13,
      age: 8,
      categories: ["Cards"],
    })
  })

  it("leaves unknown what a game does not say", () => {
    expect(indexEntry(entry("tichu"))).toEqual({
      slug: "tichu",
      live: true,
      text: "tichu",
      players: null,
      duration: null,
      complexity: null,
      age: null,
      categories: [],
    })
    expect(indexEntry(entry("zen"))).toEqual({
      slug: "zen",
      live: false,
      text: "zen",
      players: null,
      duration: null,
      complexity: null,
      age: null,
      categories: [],
    })
  })

  it("leaves the duration of a live game with no Notion row unknown when the registry gives a range", () => {
    const [bridge] = buildCatalog([registryGame("bridge", { name: "Bridge", live: true, duration: { min: 20, max: 40 } })], [])
    if (!bridge) throw new Error("no bridge in the catalog")
    expect(indexEntry(bridge).duration).toBeNull()
  })

  it("indexes a game to come by its name, its authors, its illustrators and its publishers, normalised", () => {
    expect(indexEntry(entry("mystery-night"))).toEqual({
      slug: "mystery-night",
      live: false,
      text: "mystery night herve marly regis torres spiral editions",
      players: { min: 4, max: 7 },
      duration: 30,
      complexity: 2.49,
      age: 12,
      categories: ["Bluffing", "Party"],
    })
  })

  it("does not index the descriptions, nor the categories as text", () => {
    expect(indexEntry(entry("time-bomb")).text).toBe("time bomb")
  })

  it("keeps the open end of a game for N or more", () => {
    expect(indexEntry(entry("flip-7")).players).toEqual({ min: 3, max: null })
  })

  it("keeps the categories in the order of the row", () => {
    expect(indexEntry(entry("hanabi")).categories).toEqual(["Co-op", "Cards"])
  })

  it("is lean: nothing but what the filter reads, so that the page can send it to the browser", () => {
    expect(Object.keys(indexEntry(entry("flip-7"))).sort()).toEqual(["age", "categories", "complexity", "duration", "live", "players", "slug", "text"])
  })
})

describe("categoriesOf", () => {
  it("lists every category of the games once, by name", () => {
    expect(OFFERED).toEqual(["Bluffing", "Cards", "Co-op", "Party"])
  })

  it("reads numbers in their order and takes no notice of the case", () => {
    expect(categoriesOf([{ categories: ["10 minutes", "Party"] }, { categories: ["2 minutes", "bluffing"] }])).toEqual([
      "2 minutes",
      "10 minutes",
      "bluffing",
      "Party",
    ])
  })

  it("is empty when no game has a category", () => {
    expect(categoriesOf([{ categories: [] }, { categories: [] }])).toEqual([])
    expect(categoriesOf([])).toEqual([])
  })
})

describe("filterGames", () => {
  it("keeps every game, in the catalog's order, for no filter", () => {
    expect(kept({})).toEqual([
      "courtisans",
      "skyjo",
      "tichu",
      "6-nimmt",
      "flip-7",
      "hanabi",
      "mystery-night",
      "solo-quest",
      "time-bomb",
      "millers-hollow",
      "zen",
    ])
  })

  it("returns the games it was given, with whatever else they carry, in their order", () => {
    const cards = games.map((game) => ({ ...game, props: { href: `/game/${game.slug}` } }))
    const filtered = filterGames(cards, { ...NO_FILTER, players: 6 })
    expect(slugs(filtered)).toEqual(["skyjo", "6-nimmt", "flip-7", "mystery-night", "time-bomb"])
    expect(filtered[0]).toBe(cards[1])
    expect(filtered[0]?.props.href).toBe("/game/skyjo")
  })

  describe("the search", () => {
    it("finds a game by a part of its name, whatever the case", () => {
      expect(kept({ query: "flip" })).toEqual(["flip-7"])
      expect(kept({ query: "FLI" })).toEqual(["flip-7"])
      expect(kept({ query: "night" })).toEqual(["mystery-night"])
    })

    it("finds a live game too", () => {
      expect(kept({ query: "sky" })).toEqual(["skyjo"])
      expect(kept({ query: "courtisans" })).toEqual(["courtisans"])
    })

    it("takes no notice of accents, in the query or in the game", () => {
      expect(kept({ query: "herve" })).toEqual(["mystery-night"])
      expect(kept({ query: "HERVÉ" })).toEqual(["mystery-night"])
      expect(kept({ query: "spiral editions" })).toEqual(["mystery-night"])
    })

    it("takes no notice of an apostrophe", () => {
      expect(kept({ query: "miller's" })).toEqual(["millers-hollow"])
      expect(kept({ query: "millers" })).toEqual(["millers-hollow"])
      expect(kept({ query: "miller’s hollow" })).toEqual(["millers-hollow"])
    })

    it("finds a game by its authors, its illustrators and its publishers, a live game with a Notion row included", () => {
      expect(kept({ query: "olsen" })).toEqual(["flip-7"])
      expect(kept({ query: "torres" })).toEqual(["mystery-night"])
      expect(kept({ query: "op games" })).toEqual(["flip-7"])
      expect(kept({ query: "okafor" })).toEqual(["skyjo"])
    })

    it("takes the words in any order, each one a part of a word", () => {
      expect(kept({ query: "marly herve" })).toEqual(["mystery-night"])
      expect(kept({ query: "myst nig" })).toEqual(["mystery-night"])
    })

    it("asks for every word in the same game", () => {
      expect(kept({ query: "herve olsen" })).toEqual([])
    })

    it("reads punctuation as a separator", () => {
      expect(kept({ query: "flip-7" })).toEqual(["flip-7"])
      expect(kept({ query: "6 nimmt!" })).toEqual(["6-nimmt"])
    })

    it("does not look into the descriptions, nor into the categories", () => {
      expect(kept({ query: "bluffing" })).toEqual([])
      expect(kept({ query: "party" })).toEqual([])
    })

    it("keeps every game for a query of blanks or punctuation", () => {
      expect(kept({ query: "   " })).toHaveLength(games.length)
      expect(kept({ query: "!?" })).toHaveLength(games.length)
    })

    it("keeps none for a word that is in no game", () => {
      expect(kept({ query: "xylophone" })).toEqual([])
    })
  })

  describe("the categories", () => {
    it("keeps the games that have the picked category", () => {
      expect(kept({ categories: ["Cards"] })).toEqual(["skyjo", "6-nimmt", "flip-7", "hanabi"])
      expect(kept({ categories: ["Bluffing"] })).toEqual(["mystery-night", "time-bomb", "millers-hollow"])
    })

    it("keeps the games that have any of the picked categories", () => {
      expect(kept({ categories: ["Co-op", "Party"] })).toEqual(["6-nimmt", "hanabi", "mystery-night", "solo-quest", "millers-hollow"])
    })

    it("does not care in which order the categories were picked", () => {
      expect(kept({ categories: ["Party", "Co-op"] })).toEqual(kept({ categories: ["Co-op", "Party"] }))
    })

    it("takes the names as they are spelled", () => {
      expect(kept({ categories: ["cards"] })).toEqual([])
      expect(kept({ categories: ["Dice"] })).toEqual([])
    })

    it("leaves out a game that has no category as soon as one is picked", () => {
      const fits = kept({ categories: OFFERED })
      for (const slug of ["courtisans", "tichu", "zen"]) expect(fits).not.toContain(slug)
    })

    it("keeps every game when none is picked", () => {
      expect(kept({ categories: [] })).toHaveLength(games.length)
    })
  })

  describe("the number of players", () => {
    const fourOrFive = ["courtisans", "skyjo", "6-nimmt", "flip-7", "hanabi", "mystery-night", "time-bomb"]
    const sixOrSeven = ["skyjo", "6-nimmt", "flip-7", "mystery-night", "time-bomb"]

    it.each<[number, string[]]>([
      [1, ["solo-quest"]],
      [2, ["courtisans", "skyjo", "6-nimmt", "hanabi"]],
      [3, ["courtisans", "skyjo", "6-nimmt", "flip-7", "hanabi"]],
      [4, fourOrFive],
      [5, fourOrFive],
      [6, sixOrSeven],
      [7, sixOrSeven],
    ])("keeps the games that seat %i players", (players, expected) => {
      expect(kept({ players })).toEqual(expected)
    })

    it("reads the last count as that many or more, whatever the lower limit of the game", () => {
      expect(kept({ players: MANY_PLAYERS })).toEqual(["skyjo", "6-nimmt", "flip-7", "time-bomb", "millers-hollow"])
    })

    it("seats any number from its lower limit up for a game that says N or more", () => {
      expect(kept({ players: 2 })).not.toContain("flip-7")
      expect(kept({ players: 3 })).toContain("flip-7")
      expect(kept({ players: 7 })).toContain("flip-7")
    })

    it("leaves out a game that does not say its players", () => {
      expect(kept({ players: 4 })).not.toContain("tichu")
      expect(kept({ players: 4 })).not.toContain("zen")
    })
  })

  describe("the duration", () => {
    const upTo = (max: number): DurationRange => ({ min: null, max })
    const from = (min: number): DurationRange => ({ min, max: null })
    const everyDuration = ["courtisans", "skyjo", "6-nimmt", "flip-7", "hanabi", "mystery-night", "solo-quest", "millers-hollow"]

    it.each<[number, string[]]>([
      [15, ["solo-quest"]],
      [30, ["courtisans", "flip-7", "hanabi", "mystery-night", "solo-quest", "millers-hollow"]],
      [45, everyDuration],
    ])("keeps the games that take %i minutes at most", (max, expected) => {
      expect(kept({ duration: upTo(max) })).toEqual(expected)
    })

    it("keeps the games that take that long or more, when only the lower limit is set", () => {
      expect(kept({ duration: from(45) })).toEqual(["skyjo", "6-nimmt"])
      expect(kept({ duration: from(30) })).toEqual(["courtisans", "skyjo", "6-nimmt", "mystery-night", "millers-hollow"])
      expect(kept({ duration: from(15) })).toEqual(everyDuration)
    })

    it("keeps the games between two limits, both included", () => {
      expect(kept({ duration: { min: 30, max: 45 } })).toEqual(["courtisans", "skyjo", "6-nimmt", "mystery-night", "millers-hollow"])
      expect(kept({ duration: { min: 15, max: 30 } })).toEqual(["courtisans", "flip-7", "hanabi", "mystery-night", "solo-quest", "millers-hollow"])
      expect(kept({ duration: { min: 45, max: 60 } })).toEqual(["skyjo", "6-nimmt"])
    })

    it("counts a game by the one figure it gives: a live game by its Notion row, not by the range of the registry", () => {
      // The registry has Skyjo at 15 to 45 minutes, its Notion row at 45
      expect(kept({ duration: upTo(30) })).not.toContain("skyjo")
      expect(kept({ duration: upTo(45) })).toContain("skyjo")
    })

    it("counts a live game with no Notion row by the one figure of the registry", () => {
      expect(kept({ duration: upTo(30) })).toContain("courtisans")
      expect(kept({ duration: upTo(15) })).not.toContain("courtisans")
    })

    it("leaves out a game that does not say its duration", () => {
      for (const duration of [upTo(45), from(15), { min: 15, max: 90 }]) {
        const fits = kept({ duration })
        for (const slug of ["tichu", "time-bomb", "zen"]) expect(fits).not.toContain(slug)
      }
    })
  })

  describe("the complexity", () => {
    it.each<[number, string[]]>([
      [1, ["skyjo", "6-nimmt", "flip-7"]],
      [2, ["skyjo", "6-nimmt", "flip-7", "hanabi", "mystery-night"]],
      [3, ["skyjo", "6-nimmt", "flip-7", "hanabi", "mystery-night", "millers-hollow"]],
      [4, ["skyjo", "6-nimmt", "flip-7", "hanabi", "mystery-night", "millers-hollow"]],
      [5, ["skyjo", "6-nimmt", "flip-7", "hanabi", "mystery-night", "solo-quest", "millers-hollow"]],
    ])("keeps the games of level %i or lighter: those whose weight rounds to that or less", (complexity, expected) => {
      expect(kept({ complexity })).toEqual(expected)
    })

    it("puts a game on the level its weight rounds to", () => {
      // Mystery Night weighs 2.49 and Miller's Hollow 2.5
      expect(kept({ complexity: 2 })).toContain("mystery-night")
      expect(kept({ complexity: 2 })).not.toContain("millers-hollow")
    })

    it("leaves out a game that does not say its weight", () => {
      const fits = kept({ complexity: 5 })
      for (const slug of ["courtisans", "tichu", "time-bomb", "zen"]) expect(fits).not.toContain(slug)
    })
  })

  describe("the age", () => {
    const upToTwelve = ["skyjo", "6-nimmt", "flip-7", "hanabi", "mystery-night", "solo-quest", "millers-hollow"]

    it.each<[number, string[]]>([
      [6, ["solo-quest"]],
      [8, ["skyjo", "flip-7", "hanabi", "solo-quest"]],
      [10, ["skyjo", "6-nimmt", "flip-7", "hanabi", "solo-quest", "millers-hollow"]],
      [12, upToTwelve],
      [14, upToTwelve],
    ])("keeps the games a player of %i years can play: those whose minimum age is that or less", (age, expected) => {
      expect(kept({ age })).toEqual(expected)
    })

    it("leaves out a game that does not say its minimum age", () => {
      const fits = kept({ age: 14 })
      for (const slug of ["courtisans", "tichu", "time-bomb", "zen"]) expect(fits).not.toContain(slug)
    })
  })

  describe("together", () => {
    it("keeps the games that meet every criterion", () => {
      expect(kept({ categories: ["Cards"], age: 8 })).toEqual(["skyjo", "flip-7", "hanabi"])
      expect(kept({ categories: ["Cards"], players: 6 })).toEqual(["skyjo", "6-nimmt", "flip-7"])
      expect(kept({ categories: ["Bluffing"], players: 6 })).toEqual(["mystery-night", "time-bomb"])
      expect(kept({ players: MANY_PLAYERS, duration: { min: null, max: 30 }, age: 10 })).toEqual(["flip-7", "millers-hollow"])
      expect(kept({ categories: ["Cards"], complexity: 1, duration: { min: 15, max: 30 } })).toEqual(["flip-7"])
      expect(kept({ query: "night", duration: { min: null, max: 30 } })).toEqual(["mystery-night"])
      expect(kept({ query: "night", duration: { min: null, max: 15 } })).toEqual([])
      expect(kept({ query: "night", categories: ["Bluffing"] })).toEqual(["mystery-night"])
      expect(kept({ query: "night", categories: ["Cards"] })).toEqual([])
    })
  })
})

describe("isFiltered", () => {
  it("is false for nothing typed and nothing picked", () => {
    expect(isFiltered(NO_FILTER)).toBe(false)
  })

  it("is true as soon as one thing is typed or picked", () => {
    expect(isFiltered({ ...NO_FILTER, query: "flip" })).toBe(true)
    expect(isFiltered({ ...NO_FILTER, categories: ["Cards"] })).toBe(true)
    expect(isFiltered({ ...NO_FILTER, players: 3 })).toBe(true)
    expect(isFiltered({ ...NO_FILTER, duration: { min: null, max: 15 } })).toBe(true)
    expect(isFiltered({ ...NO_FILTER, complexity: 1 })).toBe(true)
    expect(isFiltered({ ...NO_FILTER, age: 6 })).toBe(true)
  })

  it("takes a query of blanks for nothing", () => {
    expect(isFiltered({ ...NO_FILTER, query: "   " })).toBe(false)
  })
})

describe("filterFromParams", () => {
  const read = (search: string, offered: readonly string[] = OFFERED) => filterFromParams(new URLSearchParams(search), offered)

  it("is no filter for a link with no parameter", () => {
    expect(read("")).toEqual(NO_FILTER)
  })

  it("reads each pick", () => {
    expect(read("category=Cards&players=4&duration=30-60&complexity=2&age=8")).toEqual({
      query: "",
      categories: ["Cards"],
      players: 4,
      duration: { min: 30, max: 60 },
      complexity: 2,
      age: 8,
    })
    expect(read(`players=${MANY_PLAYERS}`).players).toBe(MANY_PLAYERS)
    expect(read("duration=-30").duration).toEqual({ min: null, max: 30 })
    expect(read("duration=60-").duration).toEqual({ min: 60, max: null })
  })

  it("reads a category for each time the link names it, in the order of the link, each once", () => {
    expect(read("category=Party&category=Cards").categories).toEqual(["Party", "Cards"])
    expect(read("category=Cards&category=Co-op&category=Cards").categories).toEqual(["Cards", "Co-op"])
  })

  it("reads a category whose name was written out", () => {
    expect(read("category=Party+%26+Co", ["Party & Co"]).categories).toEqual(["Party & Co"])
  })

  it("never reads a query: what a visitor types stays in the page", () => {
    expect(read("q=flip").query).toBe("")
    expect(read("q=herv%C3%A9+marly&players=3")).toEqual({ ...NO_FILTER, players: 3 })
  })

  it("ignores a value the filters do not offer", () => {
    for (const bad of ["category=Dice", "category=cards", "category=Cards+", "category="]) expect(read(bad).categories).toEqual([])
    for (const bad of ["players=0", "players=9", "players=04", "players=4.0", "players=-1", "players=1e1", "players=four", "players="]) {
      expect(read(bad).players).toBeNull()
    }
    for (const bad of ["duration=0", "duration=30", "duration=0-30", "duration=20-60", "duration=60-30", "duration=030-60", "duration=30min", "duration="]) {
      expect(read(bad).duration).toBeNull()
    }
    for (const bad of ["complexity=0", "complexity=6", "complexity=03", "complexity=2.5", "complexity=heavy", "complexity="]) {
      expect(read(bad).complexity).toBeNull()
    }
    for (const bad of ["age=0", "age=7", "age=08", "age=8.0", "age=eight", "age="]) expect(read(bad).age).toBeNull()
  })

  it("ignores every category when the games have none to offer", () => {
    expect(read("category=Cards", []).categories).toEqual([])
  })

  it("ignores the old availability of a link written before it went", () => {
    expect(read("show=soon&players=4")).toEqual({ ...NO_FILTER, players: 4 })
  })

  it("keeps the good picks of a link whose other ones are bad", () => {
    expect(read("category=Dice&players=99&duration=-15&age=7")).toEqual({ ...NO_FILTER, duration: { min: null, max: 15 } })
  })

  it("takes the first of a pick that comes twice, and nothing from the others", () => {
    expect(read("players=2&players=3&utm_source=newsletter").players).toBe(2)
    expect(read("utm_source=newsletter&ref=home")).toEqual(NO_FILTER)
  })
})

describe("filterToParams", () => {
  it("is empty for no filter: the link to the unfiltered list is the hub's", () => {
    expect(filterToParams(NO_FILTER).toString()).toBe("")
  })

  it("writes only what is set", () => {
    expect(filterToParams({ ...NO_FILTER, categories: ["Cards"] }).toString()).toBe("category=Cards")
    expect(filterToParams({ ...NO_FILTER, players: 4 }).toString()).toBe("players=4")
    expect(filterToParams({ ...NO_FILTER, duration: { min: null, max: 45 } }).toString()).toBe("duration=-45")
    expect(filterToParams({ ...NO_FILTER, duration: { min: 30, max: 60 } }).toString()).toBe("duration=30-60")
    expect(filterToParams({ ...NO_FILTER, duration: { min: 60, max: null } }).toString()).toBe("duration=60-")
    expect(filterToParams({ ...NO_FILTER, complexity: 3 }).toString()).toBe("complexity=3")
    expect(filterToParams({ ...NO_FILTER, age: 8 }).toString()).toBe("age=8")
  })

  it("writes a category for each one that is picked, in the order they were picked", () => {
    expect(filterToParams({ ...NO_FILTER, categories: ["Party", "Cards"] }).toString()).toBe("category=Party&category=Cards")
  })

  it("writes them in a fixed order", () => {
    expect(
      filterToParams({ query: "", categories: ["Cards"], players: 3, duration: { min: 30, max: 60 }, complexity: 2, age: 8 }).toString(),
    ).toBe("category=Cards&players=3&duration=30-60&complexity=2&age=8")
  })

  it("writes a name that needs it as a URL does", () => {
    expect(filterToParams({ ...NO_FILTER, categories: ["Party & Co"] }).toString()).toBe("category=Party+%26+Co")
  })

  it("never writes the query: the address of the page goes to analytics with every event", () => {
    expect(filterToParams({ ...NO_FILTER, query: "hervé marly" }).toString()).toBe("")
    expect(
      filterToParams({ query: "flip", categories: [], players: 3, duration: { min: null, max: 30 }, complexity: null, age: null }).toString(),
    ).toBe("players=3&duration=-30")
  })
})

describe("a filter in a link", () => {
  const offered = [...OFFERED, "Party & Co"]
  // Every range a slider makes: no range, then each pair of stops but the two ends together (7 stops make 21 pairs, one of which is no range)
  const ranges: (DurationRange | null)[] = [null]
  for (let from = 0; from < DURATION_STOPS.length - 1; from++) {
    for (let to = from + 1; to < DURATION_STOPS.length; to++) {
      const range = durationRangeOf(from, to)
      if (range) ranges.push(range)
    }
  }
  const every = (): GameFilter[] =>
    [[], ["Cards"], ["Party", "Cards"], ["Party & Co"]].flatMap((categories) =>
      [null, ...PLAYER_COUNTS].flatMap((players) =>
        ranges.flatMap((duration) =>
          [null, ...COMPLEXITY_LEVELS].flatMap((complexity) =>
            [null, ...AGE_LIMITS].map((age) => ({ ...NO_FILTER, categories, players, duration, complexity, age })),
          ),
        ),
      ),
    )

  it("goes through every combination of options", () => {
    expect(ranges).toHaveLength(21)
    expect(every()).toHaveLength(4 * (PLAYER_COUNTS.length + 1) * ranges.length * (COMPLEXITY_LEVELS.length + 1) * (AGE_LIMITS.length + 1))
  })

  it("comes back as it left, through the text of the link", () => {
    for (const filter of every()) {
      const link = filterToParams(filter).toString()
      expect(filterFromParams(new URLSearchParams(link), offered)).toEqual(filter)
    }
  })

  it.each(["flip", "Hervé Marly", "50% & co/ +x=y #z?"])("leaves what was typed out of the link, whatever it is (query %j)", (query) => {
    for (const filter of every()) {
      const link = filterToParams({ ...filter, query }).toString()
      expect(link).toBe(filterToParams(filter).toString())
      expect(new URLSearchParams(link).has("q")).toBe(false)
      expect(filterFromParams(new URLSearchParams(link), offered)).toEqual(filter)
    }
  })
})
