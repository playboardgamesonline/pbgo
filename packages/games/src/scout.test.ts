import { spawnSync } from "node:child_process"
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"
import { SCOUT_TYPES, SCOUT_VERSION, readScout, scoutProblems, stateProblems, type Scout, type ScoutState } from "./scout"

// The scout file as the skill writes it, and every way for it to be wrong: what the pipeline reads must be what `scoutProblems` accepts, and nothing else.

const valid = (): Scout => ({
  version: 1,
  scoutedAt: "2026-11-15",
  name: "Sample Game",
  slug: "sample-game",
  type: "base-game",
  baseGame: null,
  suggestion: null,
  edition: {
    publisher: "Sample Publisher",
    year: 2024,
    label: "Second edition",
    bggVersionId: 654321,
    rules: { language: "en", url: "https://example.com/rules.pdf", version: "v2.1", date: "2024-03" },
    confidence: "high",
  },
  bgg: { id: 123456, type: "boardgame", year: 2019, rank: 812, rating: 7.41234, ratings: 18200, weight: 1.86, weights: 940 },
  facts: { playersMin: 2, playersMax: 6, duration: 30, minAge: 8, complexity: 1.86 },
  existing: { catalog: "none" },
  notes: ["BGG says 2-8 players, the box says 2-6: the box is kept."],
  sources: [{ label: "Publisher page", url: "https://example.com/sample-game" }],
})

const REMOVE = Symbol("remove")

/** The valid file with one key changed (a path of keys joined by dots, `edition.rules.url`) or removed. */
function changed(path: string, value: unknown): unknown {
  const file = structuredClone(valid()) as Record<string, unknown>
  const keys = path.split(".")
  const last = keys.pop() as string
  let at = file
  for (const key of keys) at = at[key] as Record<string, unknown>
  if (value === REMOVE) delete at[last]
  else at[last] = value
  return file
}

/** The valid file with several keys changed at once. */
const fileWith = (changes: Record<string, unknown>): unknown => {
  const file = structuredClone(valid()) as Record<string, unknown>
  Object.assign(file, changes)
  return file
}

const FLIP_7 = { slug: "flip-7", name: "Flip 7" }

describe("scoutProblems: a sound file", () => {
  it("has no problem", () => {
    expect(scoutProblems(valid())).toEqual([])
    expect(SCOUT_VERSION).toBe(1)
  })

  it("may hold null wherever something is not known", () => {
    const file = fileWith({
      edition: { publisher: "Sample Publisher", year: 2024, label: null, bggVersionId: null, rules: null, confidence: "low" },
      bgg: null,
      facts: { playersMin: null, playersMax: null, duration: null, minAge: null, complexity: null },
      notes: [],
    })
    expect(scoutProblems(file)).toEqual([])
  })

  it("may hold a rulebook with nothing printed on it, and a date that is a year or a month", () => {
    expect(scoutProblems(changed("edition.rules", { language: "fr", url: "https://example.com/regles.pdf", version: null, date: null }))).toEqual([])
    expect(scoutProblems(changed("edition.rules.date", "2024"))).toEqual([])
    expect(scoutProblems(changed("edition.rules.date", "2024-03-15"))).toEqual([])
  })

  it("accepts an expansion whose slug starts with its base game's, up to 48 characters", () => {
    const file = fileWith({ name: "Flip 7: The Village", slug: "flip-7-the-village", type: "expansion", baseGame: FLIP_7 })
    expect(scoutProblems(file)).toEqual([])
    const long = `flip-7-${"x".repeat(41)}`
    expect(long).toHaveLength(48)
    expect(scoutProblems(fileWith({ slug: long, type: "expansion", baseGame: FLIP_7 }))).toEqual([])
  })

  it("accepts a reimplementation of a game of the catalog", () => {
    expect(scoutProblems(fileWith({ name: "Flip 7 Vengeance", slug: "flip-7-vengeance", type: "reimplementation", baseGame: FLIP_7 }))).toEqual([])
  })

  it("accepts a suggestion on a base game", () => {
    const file = fileWith({ suggestion: { type: "expansion", baseGame: FLIP_7, why: "BoardGameGeek lists it as an expansion of Flip 7" } })
    expect(scoutProblems(file)).toEqual([])
  })

  it("knows the three types the platform has", () => {
    expect([...SCOUT_TYPES]).toEqual(["base-game", "expansion", "reimplementation"])
  })
})

