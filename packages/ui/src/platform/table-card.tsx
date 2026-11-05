import * as React from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import { ArrowRight01Icon, Clock01Icon, PlayIcon, PlusSignIcon } from "@hugeicons/core-free-icons"
import { cn } from "../utils"
import { initials } from "../friends"
import { namesOf, seatCount, type TableAction, type TableSeat, type TableState } from "../tables"
import { Avatar, AvatarFallback, AvatarImage } from "./avatar"
import { Badge } from "./badge"
import { Button } from "./button"
import { HoverCard, HoverCardContent, HoverCardTrigger } from "./hover-card"
import { UserCard } from "./user-card"

// A table of a game, as the hub lists it: who sits at it, whether it waits for players or is being played, how old it is, and the way in (join it). It is drawn from what it is given and decides nothing: which
// tables there are, in which order, and what a visitor may do at each one is the page's (`@pbgo/ui/tables` has the words and the rule, the hub's `game-activity-props.ts` applies them). It sits on a game's page, on the home's
// "Tables in progress" and on the page of the tables.

type TableCardProps = Omit<React.ComponentProps<"article">, "title" | "children"> & {
  /** `default`, or `sm`: the card tightened for a column that holds several, like the one beside the zone that creates a game. */
  size?: "default" | "sm"
  /** `waiting`: it waits for players. `playing`: it is being played. */
  state: TableState
  /** What the table is called ("Alex's table"). */
  title: string
  /** Every seat of the table in order, `null` for one nobody has taken. */
  seats: readonly TableSeat[]
  /** When it was opened, or how long it has been played: already formatted ("Opened 4 min ago"), the card does not know the visitor's language. */
  age: string
  /** What to know before sitting down ("Ranked", "Fast turns"), already formatted. */
  facts?: readonly string[]
  /** What a visitor may do: `join` is a button that leads to `href`, `full` a disabled one. None: nothing to do, the card is only read. */
  action?: TableAction | null
  /** The table's page: where `join` leads. It is a plain link, the table being another site that a visitor loads whole. */
  href?: string
  /** The game the table is of, for a list of tables of several games. A game's own page leaves it out. */
  game?: { name: string; icon?: string }
}

/** The word on the button that leads into the table. */
const WAYS = { join: "Join" } as const

/**
 * The picture of one seat: the person in it (their picture, the initials of their name when they have none), or a dashed place for a seat nobody has taken. Only the picture of a person is a circle, and a seat is the place of one.
 * Under the pointer the picture of a person opens their card (`UserCard`: name and tag, rank, record), unless `card` is false. The name is for the page to say: this draws the picture alone.
 */
function SeatAvatar({ seat, className, card = true }: { seat: TableSeat; className?: string; card?: boolean }) {
  if (!seat) {
    return (
      <Avatar className={cn("after:hidden", className)}>
        <AvatarFallback className="border border-dashed border-border bg-transparent text-muted-foreground">
          <HugeiconsIcon icon={PlusSignIcon} strokeWidth={2} className="size-3.5" aria-hidden="true" />
        </AvatarFallback>
      </Avatar>
    )
  }
  const picture = (
    <Avatar className={className}>
      {seat.avatarUrl && <AvatarImage src={seat.avatarUrl} alt="" />}
      <AvatarFallback>{initials(seat.name)}</AvatarFallback>
    </Avatar>
  )
  if (!card) return picture
  return (
    <HoverCard>
      <HoverCardTrigger asChild>{picture}</HoverCardTrigger>
      <HoverCardContent>
        <UserCard player={seat} />
      </HoverCardContent>
    </HoverCard>
  )
}

/**
 * The seats of a table: a picture (or the initials) for each player, and a dashed place for each seat nobody has taken. The names are for screen readers, and the pointer finds a player's card on their picture; `TableCard` says the names in words under the seats.
 */
