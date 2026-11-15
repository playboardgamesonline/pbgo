"use client"

import { ChartBarIncreasingIcon, HistoryIcon, RankingIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { motion as animated } from "motion/react"
import { useEffect, useMemo, useRef, type KeyboardEvent, type ReactNode } from "react"
import { cn } from "@pbgo/ui/utils"
import { activityOf, barsOf, type GameOverEntry } from "../../lib/game-over"
import { EASE_STANDARD, fade, travel, type Motion } from "../../lib/motion-preference"
import { seatAvatar } from "../../lib/seat-avatar"
import { shortName } from "../../lib/short-name"
import type { SeatTheme } from "../../lib/ui-theme"
import { ACCENT, Details, type CrownMark, type PodiumPlace, type ResultDetailRenderer } from "./game-over-parts"
import { SeatAvatarMark, SeatLabel } from "./seat-label"
import type { HistoryTurn } from "./ticker"

// What lies under the head of the end screen: the tabs and what each of them shows. The scores of every player come first, in a table, since that is what the screen is for; the statistics (what each player did, counted from the history of the game) and the history
// itself (every turn, the way the board tells it) follow, and exist only for a game that gives its history. Pure presentation, in the game's look: the ink is the text colour, every tint is `current`, the accent is `--go-accent`. The panels lay themselves out by the width
// of the card they are in (container queries, `@xl:` and `@lg:`), not by the width of the screen: the same card is narrow on a phone and wide on a desktop, but also narrow in a docs page that shows two of them side by side.

export const TABS = ["scores", "stats", "history"] as const
export type GameOverTab = (typeof TABS)[number]

const ICONS = { scores: RankingIcon, stats: ChartBarIncreasingIcon, history: HistoryIcon } as const

const tabId = (base: string, tab: GameOverTab) => `${base}-tab-${tab}`
export const panelId = (base: string) => `${base}-panel`

/**
 * The tabs of the card: a row of text with the icon of each, the open one lit and underlined in the accent (the underline slides from one tab to the next). The arrow keys, Home and End move between them and open the one they reach, as a tab list does;
 * only the open tab is in the tab order. With reduced motion the underline jumps.
 */
export function TabBar({ tabs, value, onChange, base, labels, motion }: { tabs: readonly GameOverTab[]; value: GameOverTab; onChange: (tab: GameOverTab) => void; base: string; labels: Record<GameOverTab, string>; motion: Motion }) {
  const buttons = useRef<Partial<Record<GameOverTab, HTMLButtonElement | null>>>({})
  function onKeyDown(event: KeyboardEvent, index: number) {
    const last = tabs.length - 1
    const target = event.key === "ArrowRight" ? (index === last ? 0 : index + 1) : event.key === "ArrowLeft" ? (index === 0 ? last : index - 1) : event.key === "Home" ? 0 : event.key === "End" ? last : null
    if (target === null) return
    event.preventDefault()
    const tab = tabs[target]!
    onChange(tab)
    buttons.current[tab]?.focus()
  }
  return (
    <div role="tablist" aria-label="Details tabs" className="flex shrink-0 gap-1 border-b border-current/15 px-2">
      {tabs.map((tab, index) => {
        const open = tab === value
        return (
          <button
            key={tab}
            ref={(element) => {
              buttons.current[tab] = element
            }}
            type="button"
            role="tab"
            id={tabId(base, tab)}
            aria-selected={open}
            aria-controls={panelId(base)}
            tabIndex={open ? 0 : -1}
            onClick={() => onChange(tab)}
            onKeyDown={(event) => onKeyDown(event, index)}
            className={cn(
              "relative inline-flex cursor-pointer items-center gap-2 px-3.5 py-2.5 font-display text-base tracking-wide transition-opacity outline-none focus-visible:bg-current/10 motion-reduce:transition-none short:py-1.5 short:text-sm",
              open ? "opacity-100" : "opacity-55 hover:opacity-90",
            )}
          >
            <HugeiconsIcon icon={ICONS[tab]} strokeWidth={1.8} className="size-4 short:hidden" />
            {labels[tab]}
            {open && (
              <animated.span
                layoutId={`${base}-underline`}
                aria-hidden
                className="absolute inset-x-2 -bottom-px h-0.5 rounded-sm bg-[var(--go-accent)]"
                transition={motion === "reduced" ? { duration: 0 } : { duration: 0.25, ease: EASE_STANDARD }}
              />
            )}
          </button>
        )
      })}
    </div>
  )
}

/** The open tab's content: it comes in with a short fade and, unless motion is reduced, a slight rise. It is a column that fills the room it is given, so each panel decides what scrolls. */
export function TabPanel({ base, tab, motion, children }: { base: string; tab: GameOverTab; motion: Motion; children: ReactNode }) {
  return (
    <animated.div
      key={tab}
      role="tabpanel"
      id={panelId(base)}
      aria-labelledby={tabId(base, tab)}
      initial={{ opacity: 0, y: travel(motion, 6) }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: fade(motion, 0.2), ease: EASE_STANDARD }}
      className="flex min-h-0 flex-1 flex-col"
    >
      {children}
    </animated.div>
  )
}

