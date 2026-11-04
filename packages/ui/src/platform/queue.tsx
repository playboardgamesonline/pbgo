"use client"

import * as React from "react"
import { Cancel01Icon, Loading03Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { queueTime } from "../queue"
import { cn } from "../utils"
import { Button } from "./button"

// What a visitor sees while they look for a table, the same wait in three places: the button of a game's page, which becomes a counter with a cross that stops the search (`QueueButton`), the card at the top of the social panel
// (`QueueCard`) and, while the panel is closed, a small pill in the bar of the dock (`QueuePill`). Each is drawn from what it is given, the time waited in whole seconds, and decides nothing: where the queue is kept and what
// stopping it does are the page's (`apps/web/src/lib/matchmaking.ts`). The counter is a `timer`, which a screen reader reads when asked and never announces each second; what is announced is that a search began or stopped.

/** The time waited as a counter, in figures of one width so that the digits do not shift as they change. */
function QueueTimer({ seconds, className }: { seconds: number; className?: string }) {
  return (
    <span role="timer" className={cn("tabular-nums", className)}>
      {queueTime(seconds)}
    </span>
  )
}

/** The turning ring that says a search is on. It says nothing to a screen reader: the group around it does. */
function Searching({ className }: { className?: string }) {
  return <HugeiconsIcon icon={Loading03Icon} strokeWidth={2} aria-hidden="true" className={cn("size-4 shrink-0 animate-spin", className)} />
}

type QueueButtonProps = Omit<React.ComponentProps<typeof Button>, "variant" | "size" | "asChild" | "onClick"> & {
  /** Whether the visitor looks for a table of this button's game. */
  searching: boolean
  /** How long they have, in whole seconds. */
  seconds: number
  /** What the button does while it is "Find a table": starts the search. */
  onSearch: () => void
  /** What the cross does: stops it. */
  onCancel: () => void
}

/**
 * The main button of a game's page, "Find a table" (its children, with no icon). A press starts the search and the button becomes, in the same place and at the same width so that nothing next to it moves,
 * a counter of the time waited with a cross that stops it, on the same fill; the cross takes the focus when it was the keyboard that pressed, and the button takes it back when the cross was pressed. A disabled button is
 * the one of a game that cannot be played yet, and has no counter.
 */
function QueueButton({ searching, seconds, onSearch, onCancel, className, children, disabled, ...props }: QueueButtonProps) {
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
      <div data-slot="queue-button" role="group" aria-label="Searching for a table" className={cn("inline-flex h-12 w-40 items-center rounded-xl bg-primary text-base text-primary-foreground", className)}>
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
          className="mr-1.5 flex size-9 shrink-0 items-center justify-center rounded-lg outline-none hover:bg-primary-foreground/10 focus-visible:ring-3 focus-visible:ring-primary-foreground/40"
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
      size="xl"
      disabled={disabled}
      className={cn("min-w-40 justify-center", className)}
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
  /** The name of the game they look for. */
  game: string
  seconds: number
  onCancel: () => void
}

/** The search as the social panel has it, at the top, over the tabs: what it is, which game, the time waited, and the cross that stops it. */
function QueueCard({ game, seconds, onCancel, className, ...props }: QueueCardProps) {
  return (
    <div data-slot="queue-card" role="group" aria-label={`Searching for a table of ${game}`} className={cn("flex items-center gap-3 rounded-2xl bg-input/50 py-2 pr-2 pl-4", className)} {...props}>
      <Searching className="size-5 text-muted-foreground" />
      <div className="flex min-w-0 flex-1 flex-col">
        <p className="text-sm text-foreground">Looking for a table</p>
        <p className="truncate text-xs text-muted-foreground">{game}</p>
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
  seconds: number
  onCancel: () => void
}

/** The search as the bar of the dock has it while the panel is closed: a small pill with the ring, the time and the cross, which says which game on hover. */
function QueuePill({ game, seconds, onCancel, className, ...props }: QueuePillProps) {
  return (
    <div
      data-slot="queue-pill"
      role="group"
      aria-label={`Searching for a table of ${game}`}
      title={`Looking for a table of ${game}`}
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
