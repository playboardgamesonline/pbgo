"use client"

import { ChartBarIncreasingIcon, HistoryIcon, RankingIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { motion as animated } from "motion/react"
import { useMemo, useRef, type KeyboardEvent } from "react"
import { cn } from "@pbgo/ui/utils"
import { activityOf, barsOf, type GameOverEntry } from "../../lib/game-over"
import { EASE_STANDARD, fade, travel, type Motion } from "../../lib/motion-preference"
import { seatAvatar } from "../../lib/seat-avatar"
import { shortName } from "../../lib/short-name"
import type { SeatTheme } from "../../lib/ui-theme"
import { ACCENT, CROWN_STYLE, Details, type CrownMark, type PodiumPlace, type ResultDetailRenderer } from "./game-over-parts"
import { SeatAvatarMark, SeatLabel } from "./seat-label"
import type { HistoryTurn } from "./ticker"

// What lies under the head of the end screen: the tabs and what each of them shows. The scores of every player come first, in a table, since that is what the screen is for; the statistics (what each player did, counted from the history of the game) and the history
// itself (every turn, the way the board tells it) follow, and exist only for a game that gives its history. Pure presentation, in the game's look: the ink is the text colour, every tint is `current`, the accent is `--go-accent`.

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
    <div role="tablist" aria-label="Details of the game" className="flex shrink-0 gap-1 border-b border-current/15 px-2">
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
export function TabPanel({ base, tab, motion, children }: { base: string; tab: GameOverTab; motion: Motion; children: React.ReactNode }) {
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

/** The columns of the table of the scores: the place, the player and, for a game that counts points, the lines of the score and the total. On a narrow card the lines go under the player. */
const COLUMNS = {
  scored: "grid-cols-[1.75rem_minmax(0,1fr)_auto] sm:grid-cols-[1.75rem_minmax(0,11rem)_minmax(0,1fr)_3.5rem]",
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
 * score (chips, or what the game draws itself) and their total, big, in the accent for a winner. A game that counts no points has the places and the players only. The head of the table stays while the rows scroll.
 */
export function ScoresPanel({ places, winners, meId, scored, together, seat, crown, renderDetail }: ScoresProps) {
  const columns = scored ? COLUMNS.scored : COLUMNS.placed
  const rows = places.flatMap((place) => place.entries.map((entry) => ({ entry, place })))
  return (
    <>
      <div aria-hidden className={cn("grid shrink-0 gap-x-3 border-b border-current/10 px-4 py-2 font-sans text-[0.7rem] font-semibold tracking-[0.18em] uppercase opacity-50", columns)}>
        <span className="text-center">#</span>
        <span>Player</span>
        {scored && <span className="hidden sm:block" />}
        {scored && <span className="text-right">Score</span>}
      </div>
      <div role="region" aria-label="Final ranking" tabIndex={0} className={SCROLLER}>
        <ol>
          {rows.map(({ entry, place }) => {
            const { result, nickname, color, imageUrl } = entry
            const winner = winners.includes(result.playerId)
            const me = result.playerId === meId
            return (
              <li key={result.playerId} className={cn("grid items-center gap-x-3 gap-y-1.5 border-t border-current/10 px-4 py-2.5 first:border-t-0", columns, me && "bg-current/10 shadow-[inset_3px_0_0_var(--go-accent)]")}>
                <span className="grid place-items-center font-display text-lg tabular-nums opacity-55">
                  {winner ? (
                    <span role="img" aria-label="Winner" className="opacity-100" style={CROWN_STYLE}>
                      {crown("size-5")}
                    </span>
                  ) : together ? null : (
                    place.rank
                  )}
                </span>
                <SeatLabel
                  nickname={nickname}
                  color={color}
                  imageUrl={imageUrl}
                  theme={seat}
                  className="gap-2.5 font-sans text-sm font-extrabold tracking-[0.08em] uppercase"
                  nameClassName={seat.name === "seat" ? "brightness-150" : undefined}
                >
                  {me && <span className="font-sans text-xs font-medium tracking-normal normal-case opacity-60">(you)</span>}
                  {place.label && <span className="font-sans text-xs font-medium tracking-normal whitespace-nowrap normal-case opacity-60">{place.label}</span>}
                </SeatLabel>
                {scored && (
                  <div className="col-span-2 col-start-2 row-start-2 empty:hidden sm:col-span-1 sm:col-start-3 sm:row-start-1">
                    {renderDetail ? renderDetail(result, { large: false, centered: false }) : <Details result={result} />}
                  </div>
                )}
                {scored && (
                  <span className="col-start-3 row-start-1 text-right font-display text-2xl leading-none tabular-nums sm:col-start-4" style={winner ? ACCENT : undefined}>
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

type Bar = { entry: GameOverEntry; value: number }

/** One chart of the statistics: a title with its total, then a bar for every player, in the colour of their seat, with their value. The bars grow in from nothing. */
function Chart({ title, total, bars, seat, motion }: { title: string; total?: number; bars: Bar[]; seat: SeatTheme; motion: Motion }) {
  const widths = barsOf(bars.map((bar) => bar.value))
  const top = Math.max(...bars.map((bar) => bar.value))
  return (
    <section aria-label={title} className="flex min-w-0 flex-col gap-3">
      <h3 className="flex items-baseline justify-between gap-2 font-sans text-[0.7rem] font-semibold tracking-[0.18em] uppercase">
        <span className="opacity-60">{title}</span>
        {total !== undefined && <span className="font-display text-sm tracking-normal tabular-nums">{total}</span>}
      </h3>
      <ol className="flex flex-col gap-2.5">
        {bars.map(({ entry, value }, index) => (
          <li key={entry.result.playerId} className="flex items-center gap-2">
            <SeatAvatarMark avatar={seatAvatar({ nickname: entry.nickname, color: entry.color, imageUrl: entry.imageUrl })} theme={seat} size="sm" />
            <span className="ph-mask w-14 shrink-0 truncate font-sans text-xs font-semibold" title={entry.nickname}>
              {shortName(entry.nickname)}
            </span>
            <span aria-hidden className="h-2 min-w-0 flex-1 overflow-hidden rounded-sm bg-current/10">
              <animated.span
                className="block h-full rounded-sm"
                style={{ backgroundColor: entry.color }}
                initial={{ width: 0 }}
                animate={{ width: `${widths[index]}%` }}
                transition={{ duration: fade(motion, 0.6), ease: EASE_STANDARD, delay: motion === "reduced" ? 0 : index * 0.05 }}
              />
            </span>
            <span className="w-9 shrink-0 text-right font-display text-sm tabular-nums" style={value === top && value > 0 ? ACCENT : undefined}>
              {value}
            </span>
          </li>
        ))}
      </ol>
    </section>
  )
}

const GRIDS = { 1: "sm:grid-cols-1", 2: "sm:grid-cols-2", 3: "sm:grid-cols-3" } as const

/**
 * The statistics of the game: a chart for the score of each player (for a game that counts points) and one for the turns they took and one for the moves they made, counted from the history the board gives (`activityOf`, so the numbers are the ones the
 * history lists). The players are in the order of the places, the same in every chart.
 */
export function StatsPanel({ places, scored, history, seat, motion }: { places: PodiumPlace[]; scored: boolean; history: readonly HistoryTurn[]; seat: SeatTheme; motion: Motion }) {
  const entries = places.flatMap((place) => place.entries)
  const activity = useMemo(
    () => new Map(activityOf(history, entries.map((entry) => entry.result.playerId)).map((one) => [one.playerId, one])),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `entries` is rebuilt on every render and says the same thing as `places`
    [history, places],
  )
  const countOf = (pick: "turns" | "moves"): Bar[] => entries.map((entry) => ({ entry, value: activity.get(entry.result.playerId)?.[pick] ?? 0 }))
  const turns = countOf("turns")
  const moves = countOf("moves")
  const charts = [
    ...(scored ? [{ title: "Score", bars: entries.map((entry) => ({ entry, value: entry.result.total })) }] : []),
    { title: "Turns", total: turns.reduce((sum, bar) => sum + bar.value, 0), bars: turns },
    { title: "Moves", total: moves.reduce((sum, bar) => sum + bar.value, 0), bars: moves },
  ]
  return (
    <div role="region" aria-label="Statistics" tabIndex={0} className={cn(SCROLLER, "grid auto-rows-min grid-cols-1 gap-x-8 gap-y-6 p-4", GRIDS[charts.length as 2 | 3])}>
      {charts.map((chart) => (
        <Chart key={chart.title} seat={seat} motion={motion} {...chart} />
      ))}
    </div>
  )
}

/**
 * The history of the game, turn by turn from the first to the last: the number of the turn, who took it and what they did, each move written the way the board's own history writes it (`HistoryTurn`: the game renders its moves). The visitor's turns are
 * lit. The board's history lists the newest turn first; here the game is told in the order it was played.
 */
export function HistoryPanel({ history, entries, meId, seat }: { history: readonly HistoryTurn[]; entries: readonly GameOverEntry[]; meId: string | null; seat: SeatTheme }) {
  const turns = useMemo(() => [...history].reverse(), [history])
  const players = useMemo(() => new Map(entries.map((entry) => [entry.result.playerId, entry])), [entries])
  return (
    <div role="region" aria-label="History of the game" tabIndex={0} className={SCROLLER}>
      <ol>
        {turns.map((turn, index) => {
          const who = players.get(turn.playerId)
          const me = turn.playerId === meId
          return (
            <li key={turn.key} className={cn("grid grid-cols-[1.75rem_minmax(0,1fr)] items-start gap-x-3 gap-y-1 border-t border-current/10 px-4 py-2.5 first:border-t-0 sm:grid-cols-[1.75rem_minmax(0,9rem)_minmax(0,1fr)]", me && "bg-current/[0.06]")}>
              <span className="pt-0.5 text-center font-display text-sm tabular-nums opacity-45">{index + 1}</span>
              {who ? (
                <SeatLabel nickname={who.nickname} color={who.color} imageUrl={who.imageUrl} theme={seat} size="sm" className="gap-2 font-sans text-sm font-bold" nameClassName={seat.name === "seat" ? "brightness-150" : undefined}>
                  {me && <span className="font-sans text-xs font-medium opacity-60">(you)</span>}
                </SeatLabel>
              ) : (
                <span />
              )}
              <ul className="col-start-2 flex min-w-0 flex-col gap-0.5 sm:col-start-3">
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