/** A region that scrolls is reached with the keyboard too. */
const SCROLLER = "min-h-0 flex-1 overflow-y-auto outline-none [scrollbar-width:thin] focus-visible:ring-2 focus-visible:ring-current/30 focus-visible:ring-inset"

/** The small capitals over a column of a table. */
const HEAD = "font-sans text-[0.7rem] font-semibold tracking-[0.18em] uppercase"

/**
 * The columns of the table of the scores: the place, the player and, for a game that counts points, the lines of the score and the total. On a narrow card the lines go under the player, and the classes of the row move them back beside it when the card is wide enough.
 */
const COLUMNS = {
  scored: "grid-cols-[1.75rem_minmax(0,1fr)_auto] @xl:grid-cols-[1.75rem_minmax(0,11rem)_minmax(0,1fr)_3.5rem]",
  placed: "grid-cols-[1.75rem_minmax(0,1fr)]",
} as const

type ScoresProps = {
  places: PodiumPlace[]
  winners: readonly string[]
  meId: string | null
  /** The game counts points: the score column and the lines exist. */
  scored: boolean
  /** The table plays together: nobody beat anybody, so there are no places to number. */
  together?: "won" | "lost"
  seat: SeatTheme
  crown: CrownMark
  renderDetail?: ResultDetailRenderer
}

/**
 * The scores, as a table: a row for every player, from the first place to the last, with where they came (a crown for a winner), their picture and name (the visitor's lit and marked "you", a team's name after the name of its players), the lines of their
 * score (chips, or what the game draws itself) and their total, big, in the accent for a winner. A game that counts no points has the places and the players only. The head of the table stays while the rows scroll, and the table opens on
 * the visitor's row when the rows do not all fit: their own score is what they came to read.
 */
export function ScoresPanel({ places, winners, meId, scored, together, seat, crown, renderDetail }: ScoresProps) {
  const columns = scored ? COLUMNS.scored : COLUMNS.placed
  const rows = places.flatMap((place) => place.entries.map((entry) => ({ entry, place })))
  const scroller = useRef<HTMLDivElement>(null)
  const mine = useRef<HTMLLIElement>(null)
  useEffect(() => {
    const box = scroller.current
    const row = mine.current
    if (!box || !row) return
    // Only when the row is not fully in view; the scroller is the row's offset parent, so its offsets are the list's own
    if (row.offsetTop < box.scrollTop || row.offsetTop + row.offsetHeight > box.scrollTop + box.clientHeight) box.scrollTop = Math.max(0, row.offsetTop - (box.clientHeight - row.offsetHeight) / 2)
  }, [])
  return (
    <>
      <div aria-hidden className={cn("grid shrink-0 gap-x-3 border-b border-current/10 px-4 py-2 opacity-50", HEAD, columns)}>
        <span className="text-center">#</span>
        <span>Player</span>
        {scored && <span className="hidden @xl:block" />}
        {scored && <span className="text-right">Score</span>}
      </div>
      <div ref={scroller} role="region" aria-label="Final ranking" tabIndex={0} className={cn(SCROLLER, "relative")}>
        <ol>
          {rows.map(({ entry, place }) => {
            const { result, nickname, color, imageUrl } = entry
            const winner = winners.includes(result.playerId)
            const me = result.playerId === meId
            return (
              <li key={result.playerId} ref={me ? mine : undefined} className={cn("grid items-center gap-x-3 gap-y-1.5 border-t border-current/10 px-4 py-2.5 first:border-t-0", columns, me && "bg-current/10 shadow-[inset_3px_0_0_var(--go-accent)]")}>
                <span className="grid place-items-center font-display text-lg tabular-nums">
                  {winner ? (
                    <span role="img" aria-label="Winner" className="inline-flex" style={{ color: "var(--go-accent)", filter: "drop-shadow(0 0 8px var(--go-accent))" }}>
                      {crown("size-5")}
                    </span>
                  ) : together ? null : (
                    <span className="opacity-55">{place.rank}</span>
                  )}
                </span>
                <div className="flex min-w-0 flex-col gap-0.5">
                  <SeatLabel
                    nickname={nickname}
                    color={color}
                    imageUrl={imageUrl}
                    theme={seat}
                    className="gap-2.5 font-sans text-sm font-extrabold tracking-[0.08em] uppercase"
                    nameClassName={seat.name === "seat" ? "brightness-150" : undefined}
                  >
                    {me && <span className="font-sans text-xs font-medium tracking-normal normal-case opacity-60">(you)</span>}
                  </SeatLabel>
                  {/* The team a player is on, under their name and in line with it: the picture is two rem wide and the gap a little more */}
                  {place.label && <span className="ml-[2.625rem] truncate font-sans text-xs font-medium tracking-normal normal-case opacity-60">{place.label}</span>}
                </div>
                {scored && (
                  <div className="col-span-2 col-start-2 row-start-2 empty:hidden @xl:col-span-1 @xl:col-start-3 @xl:row-start-1">
                    {renderDetail ? renderDetail(result, { large: false, centered: false }) : <Details result={result} />}
                  </div>
                )}
                {scored && (
                  <span className="col-start-3 row-start-1 text-right font-display text-2xl leading-none tabular-nums @xl:col-start-4" style={winner ? ACCENT : undefined}>
                    {result.total}
                  </span>
                )}
              </li>
            )
          })}
        </ol>
      </div>
    </>
  )
}

