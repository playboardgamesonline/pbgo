import { describe, expect, it } from "vitest"
import { isOlder, lobbyKey, olderLobby, openingSettings, parseCancelRequest, parsePlayRequest, rankLobbies, seated, SEARCH_MAX_GAMES, settleOwn, type Choice, type Lobby } from "./quick-play"
import { RANK_GAP_STEP_MS, type TableSettings } from "./table-settings"

const NOW = Date.parse("2026-01-01T12:00:00.000Z")
const ago = (ms: number) => new Date(NOW - ms).toISOString()

describe("parsePlayRequest", () => {
  it("reads the games, the mode and the nickname", () => {
    expect(parsePlayRequest({ games: ["courtisans", "flip-7"], mode: "normal", nickname: "Ann" })).toEqual({ games: ["courtisans", "flip-7"], mode: "normal", nickname: "Ann", poll: false, waited: undefined })
  })

  it("lists a game once", () => {
    expect(parsePlayRequest({ games: ["a", "b", "a"], mode: "ranked" })?.games).toEqual(["a", "b"])
  })

  it("says whether it is one of the calls that keep a search alive, and how long the visitor has waited", () => {
    expect(parsePlayRequest({ games: ["a"], mode: "normal", poll: true, waited: 12.9 })).toMatchObject({ poll: true, waited: 12 })
    // Only `true` is a poll
    expect(parsePlayRequest({ games: ["a"], mode: "normal", poll: "yes" })?.poll).toBe(false)
  })

  it("keeps the wait to what a day holds, never negative, and drops what is not a number", () => {
    expect(parsePlayRequest({ games: ["a"], mode: "normal", waited: -5 })?.waited).toBe(0)
    expect(parsePlayRequest({ games: ["a"], mode: "normal", waited: 10 ** 9 })?.waited).toBe(86_400)
    for (const waited of ["12", null, Number.NaN, Number.POSITIVE_INFINITY, {}]) expect(parsePlayRequest({ games: ["a"], mode: "normal", waited })?.waited).toBeUndefined()
  })

  it("is nothing for anything that is not a search", () => {
    for (const raw of [null, undefined, "play", 3, [], {}, { games: [], mode: "normal" }, { games: "a", mode: "normal" }, { games: ["a"] }, { games: ["a"], mode: "casual" }]) expect(parsePlayRequest(raw)).toBeNull()
  })

  it("refuses a game that is not a slug", () => {
    for (const game of ["", "Courtisans", "a b", "../x", "-a", 3, null, "a".repeat(65)]) expect(parsePlayRequest({ games: ["ok", game], mode: "normal" })).toBeNull()
  })

  it("takes the most games a search holds and no more", () => {
    const games = Array.from({ length: SEARCH_MAX_GAMES }, (_, index) => `game-${index}`)
    expect(parsePlayRequest({ games, mode: "normal" })?.games).toHaveLength(SEARCH_MAX_GAMES)
    expect(parsePlayRequest({ games: [...games, "one-more"], mode: "normal" })).toBeNull()
  })
})

describe("parseCancelRequest", () => {
  it("reads the tables a visitor stops looking at, and how they were looking", () => {
    expect(parseCancelRequest({ tables: [{ game: "courtisans", code: "ABC234" }], mode: "ranked", waited: 30 })).toEqual({ tables: [{ game: "courtisans", code: "ABC234" }], mode: "ranked", waited: 30 })
    expect(parseCancelRequest({ tables: [] })).toEqual({ tables: [], mode: undefined, waited: undefined })
  })

  it("is nothing for anything that is not a list of tables", () => {
    for (const raw of [null, [], {}, { tables: "ABC234" }, { tables: [{ game: "a" }] }, { tables: [{ game: "A b", code: "ABC234" }] }, { tables: [{ game: "a", code: "" }] }, { tables: [{ game: "a", code: "ABCDEFGHIJKLM" }] }, { tables: [3] }]) {
      expect(parseCancelRequest(raw)).toBeNull()
    }
  })

  it("holds no more tables than a search can have", () => {
    const tables = Array.from({ length: SEARCH_MAX_GAMES + 1 }, (_, index) => ({ game: `g${index}`, code: "ABC234" }))
    expect(parseCancelRequest({ tables })).toBeNull()
  })
})

