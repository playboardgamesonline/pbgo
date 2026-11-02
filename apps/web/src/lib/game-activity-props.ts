import { ordinal } from "@pbgo/accounts"
import { PLATFORM_LANGUAGES } from "@pbgo/accounts/language"
import type { LeaderboardRow } from "@pbgo/ui/leaderboard"
import type { LobbyDetailProps } from "@pbgo/ui/platform/lobby-panel"
import type { TableCardProps } from "@pbgo/ui/platform/table-card"
import type { TableEntryProps } from "@pbgo/ui/platform/table-entry"
import { rankLabel, type Rank } from "@pbgo/ui/ranks"
import { agoOf, resultOf, timePlayed, winRate, type Result } from "@pbgo/ui/results"
import { ageOf, DELETED_PLAYER, nicknameOf, seatCount, seatsOf, tableAction, tagOf, type TableSeat, type TableState } from "@pbgo/ui/tables"
import type { Expansion, GameTable, HistoryEntry, PlayerStats, Standing, TurnTimer } from "./game-activity"

// What the blocks of a game's page draw, made of the rows of `game-activity.ts`: the one place that words a table (its name, its age, what to know before sitting down, what a visitor may do at it), a visitor's figures and games, and
// that picks what a leaderboard row shows of a standing. The components of `@pbgo/ui` draw what they are given; the docs' specimens run their demo rows through these functions too, so that they show what the page will.

/** The pace of a table, when it is worth saying: a table with a clock on every turn, or one that leaves days to play. The usual pace (`normal`, `none`) is not said. */
/** The languages a lobby may ask its players to speak: the platform's twelve, each as its own name (a lobby's settings offer them, `LobbySettings`). */
export const LANGUAGE_OPTIONS = PLATFORM_LANGUAGES.map(({ id, title }) => ({ value: id, label: title }))

const PACE: Partial<Record<TurnTimer, string>> = { fast: "Fast turns", async: "Async" }

/** The seats of a table, in order: each person with their name, tag, picture, record and whether they opened it, `null` for a seat nobody took. */
export function seatsOfTable(table: GameTable): TableSeat[] {
  return seatsOf(
    table.players.map(({ seat, name, avatarUrl, playerId, record }) => ({
      seat,
      name: name === null ? null : nicknameOf(name),
      tag: name === null ? null : tagOf(name),
      avatarUrl,
      host: playerId === table.hostId,
      record,
    })),
    table.seatsMax,
  )
}

/** What a visitor may do at a table: the rule of `tableAction` applied to the seats left. */
function actionOf(table: GameTable, seats: readonly TableSeat[]) {
  return tableAction(table.status === "lobby" ? "waiting" : "playing", seatCount(seats).free)
}

/** The facts of a table worth saying before sitting down: the pace when it is not the usual one, then the expansions it is played with (every table counts for the leaderboard, so that is not said). */
function factsOf(table: GameTable, expansions: readonly Expansion[]): string[] {
  const names = table.expansions.flatMap((id) => expansions.find((expansion) => expansion.id === id)?.name ?? [])
  return [PACE[table.turnTimer], ...names].filter((fact) => fact !== undefined)
}

/** The name of a table: its host's, or its code when the host has deleted their account. */
function nameOfTable(table: GameTable): string {
  const host = table.players.find((player) => player.playerId === table.hostId)
  return host?.name ? `${nicknameOf(host.name)}'s table` : `Table ${table.code}`
}

/** The age of a table in the words of its state: when a table that waits was opened, how long one that is played has been. */
function ageOfTable(table: GameTable, now: number): string {
  return table.status === "lobby" ? ageOf("waiting", table.createdAt, now) : ageOf("playing", table.startedAt ?? table.createdAt, now)
}

