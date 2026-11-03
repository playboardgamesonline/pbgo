import * as React from "react"
import { CrownIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { cn } from "../utils"
import type { TableSeat } from "../tables"
import { OpenSeat, type OpenSeatProps } from "./open-seat"
import { SeatAvatar } from "./table-card"

/** The picture of a seat fills its column, a fifth of the panel less the room between the seats, up to 72px: the people are large and close together, as in a row of the list, with 4px between them. */
const SEAT_PICTURE = "size-auto w-full aspect-square"

/**
 * The people of a lobby, five to a row, as many seats as the table was set for (at most three rows, fifteen, and one row for a table of five or fewer): the picture of each player with their name under it (cut with an ellipsis when it does not fit), a crown over the one who opened the table, and, for each seat
 * nobody has taken, a dashed place with a plus in it that does what the seat is for (`OpenSeat`: it joins the table, or, at the table the visitor sits at, opens a menu to invite a friend or copy the link) and, under it, what it does. They are the blocks of a row of the list
 * (`TableEntry`), larger: each picture fills its column, a fifth of the panel's width less 4px between them, and is never more than 72px. The pointer finds a player's card on their picture, which says the rest (rank, record). A table of two or three has its seats at the left, in the columns of a table of five.
 */
function LobbySeats({ seats, join, invite, className, ...props }: Omit<React.ComponentProps<"ul">, "children"> & { seats: readonly TableSeat[]; join?: OpenSeatProps["join"]; invite?: OpenSeatProps["invite"] }) {
  const firstFree = seats.indexOf(null)
  const word = invite ? "Invite" : join ? "Join" : "Open"
  return (
    <ul data-slot="lobby-seats" aria-label="Players" className={cn("grid grid-cols-5 gap-x-1 gap-y-5", className)} {...props}>
      {seats.map((seat, index) => (
        <li key={index} data-slot="lobby-seat" data-free={seat ? undefined : ""} className="flex min-w-0 flex-col items-center gap-2">
          {/* The link or the button of a free seat is made as wide as the column too, for its circle to fill it */}
          <span className="relative mx-auto block w-full max-w-18 [&>a]:w-full [&>button]:w-full">
            {seat?.host && <HugeiconsIcon icon={CrownIcon} strokeWidth={2} aria-hidden="true" className="absolute -top-3.5 left-1/2 z-10 size-5 -translate-x-1/2" />}
            {seat ? <SeatAvatar seat={seat} className={SEAT_PICTURE} /> : <OpenSeat join={join} invite={invite} tabbable={index === firstFree} className={SEAT_PICTURE} />}
          </span>
          <span className={cn("w-full truncate text-center text-xs @md:text-sm", !seat && "text-muted-foreground")}>
            {seat?.host && <span className="sr-only">Host: </span>}
            {seat ? seat.name : word}
          </span>
        </li>
      ))}
    </ul>
  )
}

export { LobbySeats }
