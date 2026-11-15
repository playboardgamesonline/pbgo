"use client"

import * as React from "react"
import { CrownIcon, PlusSignIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { initials, type FriendStatus } from "../friends"
import { layoutRow, SLOT_COLUMNS } from "../play-zone"
import { cn } from "../utils"
import { Avatar, AvatarFallback, AvatarImage } from "./avatar"
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "./dropdown-menu"
import { PresenceDot } from "./friends-panel"
import { Popover, PopoverContent, PopoverTrigger } from "./popover"

// The row of places of the signed-in home's play zone, the people who play together: the visitor in the middle and, around them, their group (a search) or the friends they will invite to the table they open (Custom), nine places on one line at the most, the most a table has, so that a
// whole group fits. The visitor is always the middle place, and the others fill outwards from it, one to the right and one to the left in turn (`layoutRow`). The places are open whatever else the zone holds, even with no game picked: a place that nobody has is a dashed circle with a plus, and a press
// on it opens a panel (`picker`: the friends, then a way to copy a link). A person is their picture with the dot of their presence, their name under it (the visitor's is "You") and a crown on the one who leads; an invitation that waits for an answer is a dashed outline
// round a picture that is a little faint. A press on a person opens their menu (`menu`), when the page has one for them. The row has no label: what it is says itself. The pictures are as large as the row allows, 64px at the most, and shrink with it, so that nine places stay on
// one line in a narrow column; the names are left out when they would not be read. It draws what it is given and decides nothing: who is in it, how many places it has and what a press does are the page's.

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
  /** Whether they are the visitor: their place is the middle one and their name "You". */
  you?: boolean
  /** Whether they were invited and have not answered: a faint picture with a dashed outline. */
  pending?: boolean
}

type PlayerSlotsProps = Omit<React.ComponentProps<"ul">, "children"> & {
  /** The people in the row in the order they fill it: the visitor first, who has the middle place. */
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

/** The picture of a place fills its column, a ninth of the row less the room between the places, and is never larger than 64px. */
const PICTURE = "size-auto w-full aspect-square max-w-16"

/** A free place: a dashed circle with a plus in it, as faint as the seats of a table that nobody has taken, a little more there under the pointer of what holds it (`group/slot`). */
function FreePlace() {
  return (
    <Avatar className={cn(PICTURE, "after:hidden")}>
      <AvatarFallback className="border border-dashed border-border bg-transparent text-muted-foreground transition-colors duration-fast group-hover/slot:border-foreground/50 group-hover/slot:text-foreground">
        <HugeiconsIcon icon={PlusSignIcon} strokeWidth={2} aria-hidden="true" className="size-1/3 min-h-3.5 min-w-3.5" />
      </AvatarFallback>
    </Avatar>
  )
}

/** The picture of a person, with the dot of their presence, faint and outlined when they were invited and have not answered. */
function Picture({ player }: { player: SlotPlayer }) {
  return (
    <Avatar className={cn(PICTURE, player.pending && "opacity-60 outline-2 outline-offset-2 outline-border outline-dashed")}>
      {player.avatarUrl && <AvatarImage src={player.avatarUrl} alt="" referrerPolicy="no-referrer" />}
      <AvatarFallback className="@max-md/slots:text-xs">{initials(player.name)}</AvatarFallback>
      {player.status && !player.you && !player.pending && <PresenceDot status={player.status} />}
    </Avatar>
  )
}

/** What a screen reader hears of a person: their name and tag, whether they lead and whether they are the visitor. */
function describe(player: SlotPlayer): string {
  return [player.you ? "You" : player.name + (player.tag ? `#${player.tag}` : ""), player.leader ? "leader" : null, player.pending ? "invited" : null].filter((part) => part).join(", ")
}

/** A person: the picture (a button that opens their menu when the page has one), a crown over it for the one who leads and their name under it. */
function Person({ player, menu, disabled }: { player: SlotPlayer; menu?: (player: SlotPlayer) => React.ReactNode; disabled: boolean }) {
  const entries = menu?.(player)
  const picture = <Picture player={player} />
  return (
    <>
      <span className="relative block w-full">
        {player.leader && <HugeiconsIcon icon={CrownIcon} strokeWidth={2} aria-hidden="true" className="absolute -top-3.5 left-1/2 z-10 size-5 -translate-x-1/2 @max-md/slots:-top-3 @max-md/slots:size-4" />}
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
      <span aria-hidden="true" className="ph-mask w-full truncate text-center text-xs @max-md/slots:sr-only">
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

/** One column for each seat of the largest table (`SLOT_COLUMNS`): the row never wraps, whatever the width of its column. */
function PlayerSlots({ players, size, picker, menu, disabled = false, className, ...props }: PlayerSlotsProps) {
  const cells = layoutRow(players, size)
  // The free places all open the same panel, so only the first of them is a stop for the keyboard's Tab, as the free seats of a table are
  const firstFree = cells.findIndex((cell) => cell !== null && cell.person === null)
  return (
    <div data-slot="player-slots-frame" className="@container/slots flex w-full justify-center">
      <ul data-slot="player-slots" aria-label="Players" data-columns={SLOT_COLUMNS} className={cn("grid w-full max-w-2xl grid-cols-9 items-start gap-x-1.5 @md/slots:gap-x-3", className)} {...props}>
        {cells.map((cell, column) => (
          <li key={column} data-slot="player-slot" data-free={cell && cell.person === null ? "" : undefined} aria-hidden={cell ? undefined : "true"} className="flex min-w-0 flex-col items-center gap-1.5">
            {cell && (cell.person ? <Person player={cell.person} menu={menu} disabled={disabled} /> : <Free picker={picker} disabled={disabled} tabbable={column === firstFree} />)}
          </li>
        ))}
      </ul>
    </div>
  )
}

export { PlayerSlots }
export type { PlayerSlotsProps, SlotPlayer }
