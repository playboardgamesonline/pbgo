"use client"

import * as React from "react"
import { CrownIcon, PlusSignIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { initials, type FriendStatus } from "../friends"
import { layoutRow } from "../play-zone"
import { cn } from "../utils"
import { Avatar, AvatarFallback, AvatarImage } from "./avatar"
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "./dropdown-menu"
import { PresenceDot } from "./friends-panel"
import { Popover, PopoverContent, PopoverTrigger } from "./popover"

// The row of places of the signed-in home's play zone, the people who play together: the visitor first, at the left, and after them their group and the friends invited to it who have not answered, whichever kind of play the zone is set to, then the places that nobody has, nine places at the most, the most a table
// has. It is aligned to the left like the rest of the zone and grows to the right the way the row of games does (`layoutRow`). The places are open whatever else the zone holds, even with no game picked: a place that nobody has is a circle with a plus, with the outline and the background of a free slot of the row of games, and a press on it opens a panel (`picker`: the
// friends, then a way to copy a link). A person is their picture with the dot of their presence (a share of the picture, whatever its size), their name under it (the visitor's is "You") and a crown on the one who leads; an invitation that waits for an answer is a dashed outline round a picture that is a little faint. A press on a person opens their
// menu (`menu`), when the page has one for them. The row has no label: what it is says itself. Every place has the size of a large avatar, a person and a free place alike, and never changes it: the row is made for nine on one line in the column of the home, and a column too narrow for them (under `@xl`) lets it wrap
// to a second line of the others rather than make the pictures smaller. It draws what it is given and decides nothing: who is in it, how many places it has (`placesFor` of `@pbgo/ui/play-zone`) and what a press does are the page's.

/** A person in the row: who they are, what their picture and their dot say, whether they lead, whether they are the visitor, and whether they were invited and have not answered. */
type SlotPlayer = {
  id: string
  name: string
  /** The digits that tell two players of one name apart: said to a screen reader, not drawn. */
  tag?: string
  avatarUrl?: string | null
  /** Their presence, for the dot on their picture. None: no dot (the visitor's own picture has none). */
  status?: FriendStatus
  /** Whether they lead the group or open the table: a crown over their picture. */
  leader?: boolean
  /** Whether they are the visitor: their place is the first one and their name "You". */
  you?: boolean
  /** Whether they were invited and have not answered: a faint picture with a dashed outline. */
  pending?: boolean
}

type PlayerSlotsProps = Omit<React.ComponentProps<"ul">, "children"> & {
  /** The people in the row in the order they fill it: the visitor first, who has the first place. */
  players: readonly SlotPlayer[]
  /** How many places the row has, from 1 to nine. It is never fewer than the people in it. */
  size: number
  /** What a free place opens when it is pressed: the panel that picks a friend (`FriendPicker`). None: the places are only drawn, and cannot be pressed. */
  picker?: React.ReactNode
  /** The entries of the menu that a press on a person opens: `null` for a person who has none (nothing is opened). */
  menu?: (player: SlotPlayer) => React.ReactNode
  /** A search is on, or a table is being opened: no place can be pressed. */
  disabled?: boolean
}

/**
 * The classes of a row by how many places it has (the index is that count, from 1 to nine), plain Tailwind and written out so that each is in the stylesheet: as many columns as there are places, five to a row at the most while the room is under `@xl` (a second row under them),
 * and the row no wider than that many places of the most a place has plus the space between two (`max-w-<n>`, a quarter of a rem each), so that a few places are a few large avatars and nine are nine smaller ones: the most a place has is 4rem, then 5, 5.5, 6 and 8rem as the room of
 * the row (`@container`, the page's) grows by steps, and the space between places is 0.75rem, then 1.25rem from `@3xl`.
 */
const ROWS = [
  "grid-cols-1 max-w-16 @3xl:max-w-20 @4xl:max-w-22 @5xl:max-w-24 @7xl:max-w-32",
  "grid-cols-1 max-w-16 @3xl:max-w-20 @4xl:max-w-22 @5xl:max-w-24 @7xl:max-w-32",
  "grid-cols-2 max-w-35 @3xl:max-w-45 @4xl:max-w-49 @5xl:max-w-53 @7xl:max-w-69",
  "grid-cols-3 max-w-54 @3xl:max-w-70 @4xl:max-w-76 @5xl:max-w-82 @7xl:max-w-106",
  "grid-cols-4 max-w-73 @3xl:max-w-95 @4xl:max-w-103 @5xl:max-w-111 @7xl:max-w-143",
  "grid-cols-5 max-w-92 @3xl:max-w-120 @4xl:max-w-130 @5xl:max-w-140 @7xl:max-w-180",
  "grid-cols-5 @xl:grid-cols-6 max-w-111 @3xl:max-w-145 @4xl:max-w-157 @5xl:max-w-169 @7xl:max-w-217",
  "grid-cols-5 @xl:grid-cols-7 max-w-130 @3xl:max-w-170 @4xl:max-w-184 @5xl:max-w-198 @7xl:max-w-254",
  "grid-cols-5 @xl:grid-cols-8 max-w-149 @3xl:max-w-195 @4xl:max-w-211 @5xl:max-w-227 @7xl:max-w-291",
  "grid-cols-5 @xl:grid-cols-9 max-w-168 @3xl:max-w-220 @4xl:max-w-238 @5xl:max-w-256 @7xl:max-w-328",
] as const

/** What makes an avatar of the row as wide as its place, and as tall. */
const FILL = "data-[size=xl]:size-full aspect-square"

/** A free place: a circle with a plus in it, the outline and the background of a free slot of the row of games, a little stronger under the pointer of what holds it (`group/slot`). */
function FreePlace() {
  return (
    <Avatar size="xl" className={cn(FILL, "after:hidden")}>
      <AvatarFallback className="border border-border bg-background/40 text-muted-foreground transition-colors duration-fast group-hover/slot:border-foreground/50 group-hover/slot:text-foreground">
        <HugeiconsIcon icon={PlusSignIcon} strokeWidth={2} aria-hidden="true" className="size-6" />
      </AvatarFallback>
    </Avatar>
  )
}

/** The picture of a person, with the dot of their presence, faint and outlined when they were invited and have not answered. */
function Picture({ player }: { player: SlotPlayer }) {
  return (
    <Avatar size="xl" className={cn(FILL, player.pending && "opacity-60 outline-2 outline-offset-2 outline-border outline-dashed")}>
      {player.avatarUrl && <AvatarImage src={player.avatarUrl} alt="" referrerPolicy="no-referrer" />}
      <AvatarFallback>{initials(player.name)}</AvatarFallback>
      {player.status && !player.you && !player.pending && <PresenceDot status={player.status} scaled />}
    </Avatar>
  )
}

/** What a screen reader hears of a person: their name and tag, whether they lead and whether they are the visitor. */
function describe(player: SlotPlayer): string {
  return [player.you ? "You" : player.name + (player.tag ? `#${player.tag}` : ""), player.leader ? "leader" : null, player.pending ? "invited" : null].filter((part) => part).join(", ")
}

/** A person: the picture (a button that opens their menu when the page has one for them), a crown over it for the one who leads and their name under it. */
function Person({ player, menu, disabled }: { player: SlotPlayer; menu?: (player: SlotPlayer) => React.ReactNode; disabled: boolean }) {
  const entries = menu?.(player)
  const picture = <Picture player={player} />
  return (
    <>
      <span className="relative block w-full">
        {player.leader && (
          <HugeiconsIcon icon={CrownIcon} strokeWidth={2} aria-hidden="true" className="absolute -top-3 left-1/2 z-10 size-5 -translate-x-1/2" />
        )}
        {entries ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                disabled={disabled}
                aria-label={`${describe(player)}: more`}
                className="group/slot block w-full rounded-full outline-none focus-visible:ring-3 focus-visible:ring-ring/30 disabled:cursor-default"
              >
                {picture}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="center" className="w-48">
              {entries}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <span role="img" aria-label={describe(player)} className="block w-full">
            {picture}
          </span>
        )}
      </span>
      <span aria-hidden="true" className="ph-mask w-full truncate text-center text-xs @4xl:text-sm">
        {player.you ? "You" : player.name}
      </span>
    </>
  )
}