/** One column of the statistics: what it counts, the total over the table when there is one (the turns of everybody) and the value of each player, in the order of the places. */
type Stat = { title: string; total?: number; values: number[] }

const STAT_COLUMNS = { 2: "grid-cols-[2rem_repeat(2,minmax(0,1fr))] @xl:grid-cols-[10rem_repeat(2,minmax(0,1fr))]", 3: "grid-cols-[2rem_repeat(3,minmax(0,1fr))] @xl:grid-cols-[10rem_repeat(3,minmax(0,1fr))]" } as const

/**
 * The statistics of the game, as a table that compares the players: a row for each of them (their picture, and their name on a card wide enough for it) and a column for the score (for a game that counts points), the turns they took and the moves they made,
 * counted from the history the board gives (`activityOf`, so the numbers are the ones the history lists). Each cell is a bar, in the colour of the seat, with its value; the highest value of a column is in the accent, and a column gives its total in its head
 * where it has one. The players are in the order of the places, as in the scores. The bars grow in from nothing.
 */
export function StatsPanel({ places, scored, history, seat, motion }: { places: PodiumPlace[]; scored: boolean; history: readonly HistoryTurn[]; seat: SeatTheme; motion: Motion }) {
  const entries = places.flatMap((place) => place.entries)
  const activity = new Map(activityOf(history, entries.map((entry) => entry.result.playerId)).map((one) => [one.playerId, one]))
  const countOf = (pick: "turns" | "moves") => entries.map((entry) => activity.get(entry.result.playerId)?.[pick] ?? 0)
  const turns = countOf("turns")
  const moves = countOf("moves")
  const stats: Stat[] = [
    ...(scored ? [{ title: "Score", values: entries.map((entry) => entry.result.total) }] : []),
    { title: "Turns", total: turns.reduce((sum, value) => sum + value, 0), values: turns },
    { title: "Moves", total: moves.reduce((sum, value) => sum + value, 0), values: moves },
  ]
  const bars = stats.map((stat) => barsOf(stat.values))
  // The highest value of a column is lit, unless everybody has the same one: nobody is ahead then
  const tops = stats.map((stat) => (stat.values.every((value) => value === stat.values[0]) ? null : Math.max(...stat.values)))
  const columns = STAT_COLUMNS[stats.length as 2 | 3]
  return (
    <>
      <div aria-hidden className={cn("grid shrink-0 items-baseline gap-x-4 border-b border-current/10 px-4 py-2", columns)}>
        <span />
        {stats.map((stat) => (
          <span key={stat.title} className="flex items-baseline justify-between gap-2">
            <span className={cn(HEAD, "opacity-50")}>{stat.title}</span>
            {stat.total !== undefined && <span className="font-display text-sm tabular-nums">{stat.total}</span>}
          </span>
        ))}
      </div>
      <div role="region" aria-label="Statistics" tabIndex={0} className={SCROLLER}>
        <ul>
          {entries.map((entry, row) => (
            <li key={entry.result.playerId} className={cn("grid items-center gap-x-4 border-t border-current/10 px-4 py-2.5 first:border-t-0", columns)}>
              <span className="flex min-w-0 items-center gap-2.5 font-sans text-sm font-semibold">
                <SeatAvatarMark avatar={seatAvatar({ nickname: entry.nickname, color: entry.color, imageUrl: entry.imageUrl })} theme={seat} size="sm" />
                <span className="ph-mask sr-only truncate @xl:not-sr-only" title={entry.nickname}>
                  {shortName(entry.nickname)}
                </span>
              </span>
              {stats.map((stat, column) => {
                const value = stat.values[row]!
                return (
                  <span key={stat.title} aria-label={`${stat.title}: ${value}`} className="flex min-w-0 items-center gap-2">
                    <span aria-hidden className="h-2 min-w-0 flex-1 overflow-hidden rounded-sm bg-current/10">
                      <animated.span
                        className="block h-full rounded-sm"
                        style={{ backgroundColor: entry.color }}
                        initial={{ width: 0 }}
                        animate={{ width: `${bars[column]![row]}%` }}
                        transition={{ duration: fade(motion, 0.6), ease: EASE_STANDARD, delay: motion === "reduced" ? 0 : row * 0.05 }}
                      />
                    </span>
                    <span className="w-7 shrink-0 text-right font-display text-sm tabular-nums" style={value > 0 && value === tops[column] ? ACCENT : undefined}>
                      {value}
                    </span>
                  </span>
                )
              })}
            </li>
          ))}
        </ul>
      </div>
    </>
  )
}