describe("scoutProblems: what is not a scout file", () => {
  it.each([[null], [[]], ["{}"], [12]])("says that %j is not an object", (data) => {
    expect(scoutProblems(data)).toEqual(["The file is not a JSON object"])
  })

  it("does not judge a file of another version any further", () => {
    expect(scoutProblems({ version: 2, whatever: true })).toEqual(['version: 2 is not the version this reader knows (1)'])
    expect(scoutProblems({})).toEqual(["version: undefined is not the version this reader knows (1)"])
  })

  it.each([["name"], ["slug"], ["type"], ["baseGame"], ["suggestion"], ["edition"], ["bgg"], ["facts"], ["existing"], ["notes"], ["sources"], ["edition.rules"], ["edition.year"], ["facts.complexity"], ["bgg.weight"]])(
    "says that %s is missing, once, and does not read past it",
    (path) => {
      const problems = scoutProblems(changed(path, REMOVE))
      expect(problems).toEqual([`${path}: is missing (every key is there, null when it is not known)`])
    },
  )

  it("says which key is not one", () => {
    expect(scoutProblems(fileWith({ extra: 1 }))).toEqual(["extra: is not a key of a scout file"])
    expect(scoutProblems(changed("edition.country", "FR"))).toEqual(["edition.country: is not a key of a scout file"])
    expect(scoutProblems(changed("baseGame", { slug: "flip-7", name: "Flip 7", year: 2022 }))).toContain("baseGame.year: is not a key of a scout file")
  })

  it("tells every problem, not the first", () => {
    const problems = scoutProblems(fileWith({ scoutedAt: "yesterday", name: "", sources: [] }))
    expect(problems).toHaveLength(3)
    expect(problems.map((problem) => problem.split(":")[0])).toEqual(["scoutedAt", "name", "sources"])
  })
})

