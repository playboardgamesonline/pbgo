import { describe, expect, it } from "vitest"
import { ordinal, perGame, playedGameOf, statsFrom, statsOf, type FinishedGame, type PlayedGame } from "./games"

const game = (id: string, slug: string, name: string, state: PlayedGame["state"], result?: PlayedGame["result"]): PlayedGame => ({
  id,
  slug,
  name,
  playedAt: "2026-10-28T21:12:00Z",
  table: "ABC",
  opponents: [{ nickname: "Marly" }],
  state,
  result,
})

describe("statsOf", () => {
  it("has nothing to say of no game", () => {
    expect(statsOf([])).toEqual({ played: 0, wins: 0, winRate: null, favourite: null })
  })

  it("counts the games that are over, the wins, the share of wins and the game played the most", () => {
    const games = [
      game("1", "courtisans", "Courtisans", "finished", "won"),
      game("2", "courtisans", "Courtisans", "finished", "lost"),
      game("3", "hanabi", "Hanabi", "finished", "won"),
    ]
    expect(statsOf(games)).toEqual({ played: 3, wins: 2, winRate: 67, favourite: "Courtisans" })
  })

  it("counts a game in progress for nothing yet", () => {
    expect(statsOf([game("1", "courtisans", "Courtisans", "in-progress")])).toEqual({ played: 0, wins: 0, winRate: null, favourite: null })
  })

  it("does not count a draw as a win, but as a game played", () => {
    expect(statsOf([game("1", "skyjo", "Skyjo", "finished", "draw")])).toMatchObject({ played: 1, wins: 0, winRate: 0 })
  })

  it("rounds the share of wins to a whole percent", () => {
    const games = [game("1", "a", "A", "finished", "won"), game("2", "a", "A", "finished", "lost"), game("3", "a", "A", "finished", "lost")]
    expect(statsOf(games).winRate).toBe(33)
  })

  it("takes the first by name when two games are played as much", () => {
    const games = [game("1", "skyjo", "Skyjo", "finished", "won"), game("2", "hanabi", "Hanabi", "finished", "won")]
    expect(statsOf(games).favourite).toBe("Hanabi")
  })
})

describe("statsFrom", () => {
  it("has nothing to say of no totals, or of totals with no game played", () => {
    expect(statsFrom([])).toEqual({ played: 0, wins: 0, winRate: null, favourite: null })
    expect(statsFrom([{ slug: "skyjo", name: "Skyjo", played: 0, wins: 0 }])).toEqual({ played: 0, wins: 0, winRate: null, favourite: null })
  })

  it("adds up what was played in each game: the games, the wins, the share of wins and the game played the most", () => {
    expect(
      statsFrom([
        { slug: "hanabi", name: "Hanabi", played: 3, wins: 0 },
        { slug: "courtisans", name: "Courtisans", played: 12, wins: 6 },
        { slug: "skyjo", name: "Skyjo", played: 0, wins: 0 },
      ]),
    ).toEqual({ played: 15, wins: 6, winRate: 40, favourite: "Courtisans" })
  })

  it("names the first game by name when two are played as much", () => {
    expect(
      statsFrom([
        { slug: "skyjo", name: "Skyjo", played: 2, wins: 1 },
        { slug: "hanabi", name: "Hanabi", played: 2, wins: 0 },
      ]).favourite,
    ).toBe("Hanabi")
  })

  it("says the same as statsOf of the games it was made from", () => {
    const games = [game("1", "courtisans", "Courtisans", "finished", "won"), game("2", "courtisans", "Courtisans", "finished", "lost"), game("3", "hanabi", "Hanabi", "finished", "won")]
    expect(statsFrom(perGame(games))).toEqual(statsOf(games))
  })
})