/** The card of a table of the game `slug`: `now` is when its age is counted from (the page's, so that every card of a page counts from the same moment), `expansions` the ones the game has, which name the ones the table is played with. */
export function tableCardProps(table: GameTable, slug: string, now: number = Date.now(), expansions: readonly Expansion[] = []): TableCardProps {
  const seats = seatsOfTable(table)
  return {
    state: table.status === "lobby" ? "waiting" : "playing",
    title: nameOfTable(table),
    seats,
    age: ageOfTable(table, now),
    facts: factsOf(table, expansions),
    action: actionOf(table, seats),
    href: `/${slug}/game/${table.code}`,
  }
}

/** The row of a table in the list of the open tables of the game `slug`: who hosts it, a circle for each of its seats, what to know about it and how old it is (`TableEntry`). `mine` is for the table that the visitor sits at, whose free seats invite instead of join. */
export function tableEntryProps(table: GameTable, slug: string, now: number = Date.now(), expansions: readonly Expansion[] = [], mine = false): Omit<TableEntryProps, "selected" | "onSelect" | "controls"> {
  const seats = seatsOfTable(table)
  return {
    state: table.status === "lobby" ? "waiting" : "playing",
    seats,
    age: ageOfTable(table, now),
    facts: factsOf(table, expansions),
    action: actionOf(table, seats),
    href: `/${slug}/game/${table.code}`,
    mine,
  }
}

/** The tables of a game as the list of cards draws them, in the order they come. */
export function tableListProps(tables: readonly GameTable[], slug: string, now: number = Date.now()): { id: string; card: TableCardProps }[] {
  return tables.map((table) => ({ id: table.id, card: tableCardProps(table, slug, now) }))
}

/** The row of a leaderboard for a standing: the nickname alone (the tag tells two players of one name apart on their profile), the rest as the standing has it: a place and a rank, never a rating. */
export function leaderboardRow(standing: Standing): LeaderboardRow {
  return {
    id: standing.playerId,
    place: standing.place,
    name: standing.nickname,
    avatarUrl: standing.avatarUrl,
    rank: standing.rank,
    wins: standing.wins,
    played: standing.gamesPlayed,
  }
}

/**
 * What the panel says of a table: the one a visitor sits at (`mine`: "Your lobby", with, while it waits, a button that cannot be pressed and says how many have joined of those expected, which the one who opened it replaces with the page's button that starts the game (`editable`), and, for a game in play, a button back into it) or one they picked in the list of the open tables (its host's name, with the button that fits what they may do there: Join, or
 * Full, which cannot be pressed). It is the table's age and code, its people with their names, its settings at the bottom (the expansions of the game, `expansions`, and which of them the table is played with; how fast), for the visitor's own
 * lobby who may find it, at the top right, and where it leads. `editable` is for a lobby that the visitor opened and still waits: they set it, and the others only read. `now` is when its age is counted from.
 */
export function tableDetailProps(table: GameTable, slug: string, now: number = Date.now(), mine = false, expansions: readonly Expansion[] = [], editable = false): Omit<LobbyDetailProps, "onClose"> {
  const state: TableState = table.status === "lobby" ? "waiting" : "playing"
  const seats = seatsOfTable(table)
  const href = `/${slug}/game/${table.code}`
  const way = actionOf(table, seats)
  const { taken, total } = seatCount(seats)
  return {
    state,
    age: ageOfTable(table, now),
    title: mine ? (state === "waiting" ? "Your lobby" : "Your game") : nameOfTable(table),
    description: mine && state === "waiting" ? `Table ${table.code}. Share its link to fill the seats.` : `Table ${table.code}`,
    seats,
    settings: {
      expansions,
      chosen: table.expansions,
      pace: table.turnTimer,
      ...(editable ? { editable: true, languages: LANGUAGE_OPTIONS } : {}),
    },
    // Who may find a lobby is for its host to set, at the top of the panel: every other table is read
    ...(editable ? { visibility: table.visibility } : {}),
    action: mine
      ? state === "playing"
        ? { label: "Rejoin your game", href }
        : // the one who opened the lobby starts it with the page's own button (`start`); anybody else waits for them
          editable
          ? null
          : { label: `Waiting to start · ${taken}/${total}`, disabled: true }
      : way === "join"
        ? { label: "Join", href }
        : way === "full"
          ? { label: "Full", disabled: true }
          : null,
    // The plus of a free seat: for the visitor who sits at the table, the menu that invites a friend or copies the link; for another, the way in
    ...(mine && state === "waiting" ? { invite: { link: href } } : way === "join" ? { join: { href } } : {}),
  }
}

