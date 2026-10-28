import { describe, expect, it } from "vitest"
import { buildCatalog } from "./catalog"
import {
  AVAILABILITIES,
  DURATION_LIMITS,
  MANY_PLAYERS,
  NO_FILTER,
  PLAYER_COUNTS,
  filterFromParams,
  filterGames,
  filterToParams,
  indexEntry,
  isFiltered,
  normalize,
  optionOf,
  words,
  type GameFilter,
} from "./filter"
import { notionGame, registryGame } from "./testing"

// A catalog in the shape of the real one: the live games in registry order, each with its Notion row or, with none, the line the
// registry makes of it, then the games to come by name. Players and durations cover what the real games have: a fixed count, a range,
// "N or more", a game that does not say.
const catalog = buildCatalog(
  [
    // No Notion row: the registry's line, its name and its figures (a duration only when the registry gives one figure, not a range)
    registryGame("courtisans", { name: "Courtisans", live: true, players: { min: 2, max: 5 }, duration: { min: 30, max: 30 } }),
    // A Notion row, which wins over the registry, whose Skyjo takes 15 to 45 minutes
    registryGame("skyjo", { name: "Skyjo", live: true, players: { min: 2, max: 8 }, duration: { min: 15, max: 45 } }),
    registryGame("tichu", { name: "Tichu", live: true }),
  ],
  [
    notionGame("skyjo", { name: "Skyjo", players: { min: 2, max: 8 }, duration: 45, authors: ["Nadia Okafor"] }),
    notionGame("zen", { name: "Zen" }),
    notionGame("6-nimmt", { name: "6 nimmt!", players: { min: 2, max: 10 }, duration: 45 }),
    notionGame("flip-7", {
      name: "Flip 7",
      players: { min: 3, max: null },
      duration: 20,
      authors: ["Eric Olsen"],
      publishers: [{ name: "The Op Games", url: null }],
    }),
    notionGame("hanabi", { name: "Hanabi", players: { min: 2, max: 5 }, duration: 25, authors: ["Antoine Bauza"] }),
    notionGame("mystery-night", {
      name: "Mystery Night",
      players: { min: 4, max: 7 },
      duration: 30,
      authors: ["Hervé Marly"],
      illustrators: ["Régis Torres"],
      publishers: [{ name: "Spiral Éditions", url: "https://example.com" }],
    }),
    notionGame("millers-hollow", { name: "Werewolves of Miller's Hollow", players: { min: 8, max: null }, duration: 30 }),
    notionGame("solo-quest", { name: "Solo Quest", players: { min: 1, max: 1 }, duration: 15 }),
    notionGame("time-bomb", { name: "Time Bomb", players: { min: 4, max: 8 }, descriptions: { en: "A game of bluffing and secret roles" } }),
  ],
)
const games = catalog.map(indexEntry)

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

  it("offers up to 15, 30 and 45 minutes", () => {
    expect(DURATION_LIMITS).toEqual([15, 30, 45])
  })

  it("offers every game, the games to play and the games to come", () => {
    expect(AVAILABILITIES).toEqual(["all", "play", "soon"])
  })

  it("finds the option that a text spells exactly, else none", () => {
    expect(optionOf(PLAYER_COUNTS, "4")).toBe(4)
    expect(optionOf(DURATION_LIMITS, "30")).toBe(30)
    expect(optionOf(AVAILABILITIES, "soon")).toBe("soon")
    for (const bad of [null, "", "any", "04", "4.0", "9", " 4"]) expect(optionOf(PLAYER_COUNTS, bad)).toBeNull()
    expect(optionOf(AVAILABILITIES, "SOON")).toBeNull()
  })
})

