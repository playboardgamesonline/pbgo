import { describe, expect, it } from "vitest"
import { buildCatalog } from "./catalog"
import {
  AGE_LIMITS,
  ANY_DURATION,
  COMPLEXITY_LEVELS,
  DEFAULT_AGE,
  DEFAULT_COMPLEXITY,
  DEFAULT_DURATION,
  DEFAULT_FILTER,
  DEFAULT_PLAYERS,
  DURATION_LIMITS,
  MANY_PLAYERS,
  NO_FILTER,
  PLAYER_COUNTS,
  canStep,
  categoriesOf,
  complexityLevel,
  filterFromParams,
  filterGames,
  filterToParams,
  indexEntry,
  isFiltered,
  normalize,
  optionOf,
  stepOption,
  words,
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

  it("offers up to 5, 10, 15 and so on to 55 minutes, five at a time, the twelfth step of the slider (1h+) being no limit", () => {
    expect(DURATION_LIMITS).toEqual([5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55])
  })

  it("offers the five levels of the weight BoardGameGeek gives a game", () => {
    expect(COMPLEXITY_LEVELS).toEqual([1, 2, 3, 4, 5])
  })

  it("offers the ages of 6, 8, 10, 12, 14 and 18 years", () => {
    expect(AGE_LIMITS).toEqual([6, 8, 10, 12, 14, 18])
  })

  it("starts on a table of four, games of 20 minutes at most, up to level 3 and a youngest player of 8, each one of its own options", () => {
    expect(PLAYER_COUNTS).toContain(DEFAULT_PLAYERS)
    expect(DURATION_LIMITS).toContain(DEFAULT_DURATION)
    expect(COMPLEXITY_LEVELS).toContain(DEFAULT_COMPLEXITY)
    expect(AGE_LIMITS).toContain(DEFAULT_AGE)
    expect(DEFAULT_FILTER).toEqual({ ...NO_FILTER, players: 4, duration: 20, complexity: 3, age: 8 })
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
    expect(stepOption(PLAYER_COUNTS, null, 1, DEFAULT_PLAYERS)).toBe(4)
    expect(stepOption(PLAYER_COUNTS, null, -1, DEFAULT_PLAYERS)).toBe(4)
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
      [5, fourOrFive],
      [6, sixOrSeven],
      [7, sixOrSeven],
    ])("keeps the games that seat %i players", (players, expected) => {
      expect(kept({ players })).toEqual(expected)
    })

    it("keeps the games that seat four, and those that do not say, since four is where the filter starts", () => {
      // Tichu and Zen say nothing of their players; Solo Quest (1) and Werewolves (8 or more) say they do not seat four
      expect(kept({ players: DEFAULT_PLAYERS })).toEqual(["courtisans", "skyjo", "tichu", "6-nimmt", "flip-7", "hanabi", "mystery-night", "time-bomb", "zen"])
    })

    it("reads the last count as that many or more, whatever the lower limit of the game", () => {
      expect(kept({ players: MANY_PLAYERS })).toEqual(["skyjo", "6-nimmt", "flip-7", "time-bomb", "millers-hollow"])
    })

    it("seats any number from its lower limit up for a game that says N or more", () => {
      expect(kept({ players: 2 })).not.toContain("flip-7")
      expect(kept({ players: 3 })).toContain("flip-7")
      expect(kept({ players: 7 })).toContain("flip-7")
    })

    it("leaves out a game that does not say its players, for any other number than the one the filter starts on", () => {
      expect(kept({ players: 5 })).not.toContain("tichu")
      expect(kept({ players: 5 })).not.toContain("zen")
    })
  })

  describe("the duration", () => {
    it.each<[number, string[]]>([
      [5, []],
      [10, []],
      [15, ["solo-quest"]],
      [20, ["tichu", "flip-7", "solo-quest", "time-bomb", "zen"]],
      [25, ["flip-7", "hanabi", "solo-quest"]],
      [30, ["courtisans", "flip-7", "hanabi", "mystery-night", "solo-quest", "millers-hollow"]],
      [45, ["courtisans", "skyjo", "6-nimmt", "flip-7", "hanabi", "mystery-night", "solo-quest", "millers-hollow"]],
    ])("keeps the games that take %i minutes at most", (duration, expected) => {
      expect(kept({ duration })).toEqual(expected)
    })

    it("counts a game by the one figure it gives: a live game by its Notion row, not by the range of the registry", () => {
      // The registry has Skyjo at 15 to 45 minutes, its Notion row at 45
      expect(kept({ duration: 30 })).not.toContain("skyjo")
      expect(kept({ duration: 45 })).toContain("skyjo")
    })

    it("counts a live game with no Notion row by the one figure of the registry", () => {
      expect(kept({ duration: 30 })).toContain("courtisans")
      expect(kept({ duration: 15 })).not.toContain("courtisans")
    })

    it("leaves out a game that does not say its duration, for any other limit than the one the filter starts on", () => {
      const fits = kept({ duration: 45 })
      for (const slug of ["tichu", "time-bomb", "zen"]) expect(fits).not.toContain(slug)
    })

    it("keeps the games that do not say their duration at 20 minutes, since 20 is where the filter starts, and at no other limit", () => {
      for (const slug of ["tichu", "time-bomb", "zen"]) {
        expect(kept({ duration: DEFAULT_DURATION })).toContain(slug)
        expect(kept({ duration: 15 })).not.toContain(slug)
        expect(kept({ duration: 25 })).not.toContain(slug)
      }
    })
  })

  describe("the complexity", () => {
    it.each<[number, string[]]>([
      [1, ["skyjo", "6-nimmt", "flip-7"]],
      [2, ["skyjo", "6-nimmt", "flip-7", "hanabi", "mystery-night"]],
      [3, ["courtisans", "skyjo", "tichu", "6-nimmt", "flip-7", "hanabi", "mystery-night", "time-bomb", "millers-hollow", "zen"]],
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

    it("leaves out a game that does not say its weight, for any other level than the one the filter starts on", () => {
      const fits = kept({ complexity: 5 })
      for (const slug of ["courtisans", "tichu", "time-bomb", "zen"]) expect(fits).not.toContain(slug)
    })

    it("keeps the games that do not say their weight at level 3, since 3 is where the filter starts, and at no other level", () => {
      for (const slug of ["courtisans", "tichu", "time-bomb", "zen"]) {
        expect(kept({ complexity: DEFAULT_COMPLEXITY })).toContain(slug)
        expect(kept({ complexity: 2 })).not.toContain(slug)
        expect(kept({ complexity: 4 })).not.toContain(slug)
      }
    })
  })

  describe("the age", () => {
    const upToTwelve = ["skyjo", "6-nimmt", "flip-7", "hanabi", "mystery-night", "solo-quest", "millers-hollow"]

    it.each<[number, string[]]>([
      [6, ["solo-quest"]],
      [10, ["skyjo", "6-nimmt", "flip-7", "hanabi", "solo-quest", "millers-hollow"]],
      [12, upToTwelve],
      [14, upToTwelve],
      [18, upToTwelve],
    ])("keeps the games a player of %i years can play: those whose minimum age is that or less", (age, expected) => {
      expect(kept({ age })).toEqual(expected)
    })

    it("keeps the games a player of 8 can play, and those that do not say, since 8 is where the filter starts", () => {
      // Courtisans, Tichu, Time Bomb and Zen say nothing of their minimum age; 6 nimmt!, Mystery Night and Werewolves say they are for older players
      expect(kept({ age: DEFAULT_AGE })).toEqual(["courtisans", "skyjo", "tichu", "flip-7", "hanabi", "solo-quest", "time-bomb", "zen"])
    })

    it("leaves out a game that does not say its minimum age, for any other age than the one the filter starts on", () => {
      const fits = kept({ age: 14 })
      for (const slug of ["courtisans", "tichu", "time-bomb", "zen"]) expect(fits).not.toContain(slug)
    })
  })

  describe("together", () => {
    it("keeps the games that meet every criterion", () => {
      expect(kept({ categories: ["Cards"], age: 8 })).toEqual(["skyjo", "flip-7", "hanabi"])
      expect(kept({ categories: ["Cards"], players: 6 })).toEqual(["skyjo", "6-nimmt", "flip-7"])
      expect(kept({ categories: ["Bluffing"], players: 6 })).toEqual(["mystery-night", "time-bomb"])
      expect(kept({ players: MANY_PLAYERS, duration: 30, age: 10 })).toEqual(["flip-7", "millers-hollow"])
      expect(kept({ categories: ["Cards"], complexity: 1, duration: 30 })).toEqual(["flip-7"])
      expect(kept({ query: "night", duration: 30 })).toEqual(["mystery-night"])
      expect(kept({ query: "night", duration: 15 })).toEqual([])
      expect(kept({ query: "night", categories: ["Bluffing"] })).toEqual(["mystery-night"])
      expect(kept({ query: "night", categories: ["Cards"] })).toEqual([])
    })
  })
})

