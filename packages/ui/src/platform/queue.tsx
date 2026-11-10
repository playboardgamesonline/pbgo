"use client"

import * as React from "react"
import { Cancel01Icon, Loading03Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { queueTime } from "../queue"
import { cn } from "../utils"
import { Button } from "./button"

// What a visitor sees while they look for a table, the same wait in three places: the button that starts the search (the main one of a game's page, the smaller one of the signed-in home), which becomes a counter with a cross that stops the search (`QueueButton`), the card at the top of the social panel
// (`QueueCard`, which also says how full the nearest table is) and, while the panel is closed, a small pill in the bar of the dock (`QueuePill`). Each is drawn from what it is given, the time waited in whole seconds, and decides nothing: where the queue is kept and what
// stopping it does are the page's (`apps/web/src/lib/matchmaking.ts`). The counter is a `timer`, which a screen reader reads when asked and never announces each second; what is announced is that a search began or stopped.

/** The time waited as a counter, in figures of one width so that the digits do not shift as they change. */
function QueueTimer({ seconds, className }: { seconds: number; className?: string }) {
  return (
    <span role="timer" className={cn("tabular-nums", className)}>
      {queueTime(seconds)}
    </span>
  )
}

/** What a screen reader hears of a search: "Searching for a table of Courtisans and Flip 7 (ranked)". */
function searchingFor(game: string, mode?: string): string {
  return `Searching for a table of ${game}${mode ? ` (${mode.toLowerCase()})` : ""}`
}

/** The turning ring that says a search is on. It says nothing to a screen reader: the group around it does. */
function Searching({ className }: { className?: string }) {
  return <HugeiconsIcon icon={Loading03Icon} strokeWidth={2} aria-hidden="true" className={cn("size-4 shrink-0 animate-spin", className)} />
}

/** What the two sizes of the button change while it counts: the box (the width is the idle button's least, so that nothing moves) and the cross inside it. */
const SEARCH_SIZES = {
  xl: { idle: "min-w-40", box: "h-12 w-40 text-base", stop: "mr-1.5 size-9" },
  lg: { idle: "min-w-36", box: "h-10 w-36 text-sm", stop: "mr-1 size-8" },
}

type QueueButtonProps = Omit<React.ComponentProps<typeof Button>, "variant" | "size" | "asChild" | "onClick"> & {
  /** `xl` (the default) is the main button of a game's page; `lg` is the smaller one of the signed-in home. */
  size?: keyof typeof SEARCH_SIZES
  /** How the button looks while it waits for a press: the main way to play is filled, a second one is `secondary`. The counter that it becomes is the same fill either way. */
  variant?: "default" | "secondary"
  /** Whether the visitor looks for a table through this button's search. */
  searching: boolean
  /** How long they have, in whole seconds. */
  seconds: number
  /** What the button does while it is "Play ranked": starts the search. */
  onSearch: () => void
  /** What the cross does: stops it. */
  onCancel: () => void
}

/**
 * The button that starts a search, "Play ranked" or "Play normal" (its children: a play icon and its name). A press starts the search and the button becomes, in the same place and at the same width so that nothing next to it moves,
 * a counter of the time waited with a cross that stops it, on the same fill; the cross takes the focus when it was the keyboard that pressed, and the button takes it back when the cross was pressed. A disabled button is
 * the one of a game that cannot be played yet, or of a search with no game picked, and has no counter.
 */
function QueueButton({ size = "xl", variant = "default", searching, seconds, onSearch, onCancel, className, children, disabled, ...props }: QueueButtonProps) {
  const find = React.useRef<HTMLButtonElement>(null)
  const stop = React.useRef<HTMLButtonElement>(null)
  // Which way the focus goes when the button changes: only when it is this button that was pressed, not when the search was stopped from elsewhere (the social panel)
  const pressed = React.useRef(false)

  React.useEffect(() => {
    if (!pressed.current) return
    pressed.current = false
    ;(searching ? stop.current : find.current)?.focus()
  }, [searching])

  if (searching) {
    return (
      <div data-slot="queue-button" role="group" aria-label="Searching for a table" className={cn("inline-flex items-center rounded-xl bg-primary text-primary-foreground", SEARCH_SIZES[size].box, className)}>
        <span className="flex flex-1 items-center justify-center gap-2.5 pl-3">
          <Searching />
          <QueueTimer seconds={seconds} />
        </span>
        <button
          ref={stop}
          type="button"
          aria-label="Stop searching"
          title="Stop searching"
          onClick={() => {
            pressed.current = true
            onCancel()
          }}
          className={cn("flex shrink-0 items-center justify-center rounded-lg outline-none hover:bg-primary-foreground/10 focus-visible:ring-3 focus-visible:ring-primary-foreground/40", SEARCH_SIZES[size].stop)}
        >
          <HugeiconsIcon icon={Cancel01Icon} strokeWidth={2} aria-hidden="true" className="size-4" />
        </button>
      </div>
    )
  }

  return (
    <Button
      ref={find}
      type="button"
      variant={variant}
      size={size}
      disabled={disabled}
      className={cn("justify-center", SEARCH_SIZES[size].idle, className)}
      onClick={() => {
        pressed.current = true
        onSearch()
      }}
      {...props}
    >
      {children}
    </Button>
  )
}

type QueueCardProps = Omit<React.ComponentProps<"div">, "children"> & {
  /** The games they look for, in a few words ("Courtisans", "Courtisans and Flip 7"). */
  game: string
  /** What kind of table they look for, as the screens call it ("Ranked", "Normal"): said before the games. None: the search has no kind to tell. */
  mode?: string
  /** How many sit at the table of the search that is the nearest to beginning, of those it is set for: said after the games. None: the search has sat them nowhere yet. */
  progress?: { players: number; seats: number } | null
  seconds: number
  onCancel: () => void
}

/** The search as the social panel has it, at the top, over the tabs: what it is, which games and what kind of table, how full the nearest table is, the time waited, and the cross that stops it. */
function QueueCard({ game, mode, progress, seconds, onCancel, className, ...props }: QueueCardProps) {
  return (
    <div data-slot="queue-card" role="group" aria-label={searchingFor(game, mode)} className={cn("flex items-center gap-3 rounded-2xl bg-input/50 py-2 pr-2 pl-4", className)} {...props}>
      <Searching className="size-5 text-muted-foreground" />
      <div className="flex min-w-0 flex-1 flex-col">
        <p className="text-sm text-foreground">Looking for a table</p>
        <p className="truncate text-xs text-muted-foreground">{[mode, game, progress ? `${progress.players}/${progress.seats}` : null].filter((part) => part).join(" · ")}</p>
      </div>
      <QueueTimer seconds={seconds} className="text-sm text-muted-foreground" />
      <Button type="button" variant="ghost" size="icon-sm" aria-label="Stop searching" title="Stop searching" onClick={onCancel}>
        <HugeiconsIcon icon={Cancel01Icon} strokeWidth={2} aria-hidden="true" />
      </Button>
    </div>
  )
}

type QueuePillProps = Omit<React.ComponentProps<"div">, "children"> & {
  game: string
  mode?: string
  /** How many sit at the table of the search that is the nearest to beginning, of those it is set for: said on hover. */
  progress?: { players: number; seats: number } | null
  seconds: number
  onCancel: () => void
}

/** The search as the bar of the dock has it while the panel is closed: a small pill with the ring, the time and the cross, which says which games and what kind of table, and how full the nearest table is, on hover. */
function QueuePill({ game, mode, progress, seconds, onCancel, className, ...props }: QueuePillProps) {
  return (
    <div
      data-slot="queue-pill"
      role="group"
      aria-label={searchingFor(game, mode)}
      title={`Looking for a table of ${game}${mode ? ` (${mode.toLowerCase()})` : ""}${progress ? `, ${progress.players}/${progress.seats} seated` : ""}`}
      className={cn("flex h-10 items-center gap-2 rounded-xl bg-input/50 pr-1 pl-3 text-sm", className)}
      {...props}
    >
      <Searching />
      <QueueTimer seconds={seconds} />
      <Button type="button" variant="ghost" size="icon-sm" aria-label="Stop searching" title="Stop searching" onClick={onCancel}>
        <HugeiconsIcon icon={Cancel01Icon} strokeWidth={2} aria-hidden="true" />
      </Button>
    </div>
  )
}

export { QueueButton, QueueCard, QueuePill }
export type { QueueButtonProps, QueueCardProps, QueuePillProps }
