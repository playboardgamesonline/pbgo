"use client"

import { CheckIcon, ChevronDownIcon } from "lucide-react"
import { useId, useState } from "react"
import { cn } from "@pbgo/ui/utils"
import type { PendingSeat, PendingSeats } from "../../lib/pending-seats"
import type { SeatTheme } from "../../lib/ui-theme"
import { SeatLabel } from "./seat-label"

export type StripSeat = PendingSeat & {
  /** The player's color on the board */
  color: string
  /** The account's picture (PLT-13); absent: the avatar is generated from the nickname and the color */
  imageUrl?: string | null
}
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

/** One seat: avatar and name; the game still waits for it (full contrast), it is done (muted, ✓) or away (dimmed) */
function SeatChip({ seat, labels, theme }: { seat: StripSeat; labels: StripLabels; theme?: SeatTheme }) {
  const state = !seat.waiting ? labels.done : seat.away ? labels.away : labels.waiting
  return (
    <span
      title={`${seat.nickname} · ${state}`}
      className={cn(
        "inline-flex max-w-36 min-w-0 items-center text-sm short:text-xs",
        seat.waiting ? "text-foreground" : "text-foreground/60",
        seat.waiting && seat.away && "opacity-50",
      )}
    >
      <SeatLabel nickname={seat.nickname} color={seat.color} imageUrl={seat.imageUrl} theme={theme} size="sm" name="ink" className="gap-1.5" avatarClassName={cn(!seat.waiting && "opacity-60")}>
        {seat.me && <span className="shrink-0 text-foreground/60">{labels.you}</span>}
        {!seat.waiting && <CheckIcon aria-hidden className="size-3.5 shrink-0" />}
      </SeatLabel>
      <span className="sr-only">{state}</span>
    </span>
  )
}

/** Beyond `STRIP_MAX_SEATS` seats: "n/N ready", and the full list while hovered (mouse) or once tapped */
function CollapsedStrip({ strip, labels, theme, defaultOpen }: { strip: StripData; labels: StripLabels; theme?: SeatTheme; defaultOpen: boolean }) {
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
        className="inline-flex cursor-pointer items-center gap-1 text-sm text-foreground/60 transition-colors duration-200 hover:text-foreground motion-reduce:transition-none short:text-xs"
      >
        {labels.ready}
        <ChevronDownIcon aria-hidden className={cn("size-3.5 transition-transform duration-200 motion-reduce:transition-none", open && "rotate-180")} />
      </button>
      {open && (
        <ul id={listId} aria-label={labels.players} className="mt-1.5 flex max-h-40 flex-col items-end gap-1 overflow-y-auto pr-1 short:max-h-24">
          {strip.seats.map((seat) => (
            <li key={seat.id} className="flex">
              <SeatChip seat={seat} labels={labels} theme={theme} />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/**
 * Seat by seat, who a simultaneous step still waits for, in the ticker's own look (it inherits the text color and shadow of the
 * banner it sits in), each seat as its seat label. Pure presentation, no game context: `PlayersStrip` feeds it from the game,
 * `/design` with samples (and the `theme` of the game shown). Up to 8 seats every player is a chip, beyond that it collapses to
 * "n/N ready" (`defaultOpen`: with the full list already showing, as `/design` draws it).
 */
export function PlayersStripView({
  strip,
  labels,
  theme,
  className,
  defaultOpen = false,
}: {
  strip: StripData
  labels: StripLabels
  /** Default: the seat theme of the game shown */
  theme?: SeatTheme
  className?: string
  defaultOpen?: boolean
}) {
  return (
    <div className={className}>
      {strip.collapsed ? (
        <CollapsedStrip strip={strip} labels={labels} theme={theme} defaultOpen={defaultOpen} />
      ) : (
        <ul aria-label={labels.players} className="flex flex-wrap justify-end gap-x-3 gap-y-1 short:gap-x-2">
          {strip.seats.map((seat) => (
            <li key={seat.id} className="flex min-w-0">
              <SeatChip seat={seat} labels={labels} theme={theme} />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