describe("scoutProblems: what is wrong with a key", () => {
  it.each([
    ["scoutedAt", "2026-02-30", "is not a day of the calendar"],
    ["scoutedAt", "15/11/2026", "is not a date"],
    ["scoutedAt", "2026-11", "is not a date"],
    ["scoutedAt", 20261115, "is not a date"],
    ["type", "game", "is not one of base-game, expansion, reimplementation"],
    ["type", null, "is not one of"],
    ["name", "", "The name is empty"],
    ["name", " Sample Game", "has spaces around it or twice in a row"],
    ["name", "Sample  Game", "has spaces around it or twice in a row"],
    ["name", "x".repeat(61), "61 characters long"],
    ["name", 5, "is not text"],
    ["slug", "Sample Game", "is not a slug"],
    ["slug", "api", "is a route of the site"],
    ["slug", "x".repeat(41), "41 characters long, 40 at most"],
    ["slug", 5, "is not text"],
    ["edition.publisher", "", "is empty"],
    ["edition.publisher", " Pub", "has spaces around it"],
    ["edition.publisher", "Pub\u001b[31m", "control character"],
    ["edition.publisher", "P".repeat(121), "121 characters long, 120 at most"],
    ["edition.year", 1700, "is under 1800"],
    ["edition.year", 3000, "is over"],
    ["edition.year", 2024.5, "is not a whole number"],
    ["edition.year", "2024", "is not a whole number"],
    ["edition.label", "", "is empty"],
    ["edition.bggVersionId", 0, "is under 1"],
    ["edition.confidence", "sure", "is not one of high, medium, low"],
    ["edition.rules.language", "English", "is not a language code"],
    ["edition.rules.language", "", "is not a language code"],
    ["edition.rules.url", "http://example.com/rules.pdf", "is not an https address"],
    ["edition.rules.url", "javascript:alert(1)", "is not an https address"],
    ["edition.rules.url", "https://user:secret@example.com/rules.pdf", "credentials"],
    ["edition.rules.url", "https://exa mple.com/rules.pdf", "is not an address"],
    ["edition.rules.url", "not an address", "is not an address"],
    ["edition.rules.version", "", "is empty"],
    ["edition.rules.date", "2024-13", "is not a day of the calendar"],
    ["edition.rules.date", "March 2024", "is not a date"],
    ["bgg.id", 0, "is under 1"],
    ["bgg.type", "rpgitem", "is not one of boardgame, boardgameexpansion"],
    ["bgg.year", 1500, "is under 1800"],
    ["bgg.rank", 0, "is under 1"],
    ["bgg.rating", 11, "is over 10"],
    ["bgg.rating", "7.4", "is not a number"],
    ["bgg.ratings", -1, "is under 0"],
    ["bgg.weight", 1.234, "has more than 2 decimals"],
    ["bgg.weight", 0.5, "is under 1"],
    ["bgg.weight", 5.5, "is over 5"],
    ["bgg.weights", 1.5, "is not a whole number"],
    ["facts.playersMin", 0, "is under 1"],
    ["facts.playersMax", 101, "is over 100"],
    ["facts.duration", 0, "is under 1"],
    ["facts.duration", 2000, "is over 1440"],
    ["facts.minAge", 0, "is under 1"],
    ["facts.minAge", 120, "is over 99"],
    ["facts.complexity", 5.5, "is over 5"],
    ["facts.complexity", 1.234, "has more than 2 decimals"],
    ["existing.catalog", "draft", "is not one of none, published"],
    ["notes", "a note", "is not a list"],
    ["notes", [""], "is empty"],
    ["notes", ["\u001b[31mred"], "control character"],
    ["notes", [5], "is not text"],
    ["sources", [], "is empty: say where the edition was read"],
    ["sources", "https://example.com", "is not a list"],
    ["sources", [{ label: "", url: "https://example.com" }], "is empty"],
    ["sources", [{ label: "Page", url: "http://example.com" }], "is not an https address"],
    ["sources", [{ label: "Page" }], "is missing"],
    ["sources", ["https://example.com"], "is not an object with a label and a url"],
  ])("says what is wrong when %s is %j", (path, value, message) => {
    const problems = scoutProblems(changed(path, value))
    expect(problems.length).toBeGreaterThan(0)
    expect(problems.join("\n")).toContain(message)
    expect(problems[0]?.startsWith(`${path}`) || problems[0]?.startsWith(`${path.split(".")[0]}`)).toBe(true)
  })

  it("holds the notes to twenty and the sources to thirty", () => {
    expect(scoutProblems(changed("notes", Array.from({ length: 21 }, () => "a note")))).toEqual(["notes: holds 21 notes, 20 at most"])
    const source = { label: "Page", url: "https://example.com" }
    expect(scoutProblems(changed("sources", Array.from({ length: 31 }, () => source)))).toEqual(["sources: holds 31 sources, 30 at most"])
  })

  it("asks for a maximum of players that is not under the minimum", () => {
    expect(scoutProblems(changed("facts", { playersMin: 4, playersMax: 2, duration: 30, minAge: 8, complexity: 1.86 }))).toEqual(["facts.playersMax: 2 is under the minimum, 4"])
    expect(scoutProblems(changed("facts", { playersMin: 4, playersMax: 4, duration: 30, minAge: 8, complexity: 1.86 }))).toEqual([])
    expect(scoutProblems(changed("facts", { playersMin: 3, playersMax: null, duration: 30, minAge: 8, complexity: 1.86 }))).toEqual([])
  })
})

