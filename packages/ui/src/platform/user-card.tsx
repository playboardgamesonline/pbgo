import * as React from "react"
import { cn } from "../utils"
import { initials } from "../friends"
import { recordOf } from "../results"
import type { SeatedPlayer } from "../tables"
import { Avatar, AvatarFallback, AvatarImage } from "./avatar"

// What the card of a player says, which opens under the pointer on their picture (`HoverCard`): the picture, big, their name and tag, and what they have done in the game: their rating, and how many of their games they won. A guest has no
// tag and no rating, and says so; so does an account that has not played the game ranked yet. It draws what it is given.

/** The card of a player: draw it in a `HoverCardContent`, or by itself where a player is introduced. */
function UserCard({ player, className, ...props }: Omit<React.ComponentProps<"div">, "children"> & { player: SeatedPlayer }) {
  const { name, tag, avatarUrl, host, rating } = player
  const note = !tag ? "Guest" : host ? "Host of the table" : null
  return (
    <div data-slot="user-card" className={cn("flex flex-col gap-4", className)} {...props}>
      <div className="flex items-center gap-4">
        <Avatar size="xl">
          {avatarUrl && <AvatarImage src={avatarUrl} alt="" referrerPolicy="no-referrer" />}
          <AvatarFallback>{initials(name)}</AvatarFallback>
        </Avatar>
        <div className="flex min-w-0 flex-col gap-1">
          <p className="truncate text-lg leading-tight font-strong text-foreground">
            {name}
            {tag && <span className="text-muted-foreground">#{tag}</span>}
          </p>
          {note && <p className="truncate text-sm text-muted-foreground">{note}</p>}
        </div>
      </div>
      <dl className="flex flex-col gap-2 border-t pt-4">
        <div className="flex items-baseline justify-between gap-4">
          <dt className="text-sm text-muted-foreground">Rating</dt>
          <dd className="font-heading text-2xl tabular-nums">{rating ? Math.round(rating.rating) : "—"}</dd>
        </div>
        <div className="flex items-baseline justify-between gap-4">
          <dt className="text-sm text-muted-foreground">Record</dt>
          <dd className="truncate text-sm">{rating ? recordOf(rating.wins, rating.gamesPlayed) : "Not rated yet"}</dd>
        </div>
      </dl>
    </div>
  )
}

export { UserCard }