describe("openingSettings", () => {
  it("opens a normal table public, at the usual speed, with the seats between the game's least and most", () => {
    expect(openingSettings("normal", { min: 2, max: 4 }, "Gold")).toEqual({ visibility: "public", pace: "normal", seats: 3 })
  })

  it("marks a ranked table and keeps the tier of the member who opens it", () => {
    expect(openingSettings("ranked", { min: 2, max: 6 }, "Silver")).toEqual({ visibility: "public", pace: "normal", seats: 4, ranked: true, anchor: "Silver" })
  })
})

const lobby = (code: string, seats: number, over: Partial<Lobby> & { settings?: TableSettings } = {}): Lobby => ({
  game: "courtisans",
  code,
  players: Array.from({ length: seats }, (_, index) => ({ id: `${code}-${index}` })),
  settings: { visibility: "public", pace: "normal", seats: 4 },
  createdAt: ago(10_000),
  ...over,
})

const choice = (over: Partial<Choice> = {}): Choice => ({
  mode: "normal",
  viewer: () => ({ tier: "Silver", language: "en" }),
  maxOf: () => 4,
  mine: new Set(),
  now: NOW,
  ...over,
})

describe("the lobbies seated people count", () => {
  it("do not count a seat that left", () => {
    expect(seated({ players: [{ id: "a" }, { id: "b", left: true }, { id: "c", left: false }] })).toBe(2)
  })

  it("have a key made of the game and the code", () => {
    expect(lobbyKey({ game: "courtisans", code: "ABC234" })).toBe("courtisans:ABC234")
  })
})