function TableSeats({ seats, className, ...props }: Omit<React.ComponentProps<"ul">, "children"> & { seats: readonly TableSeat[] }) {
  return (
    <ul data-slot="table-seats" aria-label="Seats" className={cn("flex flex-wrap items-center gap-1.5", className)} {...props}>
      {seats.map((seat, index) => (
        <li key={index} data-slot="table-seat" data-free={seat ? undefined : ""}>
          <SeatAvatar seat={seat} />
          <span className="sr-only">{seat ? seat.name : "Free seat"}</span>
        </li>
      ))}
    </ul>
  )
}

/**
 * One table. From the top: whether it waits or is played and how old it is, its name (and what to know before sitting down), its seats, then who is at it in words and the button that leads in. The card is a surface of the platform
 * and rises under the pointer when it leads somewhere; the button is the one link, stretched over the whole card so that the card is its target (a button inside a link, or a link inside a button, would not be valid).
 */
function TableCard({ className, size = "default", state, title, seats, age, facts = [], action, href, game, ...props }: TableCardProps) {
  const titleId = React.useId()
  const { taken, total } = seatCount(seats)
  const waiting = state === "waiting"
  const way = href && action === "join" ? WAYS.join : null
  const names = namesOf(seats)
  return (
    <article
      data-slot="table-card"
      data-state={state}
      data-size={size}
      aria-labelledby={titleId}
      className={cn(
        "group/table-card relative flex flex-col gap-4 overflow-hidden rounded-4xl bg-card p-5 text-card-foreground data-[size=sm]:gap-3 data-[size=sm]:p-4 shadow-surface ring-1 ring-foreground/10 transition-[box-shadow,background-color] has-focus-visible:ring-3 has-focus-visible:ring-ring/30",
        way && "hover:bg-secondary hover:shadow-float hover:ring-foreground/20",
        className
      )}
      {...props}
    >
      <div className="flex items-center justify-between gap-3">
        <Badge variant={waiting ? "outline" : "secondary"} data-slot="table-card-state">
          <HugeiconsIcon icon={waiting ? Clock01Icon : PlayIcon} strokeWidth={2} data-icon="inline-start" aria-hidden="true" />
          {waiting ? "Waiting" : "Playing"}
        </Badge>
        <span data-slot="table-card-age" className="truncate text-sm text-muted-foreground">
          {age}
        </span>
      </div>

      <div className="flex min-w-0 flex-col gap-1">
        {game && (
          <span data-slot="table-card-game" className="flex items-center gap-2 text-sm text-muted-foreground">
            {game.icon && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={game.icon} alt="" loading="lazy" decoding="async" className="size-5 shrink-0 rounded-md bg-muted object-cover" />
            )}
            <span className="truncate">{game.name}</span>
          </span>
        )}
        <h3 id={titleId} data-slot="table-card-title" className="truncate font-heading text-lg">
          {title}
        </h3>
        {facts.length > 0 && (
          <p data-slot="table-card-facts" className="truncate text-sm text-muted-foreground">
            {facts.join(" · ")}
          </p>
        )}
      </div>

      <div className="flex items-center justify-between gap-3">
        <TableSeats seats={seats} />
        <span data-slot="table-card-count" className="shrink-0 text-sm text-muted-foreground tabular-nums">
          <span className="sr-only">Seats taken: </span>
          {taken} / {total}
        </span>
      </div>

      {(names || action) && (
        <div className="mt-auto flex items-center justify-between gap-3">
          <p data-slot="table-card-names" className="min-w-0 flex-1 truncate text-sm text-muted-foreground">
            {names}
          </p>
          {way ? (
            <Button size="sm" asChild>
              <a href={href} aria-label={`${way} ${title}`} className="after:absolute after:inset-0">
                {way}
                <HugeiconsIcon icon={ArrowRight01Icon} strokeWidth={2} data-icon="inline-end" aria-hidden="true" />
              </a>
            </Button>
          ) : (
            action === "full" && (
              <Button size="sm" variant="secondary" disabled>
                Full
              </Button>
            )
          )}
        </div>
      )}
    </article>
  )
}

export { SeatAvatar, TableCard, TableSeats }
export type { TableCardProps }