/**
 * The history of the game, turn by turn from the first to the last: the number of the turn, who took it and what they did, each move written the way the board's own history writes it (`HistoryTurn`: the game renders its moves). The visitor's turns are
 * lit. The board's history lists the newest turn first; here the game is told in the order it was played. A game whose lines say who did what themselves (`sentences`, as the ticker's) has the player's picture before the line and no name.
 */
export function HistoryPanel({ history, entries, meId, seat, sentences = false }: { history: readonly HistoryTurn[]; entries: readonly GameOverEntry[]; meId: string | null; seat: SeatTheme; sentences?: boolean }) {
  const turns = useMemo(() => [...history].reverse(), [history])
  const players = useMemo(() => new Map(entries.map((entry) => [entry.result.playerId, entry])), [entries])
  return (
    <div role="region" aria-label="History of the game" tabIndex={0} className={SCROLLER}>
      <ol>
        {turns.map((turn, index) => {
          const who = players.get(turn.playerId)
          const me = turn.playerId === meId
          return (
            <li
              key={turn.key}
              className={cn(
                "grid items-start gap-x-3 gap-y-1 border-t border-current/10 px-4 py-2.5 first:border-t-0",
                sentences ? "grid-cols-[1.75rem_auto_minmax(0,1fr)]" : "grid-cols-[1.75rem_minmax(0,1fr)] @lg:grid-cols-[1.75rem_minmax(0,9rem)_minmax(0,1fr)]",
                me && "bg-current/[0.06]",
              )}
            >
              <span className="pt-0.5 text-center font-display text-sm tabular-nums opacity-45">{index + 1}</span>
              {!who ? (
                <span />
              ) : sentences ? (
                <SeatAvatarMark avatar={seatAvatar({ nickname: who.nickname, color: who.color, imageUrl: who.imageUrl })} theme={seat} size="sm" className="mt-px" />
              ) : (
                <SeatLabel nickname={who.nickname} color={who.color} imageUrl={who.imageUrl} theme={seat} size="sm" className="gap-2 font-sans text-sm font-bold" nameClassName={seat.name === "seat" ? "brightness-150" : undefined}>
                  {me && <span className="font-sans text-xs font-medium opacity-60">(you)</span>}
                </SeatLabel>
              )}
              <ul className={cn("flex min-w-0 flex-col gap-0.5", sentences ? "col-start-3" : "col-start-2 @lg:col-start-3")}>
                {turn.entries.map((entry) => (
                  <li key={entry.key} className="min-w-0 font-sans text-sm leading-snug">
                    {entry.node}
                  </li>
                ))}
              </ul>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