/** A place that nobody has: a button that opens the panel of the friends when the page gives one. */
function Free({ picker, disabled, tabbable }: { picker?: React.ReactNode; disabled: boolean; tabbable: boolean }) {
  if (!picker) {
    return (
      <span className="group/slot block w-full">
        <FreePlace />
      </span>
    )
  }
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button type="button" disabled={disabled} aria-label="Add a player" tabIndex={tabbable ? undefined : -1} className="group/slot block w-full rounded-full outline-none focus-visible:ring-3 focus-visible:ring-ring/30 disabled:cursor-default">
          <FreePlace />
        </button>
      </PopoverTrigger>
      <PopoverContent aria-label="Add a player" align="center" className="w-80 gap-0 rounded-2xl p-3">
        {picker}
      </PopoverContent>
    </Popover>
  )
}

/** The places of the row, from the left: as many as `size` says, the visitor first, every one the same fixed size, the row wrapping to a second line in a column too narrow for them. */
function PlayerSlots({ players, size, picker, menu, disabled = false, className, ...props }: PlayerSlotsProps) {
  const cells = layoutRow(players, size)
  // The free places all open the same panel, so only the first of them is a stop for the keyboard's Tab, as the free seats of a table are
  const firstFree = cells.findIndex((cell) => cell.person === null)
  return (
    <ul data-slot="player-slots" aria-label="Players" data-places={cells.length} className={cn("grid items-start gap-x-3 gap-y-4 @3xl:gap-x-5", ROWS[cells.length], className)} {...props}>
      {cells.map((cell, index) => (
        <li key={index} data-slot="player-slot" data-free={cell.person === null ? "" : undefined} className="flex min-w-0 flex-col items-center gap-2">
          {cell.person ? <Person player={cell.person} menu={menu} disabled={disabled} /> : <Free picker={picker} disabled={disabled} tabbable={index === firstFree} />}
        </li>
      ))}
    </ul>
  )
}

export { PlayerSlots }
export type { PlayerSlotsProps, SlotPlayer }