describe("scoutProblems: one key against another", () => {
  it("wants no base game for a base game, and one for the others", () => {
    expect(scoutProblems(fileWith({ baseGame: FLIP_7 }))).toEqual(["baseGame: a base game comes from no game: it is null"])
    expect(scoutProblems(fileWith({ type: "reimplementation" }))).toEqual(["baseGame: a reimplementation comes from a game of the catalog: it is not null"])
    expect(scoutProblems(fileWith({ type: "expansion" }))).toContain("baseGame: an expansion comes from a game of the catalog: it is not null")
  })

  it("judges the slug and the name of the base game by the rules of a game", () => {
    expect(scoutProblems(fileWith({ type: "reimplementation", baseGame: { slug: "Flip 7", name: "Flip 7" } }))).toEqual(['baseGame.slug: "Flip 7" is not a slug: lowercase letters and digits, words joined by single dashes (the-crew, 6-nimmt)'])
    expect(scoutProblems(fileWith({ type: "reimplementation", baseGame: { slug: "flip-7", name: " Flip 7" } }))).toEqual(["baseGame.name: has spaces around it or twice in a row"])
    expect(scoutProblems(fileWith({ type: "reimplementation", baseGame: { slug: "flip-7", name: 7 } }))).toEqual(["baseGame.name: 7 is not text"])
    expect(scoutProblems(fileWith({ type: "reimplementation", baseGame: "flip-7" }))).toEqual(["baseGame: is not an object with a slug and a name"])
  })

  it("does not let a game be its own base game", () => {
    expect(scoutProblems(fileWith({ type: "reimplementation", baseGame: { slug: "sample-game", name: "Sample Game" } }))).toEqual(["baseGame.slug: a game is not its own base game"])
  })

  it("wants an expansion's slug to start with its base game's, and a game's slug to stay at 40 characters", () => {
    expect(scoutProblems(fileWith({ slug: "village", type: "expansion", baseGame: FLIP_7 }))).toEqual(['slug: an expansion\'s slug starts with its base game\'s ("flip-7-…")'])
    expect(scoutProblems(fileWith({ slug: `flip-7-${"x".repeat(42)}`, type: "expansion", baseGame: FLIP_7 }))[0]).toContain("49 characters long, 48 at most")
    expect(scoutProblems(fileWith({ slug: `flip-7-${"x".repeat(34)}`, type: "reimplementation", baseGame: FLIP_7 }))[0]).toContain("41 characters long, 40 at most")
  })

  it("does not take a suggestion that says what the type and the base game already say", () => {
    const same = fileWith({ type: "expansion", slug: "flip-7-more", baseGame: FLIP_7, suggestion: { type: "expansion", baseGame: FLIP_7, why: "Same" } })
    expect(scoutProblems(same)).toEqual(["suggestion: repeats what type and baseGame already say: it is null once it is taken"])
    const other = fileWith({ type: "expansion", slug: "flip-7-more", baseGame: FLIP_7, suggestion: { type: "reimplementation", baseGame: FLIP_7, why: "It plays alone" } })
    expect(scoutProblems(other)).toEqual([])
  })

  it("holds a suggestion to an expansion or a reimplementation, with a base game and a reason", () => {
    expect(scoutProblems(fileWith({ suggestion: { type: "base-game", baseGame: FLIP_7, why: "No" } }))).toEqual(["suggestion.type: \"base-game\" is not one of expansion, reimplementation"])
    expect(scoutProblems(fileWith({ suggestion: { type: "expansion", baseGame: null, why: "No" } }))).toEqual(["suggestion.baseGame: is not an object with a slug and a name"])
    expect(scoutProblems(fileWith({ suggestion: { type: "expansion", baseGame: FLIP_7, why: "" } }))).toEqual(["suggestion.why: is empty"])
    expect(scoutProblems(fileWith({ suggestion: { type: "expansion", baseGame: FLIP_7 } }))).toEqual(["suggestion.why: is missing (every key is there, null when it is not known)"])
    expect(scoutProblems(fileWith({ suggestion: "expansion" }))).toEqual(["suggestion: is not null nor an object with a type, a baseGame and a why"])
  })
})

describe("readScout", () => {
  it("gives the file when it is sound", () => {
    const { scout, problems } = readScout(JSON.stringify(valid()))
    expect(problems).toEqual([])
    expect(scout).toEqual(valid())
  })

  it("says that a text is not JSON, and what is wrong with a JSON that is not a scout file", () => {
    expect(readScout("{ not json").scout).toBeNull()
    expect(readScout("{ not json").problems[0]).toMatch(/^The file is not JSON/)
    const wrong = readScout(JSON.stringify(fileWith({ slug: "API" })))
    expect(wrong.scout).toBeNull()
    expect(wrong.problems[0]).toContain("slug:")
  })
})

