"use client"

import * as React from "react"
import { cn } from "../utils"
import { fitSeats, type TableSeat } from "../tables"
import { Label } from "./label"
import { LobbySeats } from "./lobby-seats"
import type { OpenSeatProps } from "./open-seat"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./select"

// The number of players of a lobby and its seats, for the visitor who sets the lobby: a row that says "Number of players" with a select, and under it the seats, as many as the number says, five to a row (`LobbySeats`). The select goes from the game's least players to its most
// (`range`, `playerRange` of `@pbgo/ui/tables`) and never under the people who already sit, who are never dropped; a number that is more than the table has adds free seats, and a number that is less takes the free ones away. A table that is only read (one of the list) has no select and
// draws its seats as they are, and the space that opens a lobby, which has no table yet, has the select alone. Nothing is kept yet (the tables of PLT-13), so what is set stays in the page; `onCountChange` is for the page that has somewhere to put it.

type LobbyPlayersProps = Omit<React.ComponentProps<"div">, "children"> & {
  /** The seats of the table, as the page has them. None: there is no table yet, and no seats are drawn. */
  seats?: readonly TableSeat[]
  /** How many players the lobby may be set for. None: the visitor does not set it, and the seats are drawn as they are. */
  range?: { min: number; max: number }
  /** The number it starts at: the table's own seats, or the game's most for a lobby that is about to be opened. */
  defaultCount?: number
  /** What the plus of a free seat does for a visitor who is not at the table: it joins it (`OpenSeat`). */
  join?: OpenSeatProps["join"]
  /** What the plus of a free seat does for a visitor who is at it: it opens the menu that invites a friend or copies the link. */
  invite?: OpenSeatProps["invite"]
  onCountChange?: (count: number) => void
}

function LobbyPlayers({ seats, range, defaultCount, join, invite, onCountChange, className, ...props }: LobbyPlayersProps) {
  const selectId = React.useId()
  const seated = seats ? seats.filter((seat) => seat !== null).length : 0
  const [count, setCount] = React.useState(defaultCount ?? seats?.length ?? range?.max ?? 0)
  // The people who sit are never dropped, so the number is never under them
  const least = Math.max(range?.min ?? 1, seated)
  const shown = Math.min(range?.max ?? Infinity, Math.max(count, least))
  const numbers = range ? Array.from({ length: Math.max(0, range.max - least + 1) }, (_, index) => least + index) : []
  return (
    <div data-slot="lobby-players" className={cn("flex flex-col gap-5", className)} {...props}>
      {range && (
        <div className="flex items-center justify-between gap-3">
          <Label htmlFor={selectId} className="text-muted-foreground">
            Number of players
          </Label>
          <Select
            value={String(shown)}
            onValueChange={(next) => {
              setCount(Number(next))
              onCountChange?.(Number(next))
            }}
          >
            <SelectTrigger id={selectId} className="w-20">
              <SelectValue />
            </SelectTrigger>
            <SelectContent align="end">
              {numbers.map((number) => (
                <SelectItem key={number} value={String(number)}>
                  {number}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      {seats && <LobbySeats seats={range ? fitSeats(seats, shown) : seats} join={join} invite={invite} />}
    </div>
  )
}

export { LobbyPlayers }
export type { LobbyPlayersProps }