describe("rankLobbies", () => {
  it("puts the fullest lobby first, so that tables fill and begin", () => {
    const found = rankLobbies([lobby("AAAAAA", 1), lobby("BBBBBB", 3), lobby("CCCCCC", 2)], choice())
    expect(found.map((one) => one.code)).toEqual(["BBBBBB", "CCCCCC", "AAAAAA"])
  })

  it("puts the older of two lobbies as full first, and the code settles two opened at the same instant", () => {
    const found = rankLobbies([lobby("NEWEST", 2, { createdAt: ago(1_000) }), lobby("OLDEST", 2, { createdAt: ago(50_000) }), lobby("MIDDLE", 2, { createdAt: ago(20_000) })], choice())
    expect(found.map((one) => one.code)).toEqual(["OLDEST", "MIDDLE", "NEWEST"])
    const same = rankLobbies([lobby("BBBBBB", 1, { createdAt: ago(5_000) }), lobby("AAAAAA", 1, { createdAt: ago(5_000) })], choice())
    expect(same.map((one) => one.code)).toEqual(["AAAAAA", "BBBBBB"])
  })

  it("never mixes the modes: a normal search finds normal tables and a ranked one ranked tables", () => {
    const normal = lobby("NORMAL", 1)
    const ranked = lobby("RANKED", 1, { settings: { visibility: "public", pace: "normal", seats: 4, ranked: true, anchor: "Silver" } })
    expect(rankLobbies([normal, ranked], choice({ mode: "normal" })).map((one) => one.code)).toEqual(["NORMAL"])
    expect(rankLobbies([normal, ranked], choice({ mode: "ranked" })).map((one) => one.code)).toEqual(["RANKED"])
  })

  it("leaves out a table that is not played at the usual speed, and takes one that kept no speed", () => {
    const fast = lobby("FASTFA", 2, { settings: { visibility: "public", seats: 4, pace: "fast" } })
    const usual = lobby("USUALL", 1, { settings: { visibility: "public", seats: 4 } })
    expect(rankLobbies([fast, usual], choice()).map((one) => one.code)).toEqual(["USUALL"])
  })

  it("leaves out the lobbies where the visitor sits already", () => {
    const found = rankLobbies([lobby("MINEMI", 2), lobby("OTHERS", 1)], choice({ mine: new Set(["courtisans:MINEMI"]) }))
    expect(found.map((one) => one.code)).toEqual(["OTHERS"])
  })

  it("leaves out a full lobby, whatever the game takes, and counts the seats of a table that kept none as the game's most", () => {
    const full = lobby("FULLFU", 4)
    const smaller = lobby("SMALLS", 2, { settings: { visibility: "public", pace: "normal", seats: 2 } })
    const none = lobby("NOSEAT", 3, { settings: { visibility: "public" } })
    expect(rankLobbies([full, smaller, none], choice()).map((one) => one.code)).toEqual(["NOSEAT"])
    expect(rankLobbies([none], choice({ maxOf: () => 3 }))).toEqual([])
  })

  it("does not count a seat that left as taken", () => {
    const left = lobby("LEFTLE", 4, { players: [{ id: "a" }, { id: "b" }, { id: "c" }, { id: "d", left: true }] })
    expect(rankLobbies([left], choice())).toHaveLength(1)
  })

  it("leaves out a lobby whose rank or language the visitor does not meet", () => {
    const gold = lobby("GOLDGO", 2, { settings: { visibility: "public", seats: 4, minRank: "Gold" } })
    const french = lobby("FRENCH", 2, { settings: { visibility: "public", seats: 4, language: "fr" } })
    const open = lobby("OPENOP", 1)
    expect(rankLobbies([gold, french, open], choice()).map((one) => one.code)).toEqual(["OPENOP"])
    expect(rankLobbies([gold, french, open], choice({ viewer: () => ({ tier: "Platinum", language: "fr" }) })).map((one) => one.code)).toEqual(["FRENCH", "GOLDGO", "OPENOP"])
  })

  it("keeps a ranked search to the tables opened near its tier, and widens with the time they waited", () => {
    const gold = (code: string, waited: number) => lobby(code, 2, { settings: { visibility: "public", pace: "normal", seats: 4, ranked: true, anchor: "Gold" }, createdAt: ago(waited) })
    const silver = choice({ mode: "ranked", viewer: () => ({ tier: "Silver", language: "en" }) })
    const apprentice = choice({ mode: "ranked", viewer: () => ({ tier: "Apprentice", language: "en" }) })
    expect(rankLobbies([gold("FRESHF", 0)], silver)).toHaveLength(1)
    expect(rankLobbies([gold("FRESHF", 0)], apprentice)).toHaveLength(0)
    expect(rankLobbies([gold("WAITED", 2 * RANK_GAP_STEP_MS)], apprentice)).toHaveLength(1)
  })

  it("asks the criteria of each game of the lobbies it is given", () => {
    const other = lobby("OTHERG", 1, { game: "flip-7", settings: { visibility: "public", seats: 4, minRank: "Gold" } })
    const found = rankLobbies([lobby("COURTI", 1), other], choice({ viewer: (game) => ({ tier: game === "flip-7" ? "Platinum" : "Silver", language: "en" }) }))
    expect(found.map((one) => one.code)).toEqual(["COURTI", "OTHERG"])
  })

  it("does not change the list it is given", () => {
    const lobbies = [lobby("AAAAAA", 1), lobby("BBBBBB", 3)]
    rankLobbies(lobbies, choice())
    expect(lobbies.map((one) => one.code)).toEqual(["AAAAAA", "BBBBBB"])
  })
})

