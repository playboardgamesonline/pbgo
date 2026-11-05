import { Brain02Icon, ChildIcon, HourglassIcon, UserMultipleIcon } from "@hugeicons/core-free-icons"
import { ordinal } from "@pbgo/accounts"
import { PLATFORM_LANGUAGES } from "@pbgo/accounts/language"
import type { LeaderboardRow } from "@pbgo/ui/leaderboard"
import type { LobbyDetailProps } from "@pbgo/ui/platform/lobby-panel"
import type { ExpansionFact, ExpansionOption, HelperOption } from "@pbgo/ui/platform/lobby-settings"
import type { TableCardProps } from "@pbgo/ui/platform/table-card"
import type { TableEntryProps } from "@pbgo/ui/platform/table-entry"
import { resultOf, type Result } from "@pbgo/ui/results"
import { ageOf, hostOf, nicknameOf, playerRange, seatCount, seatsOf, tableAction, tagOf, type TableSeat, type TableState } from "@pbgo/ui/tables"
import { categoryIcon } from "./category-icons"
import type { Expansion, GameTable, HistoryEntry, Standing, TurnTimer } from "./game-activity"
import { durationLabel, playersLabel } from "./game-card-props"

// What the blocks of a game's page draw, made of the rows of `game-activity.ts`: the one place that words a table (its name, its age, what to know before sitting down, what a visitor may do at it), a visitor's figures and games, and
// that picks what a leaderboard row shows of a standing. The components of `@pbgo/ui` draw what they are given; the docs' specimens run their demo rows through these functions too, so that they show what the page will.

/** The languages a lobby may ask its players to speak: the platform's twelve, each as its own name (the button that says who may join offers them, `LobbyAccess`). */
export const LANGUAGE_OPTIONS = PLATFORM_LANGUAGES.map(({ id, title }) => ({ value: id, label: title }))

/** The pace of a table, when it is worth saying: a table with no clock, one that leaves days to play, or a clock that is not the usual one. The usual pace (`normal`) is not said. */
const PACE: Partial<Record<TurnTimer, string>> = { none: "No timer", slow: "Slow turns", fast: "Fast turns", async: "Async" }

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

/**
 * An expansion as the settings of a lobby draw it (`LobbySettings`): its name, its pictures and its description as they are; what it changes about the game as the figures of the head of the page say them, with the same icons and in the same order (the
 * players, the duration, the complexity, the age), nothing for a figure that does not differ from its game's (`getExpansions` leaves it out); and the categories that it brings, as tags with the icon of each category.
 */
export function expansionOption(expansion: Expansion): ExpansionOption {
  const { id, name, description, coverUrl, coverRatio, boxUrl, boxRatio } = expansion
  const facts: (ExpansionFact | null)[] = [
    expansion.players ? { icon: UserMultipleIcon, text: playersLabel(expansion.players) ?? "" } : null,
    expansion.duration === null ? null : { icon: HourglassIcon, text: durationLabel(expansion.duration) ?? "" },
    expansion.complexity === null ? null : { icon: Brain02Icon, text: `Complexity ${expansion.complexity.toFixed(1)}/5` },
    expansion.age === null ? null : { icon: ChildIcon, text: `Ages ${expansion.age}+` },
  ]
  return {
    id,
    name,
    description,
    facts: facts.filter((fact) => fact !== null),
    tags: expansion.categories.map((label) => ({ label, icon: categoryIcon(label) })),
    coverUrl,
    coverRatio,
    boxUrl,
    boxRatio,
  }
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
  }
}

/**
 * What the panel says of a table: the one a visitor sits at (`mine`: "Your lobby", with, while it waits, a button that cannot be pressed and says how many have joined of those expected, which the one who opened it replaces with the page's button that starts the game (`editable`), and, for a game in play, a button back into it) or one they picked in the list of the open tables (its host's name, with the button that fits what they may do there: Join, or
 * Full, which cannot be pressed). It is who opened it (the line at the top, "Table created by Marly (3/5)"), its code, its people with their names, its settings at the bottom (the expansions of the game, `expansions`, and which of them the table is played with; how fast), for the visitor's own
 * lobby the number of players they may set (`players`, the game's least and most), at the top left in place of that line, and who may join, at the top right, and where it leads. `editable` is for a lobby that the visitor opened and still waits: they set it, and the others only read.
 */
export function tableDetailProps(
  table: GameTable,
  slug: string,
  mine = false,
  expansions: readonly Expansion[] = [],
  editable = false,
  players: { min: number | null; max: number | null } = { min: null, max: null },
  helpers: readonly HelperOption[] = []
): Omit<LobbyDetailProps, "onClose"> {
  const state: TableState = table.status === "lobby" ? "waiting" : "playing"
  const seats = seatsOfTable(table)
  const href = `/${slug}/game/${table.code}`
  const way = actionOf(table, seats)
  const { taken, total } = seatCount(seats)
  return {
    state,
    createdBy: mine ? "you" : (hostOf(seats) ?? "a player who left"),
    title: mine ? (state === "waiting" ? "Your lobby" : "Your game") : nameOfTable(table),
    description: mine && state === "waiting" ? `Table ${table.code}. Share its link to fill the seats.` : `Table ${table.code}`,
    seats,
    settings: {
      expansions: expansions.map(expansionOption),
      chosen: table.expansions,
      pace: table.turnTimer,
      // The helpers are for the lobby the visitor sets: a table of the list says none
      ...(editable ? { editable: true, helpers } : {}),
    },
    // Who may join a lobby and how many players it has are for its host to set, at the top of the panel and above the seats: every other table is read
    ...(editable ? { access: { defaultVisibility: table.visibility, languages: LANGUAGE_OPTIONS }, playerRange: playerRange(players.min, players.max) } : {}),
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

const DAY = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" })

/** "28 Oct": the day of an ISO date, written in UTC so that the server and the browser write the same one. */
export const dayOf = (iso: string): string => DAY.format(new Date(iso))

const FULL_DAY = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })

/** "28 Oct 2026": the day of an ISO date with its year, in UTC like `dayOf`. */
export const fullDayOf = (iso: string): string => FULL_DAY.format(new Date(iso))

/** A game a visitor finished, as a row of the recent games under the head says it. */
export type LastGame = {
  /** "28 Oct 2026": the day it ended, with its year. */
  day: string
  /** How it ended for them: the bar words it and gives it its colour. */
  result: Result
  /** Where they came: "1st", "2nd", "3rd", with no count of the players; none where no ranking applies (a game played together). */
  place: string | null
}

/** What a row of the recent games under the head says of a game a visitor finished (`HistoryEntry`). */
export function lastGameOf(entry: HistoryEntry): LastGame {
  return {
    day: fullDayOf(entry.finishedAt),
    result: resultOf(entry.outcome),
    place: entry.place === null ? null : ordinal(entry.place),
  }
}