describe("isFiltered", () => {
  it("is false where the filter starts: nothing typed, nothing picked but the starting picks", () => {
    expect(isFiltered(DEFAULT_FILTER)).toBe(false)
  })

  it("is true as soon as one thing is typed or picked beyond that", () => {
    expect(isFiltered({ ...DEFAULT_FILTER, query: "flip" })).toBe(true)
    expect(isFiltered({ ...DEFAULT_FILTER, categories: ["Cards"] })).toBe(true)
    expect(isFiltered({ ...DEFAULT_FILTER, players: 3 })).toBe(true)
    expect(isFiltered({ ...DEFAULT_FILTER, duration: 15 })).toBe(true)
    expect(isFiltered({ ...DEFAULT_FILTER, duration: null })).toBe(true)
    expect(isFiltered({ ...DEFAULT_FILTER, complexity: 1 })).toBe(true)
    expect(isFiltered({ ...DEFAULT_FILTER, age: 6 })).toBe(true)
  })

  it("takes a query of blanks for nothing", () => {
    expect(isFiltered({ ...DEFAULT_FILTER, query: "   " })).toBe(false)
  })

  it("takes a filter with no pick at all for one that is not where the filter starts", () => {
    expect(isFiltered(NO_FILTER)).toBe(true)
  })
})

