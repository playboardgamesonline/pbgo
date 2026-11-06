import * as React from "react"
import { CrownIcon, UserMultipleIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { cn } from "../utils"
import { hostOf, seatCount, type TableAction, type TableSeat, type TableState } from "../tables"
import { OpenSeat } from "./open-seat"
import { SeatAvatar } from "./table-card"

// A table in the list of the open tables of a game, as a block of three lines. On the first, how many sit at it of how many it has (a small picture of people, then "3/5"), who opened it ("Hosted by Marly") and how old it is. On the second, what to know before sitting down
// ("Fast turns · First expansion"): the speed when it is not the usual one, then the expansions, and no line at all when there is nothing to say. On the third, a circle for each seat of the table, all of them, none over another, so that the room that is left is seen at once: a picture and
// the nickname under it for a person, a crown on the one who opened it, and for a seat nobody has taken a dashed circle with a plus in it, which does what the seat is for (`OpenSeat`: it joins the table, or, at the table the visitor sits at, opens a menu to invite a friend or copy the
// link). The pictures are large and close together (48px, eight apart). The pointer finds a player's card on their picture, and a press on the row picks it, which the page shows by the panel beside the list (`LobbyDetail`). Like `TableCard` it draws what it is given and decides nothing: the
// page keeps which row is picked. It is not a client component: a row with no `onSelect` (a list that is only read) is drawn on the server, and then has no handler at all.

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
  /** What a free seat does instead of leading to the table's page, for a page that sits the visitor down itself: a button in place of the link. */
  onJoin?: () => void
  /** What is done once the visitor has copied the table's link from the menu of a free seat (`mine`): a page counts it. */
  onCopyInvite?: () => void
  /** Whether the visitor sits at this table: a free seat then opens the menu to invite someone, instead of joining it. */
  mine?: boolean
  /** Whether the visitor opened it: the row then says "Hosted by you". */
  hostedByYou?: boolean
  /** Whether it is the row whose details are shown. */
  selected?: boolean
  /** What a press on the row does: pick it, or put it down when it is already picked. */
  onSelect?: () => void
  /** The id of what the row controls, the panel that shows the details. */
  controls?: string
}

function TableEntry({ className, state, seats, age, facts = [], action, href, onJoin, onCopyInvite, mine = false, hostedByYou = false, selected = false, onSelect, controls, ...props }: TableEntryProps) {
  const { taken, total } = seatCount(seats)
  const host = hostedByYou ? "you" : (hostOf(seats) ?? "a player who left")
  const full = action === "full"
  const firstFree = seats.indexOf(null)
  const join = !mine && (href || onJoin) && action === "join" ? { href, onJoin } : undefined
  const invite = mine && href ? { link: href, onCopy: onCopyInvite } : undefined
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
        className="flex w-full min-w-0 flex-col gap-1 rounded-t-[inherit] px-4 pt-4 text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/30 focus-visible:ring-inset"
      >
        {/* What the row says, once, for screen readers: the seats under it name everybody and are read as they are */}
        <span className="ph-mask sr-only">
          {`Table hosted by ${host}, ${taken} of ${total} seats taken${facts.length > 0 ? `, ${facts.join(", ")}` : ""}. ${age}.`}
        </span>
        <span aria-hidden="true" className="flex w-full min-w-0 items-center gap-3">
          <span data-slot="table-entry-count" className="inline-flex shrink-0 items-center gap-1.5 text-muted-foreground tabular-nums">
            <HugeiconsIcon icon={UserMultipleIcon} strokeWidth={2} className="size-4" />
            {taken}/{total}
          </span>
          <span className="min-w-0 truncate">
            <span className="text-muted-foreground">Hosted by </span>
            <span className="ph-mask">{host}</span>
          </span>
          <span data-slot="table-entry-age" className="ml-auto shrink-0 text-sm text-muted-foreground">
            {full && "Full · "}
            {age}
          </span>
        </span>
        {facts.length > 0 && (
          <span aria-hidden="true" data-slot="table-entry-facts" className="truncate text-sm text-muted-foreground">
            {facts.join(" · ")}
          </span>
        )}
      </button>
      {/* A seat is a column 56px wide round a picture of 48px and a name of 52px: no room between the columns, so that the pictures are 8px apart and the names under them 4px, as the comment above says */}
      <ul data-slot="table-entry-seats" aria-label="Seats" className="flex flex-wrap gap-y-4 px-4 pt-7 pb-4">
        {seats.map((seat, index) => (
          <li key={index} data-slot="table-entry-seat" data-free={seat ? undefined : ""} className="flex w-14 flex-col items-center gap-1.5">
            <span className="relative">
              {seat?.host && <HugeiconsIcon icon={CrownIcon} strokeWidth={2} aria-hidden="true" className="absolute -top-3 left-1/2 z-10 size-4 -translate-x-1/2" />}
              {seat ? <SeatAvatar seat={seat} className="size-12" /> : <OpenSeat join={join} invite={invite} tabbable={index === firstFree} className="size-12" />}
            </span>
            <span className={cn("w-13 truncate text-center text-xs", seat ? "ph-mask" : "text-muted-foreground")}>{seat ? seat.name : word}</span>
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