describe("isOlder", () => {
  it("is the one opened first, and the code settles the same instant", () => {
    expect(isOlder({ createdAt: ago(2_000), code: "ZZZZZZ" }, { createdAt: ago(1_000), code: "AAAAAA" })).toBe(true)
    expect(isOlder({ createdAt: ago(1_000), code: "AAAAAA" }, { createdAt: ago(2_000), code: "ZZZZZZ" })).toBe(false)
    expect(isOlder({ createdAt: ago(1_000), code: "AAAAAA" }, { createdAt: ago(1_000), code: "BBBBBB" })).toBe(true)
    expect(isOlder({ createdAt: ago(1_000), code: "AAAAAA" }, { createdAt: ago(1_000), code: "AAAAAA" })).toBe(false)
  })

  it("counts a table with no readable date as the oldest", () => {
    expect(isOlder({ createdAt: "", code: "AAAAAA" }, { createdAt: ago(1_000), code: "AAAAAA" })).toBe(true)
  })
})

describe("olderLobby", () => {
  const mine = { createdAt: ago(5_000), code: "MINEMI" }

  it("is the lobby a searcher who sits alone should move to: one that has somebody and was opened before theirs", () => {
    const candidates = [lobby("YOUNGE", 2, { createdAt: ago(1_000) }), lobby("ELDERS", 1, { createdAt: ago(9_000) })]
    expect(olderLobby(mine, candidates)?.code).toBe("ELDERS")
  })

  it("stays where it is when every other lobby is newer, so that two searchers who see each other's table agree on which one stays", () => {
    expect(olderLobby(mine, [lobby("YOUNGE", 2, { createdAt: ago(1_000) })])).toBeNull()
    expect(olderLobby({ createdAt: ago(9_000), code: "ELDERS" }, [lobby("MINEMI", 1, { createdAt: ago(5_000) })])).toBeNull()
  })

  it("does not move to an empty lobby", () => {
    expect(olderLobby(mine, [lobby("EMPTYE", 0, { createdAt: ago(9_000) })])).toBeNull()
  })

  it("is nothing when there is no other lobby", () => {
    expect(olderLobby(mine, [])).toBeNull()
  })
})

describe("settleOwn", () => {
  it("keeps the only lobby of the visitor and gives nothing up", () => {
    const only = lobby("ONLYYY", 1)
    expect(settleOwn([only])).toEqual({ stay: only, spares: [] })
  })

  it("keeps the older of two lobbies that two calls of the same moment opened and gives the other up, whichever order they come in", () => {
    const older = lobby("OLDERR", 1, { createdAt: ago(5_000) })
    const younger = lobby("YOUNGE", 1, { createdAt: ago(4_955) })
    expect(settleOwn([younger, older])).toEqual({ stay: older, spares: [younger] })
    expect(settleOwn([older, younger])).toEqual({ stay: older, spares: [younger] })
  })

  it("lets the code settle two lobbies opened at the same instant, so that both calls agree", () => {
    const a = lobby("AAAAAA", 1, { createdAt: ago(5_000) })
    const b = lobby("BBBBBB", 1, { createdAt: ago(5_000) })
    expect(settleOwn([b, a]).stay).toBe(a)
    expect(settleOwn([a, b]).stay).toBe(a)
  })

  it("keeps the fullest lobby whatever its age, and never gives up one where somebody sits with the visitor", () => {
    const alone = lobby("OLDERR", 1, { createdAt: ago(9_000) })
    const company = lobby("FULLER", 2, { createdAt: ago(1_000) })
    expect(settleOwn([alone, company])).toEqual({ stay: company, spares: [alone] })
    const both = settleOwn([lobby("BOTH_A", 2, { createdAt: ago(9_000) }), lobby("BOTH_B", 3, { createdAt: ago(1_000) })])
    expect(both.stay?.code).toBe("BOTH_B")
    expect(both.spares).toEqual([])
  })

  it("is nothing when the visitor sits at none", () => {
    expect(settleOwn([])).toEqual({ stay: null, spares: [] })
  })
})