describe("filterFromParams", () => {
  const read = (search: string, offered: readonly string[] = OFFERED) => filterFromParams(new URLSearchParams(search), offered)

  it("starts where the filter starts for a link with no parameter", () => {
    expect(read("")).toEqual(DEFAULT_FILTER)
    expect(read("players=4&duration=20&complexity=3&age=8")).toEqual(DEFAULT_FILTER)
  })

  it("reads each pick", () => {
    expect(read("category=Cards&players=6&duration=30&complexity=2&age=10")).toEqual({
      query: "",
      categories: ["Cards"],
      players: 6,
      duration: 30,
      complexity: 2,
      age: 10,
    })
    expect(read(`players=${MANY_PLAYERS}`).players).toBe(MANY_PLAYERS)
    expect(read(`duration=${ANY_DURATION}`).duration).toBeNull()
    expect(ANY_DURATION).toBe("any")
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
    expect(read("q=herv%C3%A9+marly&players=3")).toEqual({ ...DEFAULT_FILTER, players: 3 })
  })

  it("ignores a value the filters do not offer", () => {
    for (const bad of ["category=Dice", "category=cards", "category=Cards+", "category="]) expect(read(bad).categories).toEqual([])
    for (const bad of ["players=0", "players=9", "players=04", "players=4.0", "players=-1", "players=1e1", "players=four", "players="]) {
      expect(read(bad).players).toBe(DEFAULT_PLAYERS)
    }
    for (const bad of ["duration=0", "duration=7", "duration=60", "duration=030", "duration=30min", "duration=-30", "duration=30-60", "duration=Any", "duration="]) {
      expect(read(bad).duration).toBe(DEFAULT_DURATION)
    }
    for (const bad of ["complexity=0", "complexity=6", "complexity=03", "complexity=2.5", "complexity=heavy", "complexity="]) {
      expect(read(bad).complexity).toBe(DEFAULT_COMPLEXITY)
    }
    for (const bad of ["age=0", "age=7", "age=08", "age=8.0", "age=eight", "age="]) expect(read(bad).age).toBe(DEFAULT_AGE)
  })

  it("ignores every category when the games have none to offer", () => {
    expect(read("category=Cards", []).categories).toEqual([])
  })

  it("ignores the old availability of a link written before it went", () => {
    expect(read("show=soon&players=5")).toEqual({ ...DEFAULT_FILTER, players: 5 })
  })

  it("keeps the good picks of a link whose other ones are bad", () => {
    expect(read("category=Dice&players=99&duration=15&age=7")).toEqual({ ...DEFAULT_FILTER, duration: 15 })
  })

  it("takes the first of a pick that comes twice, and nothing from the others", () => {
    expect(read("players=2&players=3&utm_source=newsletter").players).toBe(2)
    expect(read("utm_source=newsletter&ref=home")).toEqual(DEFAULT_FILTER)
  })
})