describe("indexEntry", () => {
  const entry = (slug: string) => {
    const found = catalog.find((candidate) => candidate.slug === slug)
    if (!found) throw new Error(`no ${slug} in the fixture`)
    return found
  }

  it("indexes a live game with no Notion row by its name, with the players and the duration of the registry", () => {
    expect(indexEntry(entry("courtisans"))).toEqual({ slug: "courtisans", live: true, text: "courtisans", players: { min: 2, max: 5 }, duration: 30 })
  })

  it("indexes a live game with a Notion row like any other game: by what the row says", () => {
    expect(indexEntry(entry("skyjo"))).toEqual({ slug: "skyjo", live: true, text: "skyjo nadia okafor", players: { min: 2, max: 8 }, duration: 45 })
  })

  it("leaves unknown what a game does not say", () => {
    expect(indexEntry(entry("tichu"))).toEqual({ slug: "tichu", live: true, text: "tichu", players: null, duration: null })
    expect(indexEntry(entry("zen"))).toEqual({ slug: "zen", live: false, text: "zen", players: null, duration: null })
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
    })
  })

  it("does not index the descriptions", () => {
    expect(indexEntry(entry("time-bomb")).text).toBe("time bomb")
  })

  it("keeps the open end of a game for N or more", () => {
    expect(indexEntry(entry("flip-7")).players).toEqual({ min: 3, max: null })
  })

  it("is lean: nothing but what the filter reads, so that the page can send it to the browser", () => {
    expect(Object.keys(indexEntry(entry("flip-7"))).sort()).toEqual(["duration", "live", "players", "slug", "text"])
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

    it("does not look into the descriptions", () => {
      expect(kept({ query: "bluffing" })).toEqual([])
    })

    it("keeps every game for a query of blanks or punctuation", () => {
      expect(kept({ query: "   " })).toHaveLength(games.length)
      expect(kept({ query: "!?" })).toHaveLength(games.length)
    })

    it("keeps none for a word that is in no game", () => {
      expect(kept({ query: "xylophone" })).toEqual([])
    })
  })

  describe("the availability", () => {
    it("keeps the games to play now, or the games to come", () => {
      expect(kept({ availability: "play" })).toEqual(["courtisans", "skyjo", "tichu"])
      expect(kept({ availability: "soon" })).toEqual([
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
    it.each<[number, string[]]>([
      [15, ["solo-quest"]],
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

    it("leaves out a game that does not say its duration", () => {
      const fits = kept({ duration: 45 })
      for (const slug of ["tichu", "time-bomb", "zen"]) expect(fits).not.toContain(slug)
    })
  })

  describe("together", () => {
    it("keeps the games that meet every criterion", () => {
      expect(kept({ availability: "play", players: 4 })).toEqual(["courtisans", "skyjo"])
      expect(kept({ availability: "soon", players: MANY_PLAYERS, duration: 30 })).toEqual(["flip-7", "millers-hollow"])
      expect(kept({ query: "night", duration: 30 })).toEqual(["mystery-night"])
      expect(kept({ query: "night", duration: 15 })).toEqual([])
    })
  })
})

describe("isFiltered", () => {
  it("is false for nothing typed and nothing picked", () => {
    expect(isFiltered(NO_FILTER)).toBe(false)
  })

  it("is true as soon as one thing is typed or picked", () => {
    expect(isFiltered({ ...NO_FILTER, query: "flip" })).toBe(true)
    expect(isFiltered({ ...NO_FILTER, availability: "soon" })).toBe(true)
    expect(isFiltered({ ...NO_FILTER, players: 3 })).toBe(true)
    expect(isFiltered({ ...NO_FILTER, duration: 15 })).toBe(true)
  })

  it("takes a query of blanks for nothing", () => {
    expect(isFiltered({ ...NO_FILTER, query: "   " })).toBe(false)
  })
})

describe("filterFromParams", () => {
  const read = (search: string) => filterFromParams(new URLSearchParams(search))

  it("is no filter for a link with no parameter", () => {
    expect(read("")).toEqual(NO_FILTER)
  })

  it("reads each pick", () => {
    expect(read("show=soon&players=4&duration=30")).toEqual({ query: "", availability: "soon", players: 4, duration: 30 })
    expect(read(`players=${MANY_PLAYERS}`).players).toBe(MANY_PLAYERS)
  })

  it("never reads a query: what a visitor types stays in the page", () => {
    expect(read("q=flip").query).toBe("")
    expect(read("q=herv%C3%A9+marly&show=soon")).toEqual({ ...NO_FILTER, availability: "soon" })
  })

  it("ignores a value the filters do not offer", () => {
    for (const bad of ["show=everything", "show=PLAY", "show="]) expect(read(bad).availability).toBe("all")
    for (const bad of ["players=0", "players=9", "players=04", "players=4.0", "players=-1", "players=1e1", "players=four", "players="]) {
      expect(read(bad).players).toBeNull()
    }
    for (const bad of ["duration=0", "duration=20", "duration=030", "duration=30min", "duration="]) expect(read(bad).duration).toBeNull()
  })

  it("keeps the good picks of a link whose other ones are bad", () => {
    expect(read("show=nonsense&players=99&duration=15")).toEqual({ ...NO_FILTER, duration: 15 })
  })

  it("takes the first of a parameter that comes twice, and nothing from the others", () => {
    expect(read("players=2&players=3&utm_source=newsletter").players).toBe(2)
    expect(read("utm_source=newsletter&ref=home")).toEqual(NO_FILTER)
  })
})

describe("filterToParams", () => {
  it("is empty for no filter: the link to the unfiltered list is the hub's", () => {
    expect(filterToParams(NO_FILTER).toString()).toBe("")
  })

  it("writes only what is set", () => {
    expect(filterToParams({ ...NO_FILTER, availability: "play" }).toString()).toBe("show=play")
    expect(filterToParams({ ...NO_FILTER, players: 4 }).toString()).toBe("players=4")
    expect(filterToParams({ ...NO_FILTER, duration: 45 }).toString()).toBe("duration=45")
  })

  it("writes them in a fixed order", () => {
    expect(filterToParams({ query: "", availability: "soon", players: 3, duration: 30 }).toString()).toBe("show=soon&players=3&duration=30")
  })

  it("never writes the query: the address of the page goes to analytics with every event", () => {
    expect(filterToParams({ ...NO_FILTER, query: "hervé marly" }).toString()).toBe("")
    expect(filterToParams({ query: "flip", availability: "soon", players: 3, duration: 30 }).toString()).toBe("show=soon&players=3&duration=30")
  })
})

describe("a filter in a link", () => {
  const every = (): GameFilter[] =>
    AVAILABILITIES.flatMap((availability) =>
      [null, ...PLAYER_COUNTS].flatMap((players) =>
        [null, ...DURATION_LIMITS].map((duration) => ({ ...NO_FILTER, availability, players, duration })),
      ),
    )

  it("goes through every combination of options", () => {
    expect(every()).toHaveLength(AVAILABILITIES.length * (PLAYER_COUNTS.length + 1) * (DURATION_LIMITS.length + 1))
  })

  it("comes back as it left, through the text of the link", () => {
    for (const filter of every()) {
      const link = filterToParams(filter).toString()
      expect(filterFromParams(new URLSearchParams(link))).toEqual(filter)
    }
  })

  it.each(["flip", "Hervé Marly", "50% & co/ +x=y #z?"])("leaves what was typed out of the link, whatever it is (query %j)", (query) => {
    for (const filter of every()) {
      const link = filterToParams({ ...filter, query }).toString()
      expect(link).toBe(filterToParams(filter).toString())
      expect(new URLSearchParams(link).has("q")).toBe(false)
      expect(filterFromParams(new URLSearchParams(link))).toEqual(filter)
    }
  })
})