/** One figure of a visitor's stats, worded: a label, the figure, and a word more when there is one. The figure of a rank carries the rank too, so that the block can draw it as a badge. */
export type StatFigure = { label: string; value: string; hint?: string; rank?: Rank }

/** The four figures of a visitor's stats in a game: how many games they played and for how long, how many they won, their rank and their position on the board, out of how many players. A figure that is not known is a dash. */
export function statFigures(stats: PlayerStats): StatFigure[] {
  const rate = winRate(stats.wins, stats.gamesPlayed)
  return [
    { label: "Games played", value: String(stats.gamesPlayed), hint: `${timePlayed(stats.secondsPlayed)} played` },
    { label: "Win rate", value: rate === null ? "—" : `${rate}%`, hint: `${stats.wins} ${stats.wins === 1 ? "win" : "wins"}` },
    { label: "Rank", value: stats.rank === null ? "—" : rankLabel(stats.rank), hint: stats.rank === null ? "Not ranked yet" : undefined, ...(stats.rank === null ? {} : { rank: stats.rank }) },
    {
      label: "Position",
      value: stats.place === null ? "—" : ordinal(stats.place),
      hint: stats.place === null ? "Not on the board yet" : `of ${stats.rankedPlayers} ${stats.rankedPlayers === 1 ? "player" : "players"}`,
    },
  ]
}

/** A game of a visitor's history, as a row draws it. */
export type HistoryRow = {
  id: string
  result: Result
  /** The game's name: what a row is called. */
  title: string
  /** The expansions it was played with, by name: none for the base game. */
  expansions: string[]
  /** How long ago it was: "3 d ago". */
  when: string
  /** "3rd of 4", or "4 players" where no ranking applies: for a screen reader, the row has no room for it. */
  place: string
  /** "42 pts": none for a game that has no score. */
  score?: string
  /** "+120 XP": what it gave them; none when it gave nothing. */
  xp?: string
  /** The others at the table, each with the name they sat down with (without its tag) and their picture. */
  opponents: { name: string; avatarUrl: string | null }[]
}

const DAY = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" })

/** "28 Oct": the day of an ISO date, written in UTC so that the server and the browser write the same one. */
export const dayOf = (iso: string): string => DAY.format(new Date(iso))

/**
 * The rows of a visitor's history, in the order they come (the latest first). A row is called by the name of the game, `game.name`, and says which of its expansions (`game.expansions`) it was played with. `now` is when how long ago it was is counted
 * from: the page's own (the default), or a fixed one for the docs' specimens, which are built once.
 */
export function historyRows(entries: readonly HistoryEntry[], game: { name: string; expansions?: readonly Expansion[] }, now: number = Date.now()): HistoryRow[] {
  return entries.map((entry) => ({
    id: entry.tableId,
    result: resultOf(entry.outcome),
    title: game.name,
    expansions: entry.expansions.flatMap((id) => game.expansions?.find((expansion) => expansion.id === id)?.name ?? []),
    when: agoOf(entry.finishedAt, now),
    place: entry.place === null ? `${entry.playerCount} players` : `${ordinal(entry.place)} of ${entry.playerCount}`,
    score: entry.score === null ? undefined : `${entry.score} pts`,
    xp: entry.xp === null || entry.xp === 0 ? undefined : `+${entry.xp} XP`,
    opponents: entry.opponents.map(({ name, avatarUrl }) => ({ name: name === null ? DELETED_PLAYER : nicknameOf(name), avatarUrl })),
  }))
}