describe("playedGameOf", () => {
  const finished = (overrides: Partial<FinishedGame> = {}): FinishedGame => ({
    id: "r1",
    game: "courtisans",
    finishedAt: "2026-11-08T10:00:00+00:00",
    outcome: "win",
    place: 1,
    points: 16,
    score: null,
    ranked: false,
    playerCount: 3,
    durationSeconds: null,
    pace: "normal",
    opponents: [
      { name: "Ola", avatarUrl: "https://example.com/o.png" },
      { name: null, avatarUrl: null },
    ],
    ...overrides,
  })

  it("keeps the handle of an opponent whose account is still there, which is where their profile is, and none for the others", () => {
    const game = finished({ opponents: [{ name: "Ola", avatarUrl: null, handle: { nickname: "Ola", tag: 7 } }, { name: "Guest", avatarUrl: null }, { name: null, avatarUrl: null }] })
    const { opponents } = playedGameOf(game, "Courtisans")
    expect(opponents).toEqual([{ nickname: "Ola", avatarUrl: null, handle: { nickname: "Ola", tag: 7 } }, { nickname: "Guest", avatarUrl: null }, { nickname: "Player", avatarUrl: null }])
    expect(opponents[1]).not.toHaveProperty("handle")
  })

  it("is a game that is over, told by its end, with the others at the table, the former player of a deleted account named as a player, and the place they came", () => {
    expect(playedGameOf(finished(), "Courtisans")).toEqual({
      id: "r1",
      slug: "courtisans",
      name: "Courtisans",
      playedAt: "2026-11-08T10:00:00+00:00",
      opponents: [
        { nickname: "Ola", avatarUrl: "https://example.com/o.png" },
        { nickname: "Player", avatarUrl: null },
      ],
      state: "finished",
      result: "won",
      rank: 1,
      points: 16,
      ranked: false,
      playerCount: 3,
      pace: "normal",
    })
  })

  it("says how the table was played: its score where the game counts points, ranked or not, how many sat at it, how long it lasted, its speed and its expansions", () => {
    const played = playedGameOf(finished({ score: 31, ranked: true, playerCount: 4, durationSeconds: 1680, pace: "fast" }), "Courtisans", ["Diplomats & Confidants"])
    expect(played).toMatchObject({ score: 31, ranked: true, playerCount: 4, durationSeconds: 1680, pace: "fast", expansions: ["Diplomats & Confidants"] })
    const plain = playedGameOf(finished(), "Courtisans")
    expect("score" in plain).toBe(false)
    expect("durationSeconds" in plain).toBe(false)
    expect("expansions" in plain).toBe(false)
  })

  it("gives an opponent's card the record they have in the game, for an account that rated it", () => {
    const record = { rank: { tier: "Gold", division: 2 }, gamesPlayed: 12, wins: 5 }
    const { opponents } = playedGameOf(finished({ opponents: [{ name: "Ola", avatarUrl: null, handle: { nickname: "Ola", tag: 7 }, record }, { name: "Guest", avatarUrl: null, record: null }] }), "Courtisans")
    expect(opponents[0]?.record).toEqual(record)
    expect(opponents[1]).not.toHaveProperty("record")
  })

  it("has the rank points a game gave or took, a loss too, and none where no points applied", () => {
    expect(playedGameOf(finished({ outcome: "loss", points: -11 }), "Courtisans").points).toBe(-11)
    expect(playedGameOf(finished({ points: 0 }), "Courtisans").points).toBe(0)
    expect("points" in playedGameOf(finished({ points: null }), "Courtisans")).toBe(false)
  })

  it("has no table to go back to: the result outlives the table", () => {
    expect(playedGameOf(finished(), "Courtisans").table).toBeUndefined()
  })

  it.each([
    ["win", "won"],
    ["coop_win", "won"],
    ["draw", "draw"],
    ["loss", "lost"],
    ["coop_loss", "lost"],
    ["abandoned", "lost"],
  ] as const)("reads %s as %s", (outcome, result) => {
    expect(playedGameOf(finished({ outcome }), "Courtisans").result).toBe(result)
  })

  it("has no place for a game played together, nor where the engine ranked nobody", () => {
    expect("rank" in playedGameOf(finished({ outcome: "coop_win", place: 1 }), "Hanabi")).toBe(false)
    expect("rank" in playedGameOf(finished({ place: null }), "Courtisans")).toBe(false)
  })

  it("is a game with no one else at the table when the member played alone", () => {
    expect(playedGameOf(finished({ opponents: [] }), "Courtisans").opponents).toEqual([])
  })
})

describe("perGame", () => {
  it("is one row per game that is over, the most played first, then by name", () => {
    const games = [
      game("1", "skyjo", "Skyjo", "finished", "lost"),
      game("2", "courtisans", "Courtisans", "finished", "won"),
      game("3", "courtisans", "Courtisans", "finished", "lost"),
      game("4", "hanabi", "Hanabi", "finished", "won"),
      game("5", "love-letter", "Love Letter", "in-progress"),
    ]
    expect(perGame(games)).toEqual([
      { slug: "courtisans", name: "Courtisans", played: 2, wins: 1 },
      { slug: "hanabi", name: "Hanabi", played: 1, wins: 1 },
      { slug: "skyjo", name: "Skyjo", played: 1, wins: 0 },
    ])
  })

  it("is empty with no game that is over", () => {
    expect(perGame([])).toEqual([])
  })
})

describe("ordinal", () => {
  it.each([
    [1, "1st"],
    [2, "2nd"],
    [3, "3rd"],
    [4, "4th"],
    [11, "11th"],
    [12, "12th"],
    [13, "13th"],
    [21, "21st"],
    [22, "22nd"],
    [23, "23rd"],
    [101, "101st"],
    [111, "111th"],
  ])("writes %i as %s", (rank, written) => {
    expect(ordinal(rank)).toBe(written)
  })
})