describe("filterToParams", () => {
  it("is empty where the filter starts: the link to the list as it opens is the hub's", () => {
    expect(filterToParams(DEFAULT_FILTER).toString()).toBe("")
    // No limit on the duration is not where the filter starts
    expect(filterToParams(NO_FILTER).toString()).toBe("duration=any")
  })

  it("leaves out the starting picks, 4 players, 20′, level 3 and 8+, and writes the others", () => {
    expect(filterToParams({ ...DEFAULT_FILTER, categories: ["Cards"] }).toString()).toBe("category=Cards")
    expect(filterToParams({ ...DEFAULT_FILTER, players: 5, age: 10 }).toString()).toBe("players=5&age=10")
    expect(filterToParams({ ...DEFAULT_FILTER, duration: 45, complexity: 2 }).toString()).toBe("duration=45&complexity=2")
    expect(filterToParams({ ...DEFAULT_FILTER, duration: null }).toString()).toBe("duration=any")
  })

  it("writes only what is not where the filter starts", () => {
    expect(filterToParams({ ...DEFAULT_FILTER, categories: ["Cards"] }).toString()).toBe("category=Cards")
    expect(filterToParams({ ...DEFAULT_FILTER, players: 5 }).toString()).toBe("players=5")
    expect(filterToParams({ ...DEFAULT_FILTER, duration: 45 }).toString()).toBe("duration=45")
    expect(filterToParams({ ...DEFAULT_FILTER, complexity: 4 }).toString()).toBe("complexity=4")
    expect(filterToParams({ ...DEFAULT_FILTER, age: 10 }).toString()).toBe("age=10")
  })

  it("writes a category for each one that is picked, in the order they were picked", () => {
    expect(filterToParams({ ...DEFAULT_FILTER, categories: ["Party", "Cards"] }).toString()).toBe("category=Party&category=Cards")
  })

  it("writes them in a fixed order", () => {
    expect(
      filterToParams({ query: "", categories: ["Cards"], players: 3, duration: 30, complexity: 2, age: 10 }).toString(),
    ).toBe("category=Cards&players=3&duration=30&complexity=2&age=10")
  })

  it("writes a name that needs it as a URL does", () => {
    expect(filterToParams({ ...DEFAULT_FILTER, categories: ["Party & Co"] }).toString()).toBe("category=Party+%26+Co")
  })

  it("never writes the query: the address of the page goes to analytics with every event", () => {
    expect(filterToParams({ ...DEFAULT_FILTER, query: "hervé marly" }).toString()).toBe("")
    expect(
      filterToParams({ query: "flip", categories: [], players: 3, duration: 30, complexity: null, age: null }).toString(),
    ).toBe("players=3&duration=30")
  })
})

describe("a filter in a link", () => {
  const offered = [...OFFERED, "Party & Co"]
  // The number of players, the complexity and the age are always picked in the search bar, so a link never holds them empty; the duration is a limit, or none ("1h+")
  const every = (): GameFilter[] =>
    [[], ["Cards"], ["Party", "Cards"], ["Party & Co"]].flatMap((categories) =>
      PLAYER_COUNTS.flatMap((players) =>
        [null, ...DURATION_LIMITS].flatMap((duration) =>
          COMPLEXITY_LEVELS.flatMap((complexity) =>
            AGE_LIMITS.map((age) => ({ ...DEFAULT_FILTER, categories, players, duration, complexity, age })),
          ),
        ),
      ),
    )

  it("goes through every combination of options", () => {
    expect(every()).toHaveLength(4 * PLAYER_COUNTS.length * (DURATION_LIMITS.length + 1) * COMPLEXITY_LEVELS.length * AGE_LIMITS.length)
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
