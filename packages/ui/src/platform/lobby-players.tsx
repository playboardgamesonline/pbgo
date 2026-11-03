"use client"

import * as React from "react"
import { cn } from "../utils"
import { fitSeats, seatCount, type TableSeat } from "../tables"
import { Label } from "./label"
import { LobbySeats } from "./lobby-seats"
import type { OpenSeatProps } from "./open-seat"
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "./select"

// The top of a table's panel and its seats. On the left of the top row, for the visitor who sets the lobby, "Number of players" and a select, from the game's least players to its most (`range`, `playerRange` of `@pbgo/ui/tables`) and never under the people who already
// sit, who are never dropped; for anybody else, a line of the same size that says who opened the table and how many sit at it of how many it has ("Table created by Marly (3/5)", `createdBy`). On its right, what the page puts there (`actions`: the button that says who may join, or
// the one that closes the details). Under the row, the seats, as many as the number says, five to a row (`LobbySeats`): a number that is more than the table has adds free seats and one that is less takes the free ones away (`fitSeats`). The space that opens a lobby has no table
// yet, so it has the row alone, the select, and no seats. Nothing is kept yet (the tables of PLT-13), so what is set stays in the page; `onCountChange` is for the page that has somewhere to put it.

type LobbyPlayersProps = Omit<React.ComponentProps<"div">, "children"> & {
  /** The seats of the table, as the page has them. None: there is no table yet, and no seats are drawn. */
  seats?: readonly TableSeat[]
  /** How many players the lobby may be set for. None: the visitor does not set the number, and the seats are drawn as they are. */
  range?: { min: number; max: number }
  /** The number it starts at: the table's own seats, or the game's most for a lobby that is about to be opened. */
  defaultCount?: number
  /** Who opened the table, as the line says it ("you", "Marly"). Drawn when the visitor does not set the number of players. */
  createdBy?: string
  /** What stands at the right of the top row: the button that says who may join, the one that closes the details. */
  actions?: React.ReactNode
  /** What the plus of a free seat does for a visitor who is not at the table: it joins it (`OpenSeat`). */
  join?: OpenSeatProps["join"]
  /** What the plus of a free seat does for a visitor who is at it: it opens the menu that invites a friend or copies the link. */
  invite?: OpenSeatProps["invite"]
  onCountChange?: (count: number) => void
}

function LobbyPlayers({ seats, range, defaultCount, createdBy, actions, join, invite, onCountChange, className, ...props }: LobbyPlayersProps) {
  const selectId = React.useId()
  const { taken, total } = seatCount(seats ?? [])
  const [count, setCount] = React.useState(defaultCount ?? seats?.length ?? range?.max ?? 0)
  // The people who sit are never dropped, so the number is never under them
  const least = Math.max(range?.min ?? 1, taken)
  const shown = Math.min(range?.max ?? Infinity, Math.max(count, least))
  const numbers = range ? Array.from({ length: Math.max(0, range.max - least + 1) }, (_, index) => least + index) : []
  const left = range ? (
    <div className="flex items-center gap-3">
      <Label htmlFor={selectId} className="text-base text-muted-foreground">
        Number of players
      </Label>
      <Select
        value={String(shown)}
        onValueChange={(next) => {
          setCount(Number(next))
          onCountChange?.(Number(next))
        }}
      >
        <SelectTrigger id={selectId}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent align="end" className="min-w-0">
          <SelectGroup>
            {numbers.map((number) => (
              <SelectItem key={number} value={String(number)}>
                {number}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </div>
  ) : createdBy && seats ? (
    <p className="min-w-0 truncate text-base text-muted-foreground">
      Table created by <span className="text-foreground">{createdBy}</span> ({taken}/{total})
    </p>
  ) : null
  return (
    <div data-slot="lobby-players" className={cn("flex flex-col gap-6", className)} {...props}>
      {(left || actions) && (
        <div className="flex min-h-9 items-center justify-between gap-3">
          {left ?? <span />}
          {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
        </div>
      )}
      {seats && <LobbySeats seats={range ? fitSeats(seats, shown) : seats} join={join} invite={invite} />}
    </div>
  )
}

export { LobbyPlayers }
export type { LobbyPlayersProps }