describe("stateProblems", () => {
  const state: ScoutState = {
    registry: ["flip-7", "skyjo"],
    games: [
      { slug: "flip-7", name: "Flip 7", bggId: 420087, kind: "game" },
      { slug: "flip-7-vengeance", name: "Flip 7 Vengeance", bggId: null, kind: "reimplementation" },
      { slug: "azul", name: "Azul", bggId: 230802, kind: "game" },
    ],
    expansions: [{ slug: "azul-stained-glass", name: "Azul: Stained Glass", bggId: 340000, kind: null, baseGame: "azul" }],
  }
  const scout = (changes: Record<string, unknown> = {}): Scout => fileWith(changes) as Scout

  it("has nothing to say about a new game", () => {
    expect(stateProblems(scout(), state)).toEqual([])
  })

  it("does not scout a game that has its folder", () => {
    const problems = stateProblems(scout({ name: "Skyjo", slug: "skyjo" }), state)
    expect(problems).toEqual(['slug: "skyjo" is already a game of the site (games/skyjo): scouting is for a game that is not built yet'])
  })

  it("wants existing.catalog to say what the catalog holds", () => {
    expect(stateProblems(scout({ existing: { catalog: "published" } }), state)).toEqual(['existing.catalog: says "published", but the catalog has no published game "sample-game"'])
    const published = scout({ name: "Azul", slug: "azul", existing: { catalog: "none" }, bgg: { ...valid().bgg, id: 230802 } })
    expect(stateProblems(published, state)).toEqual(['existing.catalog: says "none", but the catalog has published the game "azul"'])
    expect(stateProblems(scout({ name: "Azul", slug: "azul", existing: { catalog: "published" }, bgg: { ...valid().bgg, id: 230802 } }), state)).toEqual([])
  })

  it("keeps the kind of the entry: a reimplementation is not scouted as a base game, nor the other way round", () => {
    const asGame = scout({ name: "Flip 7 Vengeance", slug: "flip-7-vengeance", existing: { catalog: "published" }, bgg: null })
    expect(stateProblems(asGame, state)).toEqual(['type: the catalog has "flip-7-vengeance" as a reimplementation, not as a base game'])
    const asReimplementation = scout({ name: "Azul", slug: "azul", type: "reimplementation", baseGame: FLIP_7, existing: { catalog: "published" }, bgg: null })
    expect(stateProblems(asReimplementation, state)).toEqual(['type: the catalog has "azul" as a base game, not as a reimplementation'])
    const same = scout({ name: "Flip 7 Vengeance", slug: "flip-7-vengeance", type: "reimplementation", baseGame: FLIP_7, existing: { catalog: "published" }, bgg: null })
    expect(stateProblems(same, state)).toEqual([])
  })

  it("finds a game that the catalog has under another slug: by its name, by its BoardGameGeek item", () => {
    const byName = stateProblems(scout({ name: "AZUL", slug: "azul-2", bgg: null }), state)
    expect(byName).toEqual(['slug: the catalog already has this game as the game "azul" (the same name): one game has one entry, with its slug and its type'])
    const byItem = stateProblems(scout({ name: "Azul Classic", slug: "azul-classic", bgg: { ...valid().bgg, id: 230802 } }), state)
    expect(byItem).toEqual(['slug: the catalog already has this game as the game "azul" (the same BoardGameGeek item): one game has one entry, with its slug and its type'])
  })

  it("finds a game that the catalog has in the other type", () => {
    const asExpansion = scout({ name: "Azul: Stained Glass", slug: "azul-stained-glass-2", type: "expansion", baseGame: { slug: "azul", name: "Azul" }, bgg: { ...valid().bgg, id: 340000, type: "boardgameexpansion" } })
    expect(stateProblems(asExpansion, state)).toEqual(['slug: the catalog already has this game as the expansion "azul-stained-glass" (the same BoardGameGeek item, the same name): one game has one entry, with its slug and its type'])
    const asGame = scout({ name: "Azul: Stained Glass", slug: "azul-stained-glass", bgg: null })
    expect(stateProblems(asGame, state)).toEqual([
      'slug: the catalog already has this game as the expansion "azul-stained-glass" (the same name, the same slug): one game has one entry, with its slug and its type',
    ])
  })

  it("wants the base game to be published, and named as the catalog names it", () => {
    const ghost = scout({ name: "Ghost: More", slug: "ghost-more", type: "expansion", baseGame: { slug: "ghost", name: "Ghost" }, bgg: null })
    expect(stateProblems(ghost, state)).toEqual(['baseGame: "ghost" is not a published game of the catalog: its entry comes first'])
    const misnamed = scout({ name: "Flip 7 Vengeance 2", slug: "flip-7-vengeance-2", type: "reimplementation", baseGame: { slug: "flip-7", name: "Flip Seven" }, bgg: null })
    expect(stateProblems(misnamed, state)).toEqual(['baseGame.name: "Flip Seven" is not the name that the catalog gives "flip-7" ("Flip 7")'])
  })

  it("looks at the game that is suggested too", () => {
    const suggested = scout({ suggestion: { type: "expansion", baseGame: { slug: "ghost", name: "Ghost" }, why: "It looks like one" } })
    expect(stateProblems(suggested, state)).toEqual(['suggestion.baseGame: "ghost" is not a published game of the catalog: its entry comes first'])
    expect(stateProblems(scout({ suggestion: { type: "expansion", baseGame: FLIP_7, why: "It looks like one" } }), state)).toEqual([])
  })

  it("tells every problem it finds", () => {
    const problems = stateProblems(scout({ name: "Skyjo", slug: "skyjo", existing: { catalog: "published" }, type: "expansion", baseGame: { slug: "ghost", name: "Ghost" } }), state)
    expect(problems.length).toBeGreaterThanOrEqual(3)
  })
})

