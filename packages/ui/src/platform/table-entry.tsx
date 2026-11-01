import * as React from "react"
import { CrownIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { cn } from "../utils"
import { hostOf, seatCount, type TableAction, type TableSeat, type TableState } from "../tables"
import { OpenSeat } from "./open-seat"
import { SeatAvatar } from "./table-card"

// A table in the list of the open tables of a game, as a block of two lines. On the first, who opened it ("Hosted by Marly"), what to know before sitting down ("Fast turns · First expansion") and how old it is. On the second, a circle for each seat of the table,
// all of them, none over another, so that the room that is left is seen at once: a picture and the nickname under it for a person, a crown on the one who opened it, and for a seat nobody has taken a dashed circle with a plus in it, which does what the seat
// is for (`OpenSeat`: it joins the table, or, at the table the visitor sits at, opens a menu to invite a friend or copy the link). The pointer finds a player's card on their picture (rating, record), and a press on the row shows the table's details beside the
// list (`LobbyDetail`). Like `TableCard` it draws what it is given and decides nothing: the page keeps which row is picked. It is not a client component: a row with no `onSelect` (a list that is only read) is drawn on the server, and then has no handler at all.

type TableEntryProps = Omit<React.ComponentProps<"li">, "children"> & {
  /** `waiting`: it waits for players. `playing`: it is being played. */
  state: TableState
  /** Every seat of the table in order, `null` for one nobody has taken. */
  seats: readonly TableSeat[]
  /** When it was opened, or how long it has been played: already formatted ("Opened 4 min ago"). */
  age: string
  /** What to know before sitting down ("Fast turns", "First expansion"), already formatted. */
  facts?: readonly string[]
  /** What a visitor may do: `join` makes the free seats a way in, `full` says there is none. None: nothing to do. */
  action?: TableAction | null
  /** The table's page: where a free seat leads, and the address that the invitation copies. */
  href?: string
  /** Whether the visitor sits at this table: a free seat then opens the menu to invite someone, instead of joining it. */
  mine?: boolean
  /** Whether it is the row whose details are shown. */
  selected?: boolean
  /** What a press on the row does: pick it, or put it down when it is already picked. */
  onSelect?: () => void
  /** The id of what the row controls, the panel that shows the details. */
  controls?: string
}

function TableEntry({ className, state, seats, age, facts = [], action, href, mine = false, selected = false, onSelect, controls, ...props }: TableEntryProps) {
  const { taken, total } = seatCount(seats)
  const host = hostOf(seats)
  const full = action === "full"
  const firstFree = seats.indexOf(null)
  const join = !mine && href && action === "join" ? { href } : undefined
  const invite = mine && href ? { link: href } : undefined
  const word = mine ? "Invite" : join ? "Join" : "Open"
  return (
    // A press on the row picks it, wherever it is but on a link or a button (a free seat is one, and what is portaled out of the row, a player's card or a menu, is not a press on it); the button of the first line is what the keyboard and screen readers reach
    <li
      data-slot="table-entry"
      data-state={state}
      data-selected={selected ? "" : undefined}
      {...props}
      onClick={
        onSelect &&
        ((event) => {
          const target = event.target as Element
          if (event.currentTarget.contains(target) && !target.closest("a, button")) onSelect()
        })
      }
      className={cn("group/entry rounded-2xl transition-colors duration-fast hover:bg-muted/50 data-[selected]:bg-muted", className)}
    >
      <button
        type="button"
        aria-pressed={selected}
        aria-controls={controls}
        onClick={onSelect}
        className="flex w-full min-w-0 items-baseline gap-3 rounded-t-[inherit] px-4 pt-4 text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/30 focus-visible:ring-inset"
      >
        {/* What the row says, once, for screen readers: the seats under it name everybody and are read as they are */}
        <span className="sr-only">
          {`Table hosted by ${host ?? "a player who left"}, ${taken} of ${total} seats taken${facts.length > 0 ? `, ${facts.join(", ")}` : ""}. ${age}.`}
        </span>
        <span aria-hidden="true" className="min-w-0 truncate">
          <span className="text-muted-foreground">Hosted by </span>
          {host ?? "a player who left"}
          {facts.length > 0 && <span className="text-sm text-muted-foreground"> · {facts.join(" · ")}</span>}
        </span>
        <span aria-hidden="true" data-slot="table-entry-age" className="ml-auto shrink-0 text-sm text-muted-foreground">
          {full && "Full · "}
          {age}
        </span>
      </button>
      <ul data-slot="table-entry-seats" aria-label="Seats" className="flex flex-wrap gap-x-3 gap-y-4 px-4 pt-7 pb-4">
        {seats.map((seat, index) => (
          <li key={index} data-slot="table-entry-seat" data-free={seat ? undefined : ""} className="flex w-16 flex-col items-center gap-1.5">
            <span className="relative">
              {seat?.host && <HugeiconsIcon icon={CrownIcon} strokeWidth={2} aria-hidden="true" className="absolute -top-3 left-1/2 z-10 size-4 -translate-x-1/2" />}
              {seat ? <SeatAvatar seat={seat} className="size-10" /> : <OpenSeat join={join} invite={invite} tabbable={index === firstFree} className="size-10" />}
            </span>
            <span className={cn("w-full truncate text-center text-xs", !seat && "text-muted-foreground")}>{seat ? seat.name : word}</span>
          </li>
        ))}
      </ul>
    </li>
  )
}

/** The rows, one under another, with a little room between: a row is a block that fills under the pointer. The list is the container the rows measure, so they follow the width of the column they sit in, not the window's. */
function TableEntries({ className, ...props }: React.ComponentProps<"ul">) {
  return <ul data-slot="table-entries" className={cn("@container flex flex-col gap-2", className)} {...props} />
}

export { TableEntries, TableEntry }
export type { TableEntryProps }
