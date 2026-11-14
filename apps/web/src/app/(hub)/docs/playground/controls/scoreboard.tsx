"use client"

import { SeatLabel } from "@pbgo/core/components/game/seat-label"
import { cn } from "@pbgo/ui/utils"
import { useSyncExternalStore } from "react"
import { cssColor } from "../../_specimens/scene/color"
import { PLAY_NAMES, PLAY_SEAT_COLORS, type PlayState } from "../../_specimens/scene/defaults"
import { leader } from "../../_specimens/scene/play/state"

/** The colour of each seat as `#rrggbb`, which the avatar's ink is worked out from: the page's tokens, resolved once the browser has them (the same ones the table's plates wear) */
let resolved: string[] | undefined
const NONE: string[] = []
const noSubscription = () => () => undefined
const useSeatColors = (): string[] =>
  useSyncExternalStore(
    noSubscription,
    () => (resolved ??= PLAY_SEAT_COLORS.map((expression) => cssColor(expression))),
    () => NONE,
  )

/**
 * The players of the table in the platform's look at the top right of the screen, as `TablePlayers` is in a game: each player with the colour of their seat, the crown of the turn as a lighter row, and the points (the total, and the round's in brackets). `TablePlayers` itself reads the
 * game of the page (`useGame`), which the playground has not, so this is the same list drawn from the playground's own state.
 */
export function Scoreboard({ state, onPick }: { state: PlayState; onPick: (seat: number) => void }) {
  const colors = useSeatColors()
  const top = leader(state)
  if (colors.length === 0) return null
  return (
    <ul aria-label="Players" className="platform pointer-events-auto absolute top-3 right-3 z-10 flex w-52 flex-col gap-0.5 rounded-3xl border glass p-1.5 font-sans text-foreground shadow-surface sm:w-60">
      <li className="flex items-baseline justify-between px-3 pt-1 pb-0.5 text-xs text-muted-foreground">
        <span>Round {state.score.round}</span>
        <span>{top === null ? "no points yet" : `${PLAY_NAMES[top]} leads`}</span>
      </li>
      {PLAY_NAMES.slice(0, state.players).map((name, seat) => {
        const points = state.score.points[seat] ?? 0
        return (
          <li key={name}>
            <button
              type="button"
              onClick={() => onPick(seat)}
              aria-pressed={state.seat === seat}
              aria-current={state.turn === seat ? "true" : undefined}
              className={cn("flex w-full items-center gap-3 rounded-2xl py-1 pr-3 pl-2 text-left transition-colors hover:bg-muted/60 motion-reduce:transition-none", state.turn === seat && "bg-muted", state.seat === seat && "ring-1 ring-foreground/40")}
            >
              <SeatLabel nickname={name} color={colors[seat]!} size="md" name="ink" className="min-w-0 flex-1 text-base leading-tight">
                {seat === 0 && <span className="shrink-0 text-muted-foreground">you</span>}
              </SeatLabel>
              {points > 0 && <span className="text-sm text-muted-foreground tabular-nums">+{points}</span>}
              <span className="text-lg leading-none font-strong tabular-nums">{(state.score.total[seat] ?? 0) + points}</span>
            </button>
          </li>
        )
      })}
    </ul>
  )
}

/** The newest line of the log across the top of the table, which changes with each event: a ticker, said to a screen reader politely */
export function Ticker({ line }: { line: string | undefined }) {
  if (!line) return null
  return (
    <p aria-live="polite" className="platform pointer-events-none absolute top-3 left-3 z-10 max-w-[calc(100%-15rem)] truncate rounded-full border glass px-4 py-1.5 font-sans text-sm text-foreground shadow-surface sm:max-w-[calc(100%-17rem)]">
      {line}
    </p>
  )
}
