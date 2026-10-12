"use client"

import { CheckIcon, ChevronDownIcon } from "lucide-react"
import { useId, useState } from "react"
import { cn } from "@pbgo/ui/utils"
import type { PendingSeat, PendingSeats } from "../../lib/pending-seats"
import { HUD_TEXT, HUD_TRANSITION, PlayerDot } from "./hud-ui"

export type StripSeat = PendingSeat & { /** The player's color on the board */ color: string }
export type StripData = Omit<PendingSeats, "seats"> & { seats: StripSeat[] }
export type StripLabels = {
  /** Accessible name of the list */
  players: string
  /** "3/5 ready", for the collapsed strip */
  ready: string
  done: string
  waiting: string
  away: string
  /** Marks the viewer's own seat */
  you: string
}

/** One seat: color dot and name; the game still waits for it (full contrast), it is done (muted, ✓) or away (dimmed) */
function SeatChip({ seat, labels }: { seat: StripSeat; labels: StripLabels }) {
  const state = !seat.waiting ? labels.done : seat.away ? labels.away : labels.waiting
  return (
    <span
      title={`${seat.nickname} · ${state}`}
      className={cn(
        "inline-flex max-w-36 min-w-0 items-center gap-1.5 text-sm short:text-xs",
        seat.waiting ? "text-hud-foreground" : "text-hud-muted",
        seat.waiting && seat.away && "opacity-50",
      )}
    >
      <PlayerDot color={seat.color} />
      <span className="truncate">{seat.nickname}</span>
      {seat.me && <span className="shrink-0 text-hud-muted">{labels.you}</span>}
      {!seat.waiting && <CheckIcon aria-hidden className="size-3.5 shrink-0" />}
      <span className="sr-only">{state}</span>
    </span>
  )
}

/** Beyond `STRIP_MAX_SEATS` seats: "n/N ready", and the full list while hovered (mouse) or once tapped */
function CollapsedStrip({ strip, labels, defaultOpen }: { strip: StripData; labels: StripLabels; defaultOpen: boolean }) {
  const [pinned, setPinned] = useState(defaultOpen)
  const [hovered, setHovered] = useState(false)
  const open = pinned || hovered
  const listId = useId()
  return (
    <div
      className="flex flex-col items-end"
      onPointerEnter={(e) => e.pointerType === "mouse" && setHovered(true)}
      onPointerLeave={(e) => e.pointerType === "mouse" && setHovered(false)}
    >
      <button
        type="button"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        onClick={() => setPinned((p) => !p)}
        className={cn(HUD_TRANSITION, "inline-flex cursor-pointer items-center gap-1 text-sm text-hud-muted hover:text-hud-foreground short:text-xs")}
      >
        {labels.ready}
        <ChevronDownIcon aria-hidden className={cn("size-3.5 transition-transform duration-fast ease-standard motion-reduce:transition-none", open && "rotate-180")} />
      </button>
      {open && (
        <ul id={listId} aria-label={labels.players} className="mt-1.5 flex max-h-40 flex-col items-end gap-1 overflow-y-auto pr-1 short:max-h-24">
          {strip.seats.map((seat) => (
            <li key={seat.id} className="flex">
              <SeatChip seat={seat} labels={labels} />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/**
 * Seat by seat, who a simultaneous step still waits for. Pure presentation, no game context: `PlayersStrip` feeds it from the
 * game, `/design` with samples. Up to 8 seats every player is a chip, beyond that it collapses to "n/N ready"
 * (`defaultOpen`: with the full list already showing, as `/design` draws it).
 */
export function PlayersStripView({ strip, labels, className, defaultOpen = false }: { strip: StripData; labels: StripLabels; className?: string; defaultOpen?: boolean }) {
  return (
    <div className={cn(HUD_TEXT, className)}>
      {strip.collapsed ? (
        <CollapsedStrip strip={strip} labels={labels} defaultOpen={defaultOpen} />
      ) : (
        <ul aria-label={labels.players} className="flex flex-wrap justify-end gap-x-3 gap-y-1 short:gap-x-2">
          {strip.seats.map((seat) => (
            <li key={seat.id} className="flex min-w-0">
              <SeatChip seat={seat} labels={labels} />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
