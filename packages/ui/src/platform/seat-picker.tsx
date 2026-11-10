"use client"

import * as React from "react"
import { CrownIcon, PlusSignIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { RadioGroup as RadioGroupPrimitive } from "radix-ui"
import { cn } from "../utils"
import { Avatar, AvatarFallback } from "./avatar"
import { SeatAvatar } from "./table-card"

// The seats of a table that is about to be opened ("Create a table" on the signed-in home): the visitor in the first, with a crown, and a seat with a plus for each friend the table has room for. It is also how the number of players is set: a press on a seat sets the table for that
// many players, as a press on a star sets a rating, so the seats after it are put away (faint, with no plus until the pointer comes) and the ones before it are kept. The seats start at the least the game takes and go to the most. The table does not exist yet, so a seat has no one to invite
// and no link to copy: it is the room that the lobby fills once the table is open. The game is not always chosen: with no `range` there is the visitor's seat alone. The visitor and the page decide nothing here beyond the number: `onCountChange` is how the page keeps it.

type SeatPickerProps = Omit<React.ComponentProps<"section">, "children" | "onChange"> & {
  /** The visitor who opens the table, in the first seat: their name (which a screen reader reads) and their picture, the initials of their name when they have none. */
  host: { name: string; avatarUrl?: string | null }
  /** How many players the game takes, from its least to its most. None: the game is not chosen yet, and the visitor's seat is the only one. */
  range?: { min: number; max: number }
  /** How many players the table is set for. */
  count: number
  onCountChange: (count: number) => void
  /** The table is being opened: the number cannot be changed. */
  disabled?: boolean
}

function SeatPicker({ host, range, count, onCountChange, disabled = false, className, ...props }: SeatPickerProps) {
  const least = Math.max(1, range?.min ?? 1)
  const shown = range ? Math.min(range.max, Math.max(count, least)) : 1
  const you = <SeatAvatar seat={{ name: host.name, avatarUrl: host.avatarUrl, host: true }} card={false} className="size-12" />
  return (
    <section data-slot="seat-picker" className={cn("flex flex-col gap-3", className)} {...props}>
      <h3 className="text-sm text-muted-foreground">Players</h3>
      <RadioGroupPrimitive.Root
        aria-label="Number of players"
        value={String(shown)}
        onValueChange={(next) => onCountChange(Number(next))}
        disabled={disabled || !range}
        className="flex flex-wrap gap-y-4"
      >
        {Array.from({ length: range?.max ?? 1 }, (_, index) => {
          const number = index + 1
          const taken = number === 1
          const kept = number <= shown
          // The seats under the game's least players are always there: the visitor's, and the ones that a game of more than two needs
          const fixed = number < least
          const seat = (
            <>
              <span className="relative">
                {taken && <HugeiconsIcon icon={CrownIcon} strokeWidth={2} aria-hidden="true" className="absolute -top-3 left-1/2 z-10 size-4 -translate-x-1/2" />}
                {taken ? (
                  you
                ) : (
                  <Avatar className="size-12 transition-shadow duration-fast after:hidden group-focus-visible/seat:ring-3 group-focus-visible/seat:ring-ring/30">
                    <AvatarFallback
                      className={cn(
                        "border border-dashed bg-transparent transition-colors duration-fast",
                        kept ? "border-border text-muted-foreground group-hover/seat:border-foreground/50 group-hover/seat:text-foreground" : "border-border/40 text-transparent group-hover/seat:border-foreground/30 group-hover/seat:text-muted-foreground",
                      )}
                    >
                      <HugeiconsIcon icon={PlusSignIcon} strokeWidth={2} aria-hidden="true" className="size-3.5" />
                    </AvatarFallback>
                  </Avatar>
                )}
              </span>
              <span className={cn("w-13 min-h-4 truncate text-center text-xs", taken ? "ph-mask text-foreground" : "text-muted-foreground")}>{taken ? "You" : kept ? "Open" : ""}</span>
            </>
          )
          return fixed ? (
            <div key={number} className="flex w-14 flex-col items-center gap-1.5">
              {seat}
            </div>
          ) : (
            <RadioGroupPrimitive.Item key={number} value={String(number)} aria-label={`${number} players`} className="group/seat flex w-14 cursor-pointer flex-col items-center gap-1.5 outline-none disabled:cursor-default">
              {seat}
            </RadioGroupPrimitive.Item>
          )
        })}
      </RadioGroupPrimitive.Root>
    </section>
  )
}

export { SeatPicker }
export type { SeatPickerProps }