// The skill that writes the file (`.claude/skills/game-scout`): what it shows and names must be what exists.
const REPO = new URL("../../../", import.meta.url)
const read = (path: string) => readFileSync(new URL(path, REPO), "utf8")

describe("the skill game-scout", () => {
  const skill = read(".claude/skills/game-scout/SKILL.md")

  it("is named after its folder and says which agent carries it out", () => {
    const front = /^---\nname: (.+)\ndescription: "(.+)"\n---\n/.exec(skill)
    expect(front?.[1]).toBe("game-scout")
    expect(front?.[2]).toMatch(/^\[GAME agent\] /)
  })

  it("shows a file that the validator accepts, and that is the one it shows", () => {
    const blocks = [...skill.matchAll(/```json\n([\s\S]*?)\n```/g)].map((found) => found[1] ?? "")
    expect(blocks).toHaveLength(1)
    const { scout, problems } = readScout(blocks[0] ?? "")
    expect(problems).toEqual([])
    expect(scout?.version).toBe(SCOUT_VERSION)
  })

  it("names commands that exist", () => {
    const root = JSON.parse(read("package.json")) as { scripts: Record<string, string> }
    const platform = JSON.parse(read("platform/package.json")) as { scripts: Record<string, string> }
    for (const name of ["check:scout", "check:game", "catalog:list"]) {
      expect(skill).toContain(`pnpm ${name}`)
      expect(root.scripts).toHaveProperty(name)
    }
    expect(skill).toContain("pnpm --filter @pbgo/platform content:bgg-lookup")
    expect(platform.scripts).toHaveProperty("content:bgg-lookup")
  })

  it("has a line for the slug that works as it is written", () => {
    const command = /`(node --disable-warning=ExperimentalWarning -e '[^`]+' "<name>")`/.exec(skill)?.[1]
    expect(command).toBeDefined()
    const run = spawnSync("bash", ["-c", (command ?? "").replace("<name>", "Flip 7: Vengeance")], { cwd: fileURLToPath(REPO), encoding: "utf8", timeout: 20_000 })
    expect(run.status, run.stderr).toBe(0)
    expect(run.stdout.trim()).toBe("flip-7-vengeance ok")
  })

  it("is in the list of the skills, and in the table of a game from A to Z as written", () => {
    const readme = read(".claude/skills/README.md")
    expect(readme).toContain("- `game-scout` — ")
    expect(readme).toMatch(/\| `\/game-scout` \(GAM-32\) \| [^|]+ \| written \|/)
  })
})
