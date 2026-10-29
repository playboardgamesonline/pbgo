"use client"

import { useRef, useState, type ReactNode } from "react"
import Link from "next/link"
import { initialsOf, PROVIDER_NAMES, type Account } from "@pbgo/accounts"
import { Avatar, AvatarFallback, AvatarImage } from "@pbgo/ui/platform/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@pbgo/ui/platform/dropdown-menu"
import { PresenceDot } from "@pbgo/ui/platform/friends-panel"

type Place = { side: "bottom" | "left"; align: "start" | "end"; sideOffset: number; alignOffset: number }

/** Under the picture, to its end */
const UNDER: Place = { side: "bottom", align: "end", sideOffset: 4, alignOffset: 0 }

/**
 * The menu of the account, which opens from its trigger (`children`: a button, the visitor's picture): at the top, their picture, big, with the dot of their presence, their name and the
 * word that says it, then the pages of their account and Sign out. Sign out is a form that posts to `/logout`, never a link: nothing but a click may end a session. It opens under the picture, to its
 * end, in the bar of the navbar; and, where the picture is the head of a side panel that is open (`beside`: what the panel is, a selector the trigger is inside of), it opens beside the panel instead, to
 * its left, overlapping it by 16px (the edge of what the panel holds) and 12px under its top, as the Riot Client's does. Where it goes is read as it opens: the panel is where it is then.
 */
export function AccountMenu({ account, beside, children }: { account: Account; beside?: string; children: ReactNode }) {
  const trigger = useRef<HTMLButtonElement>(null)
  const [place, setPlace] = useState<Place>(UNDER)

  function onOpenChange(next: boolean) {
    if (!next) return
    const button = trigger.current
    const panel = beside && button ? button.closest(beside) : null
    if (!button || !panel) return setPlace(UNDER)
    const at = button.getBoundingClientRect()
    const box = panel.getBoundingClientRect()
    setPlace({ side: "left", align: "start", sideOffset: at.left - box.left - 16, alignOffset: box.top - at.top + 12 })
  }

  return (
    <DropdownMenu onOpenChange={onOpenChange}>
      <DropdownMenuTrigger asChild ref={trigger}>
        {children}
      </DropdownMenuTrigger>
      <DropdownMenuContent side={place.side} align={place.align} sideOffset={place.sideOffset} alignOffset={place.alignOffset} className="w-72">
        <DropdownMenuLabel className="flex flex-col items-start gap-3 px-2 pt-2 pb-1.5">
          <Avatar size="xl">
            {account.avatarUrl && <AvatarImage src={account.avatarUrl} alt="" referrerPolicy="no-referrer" />}
            <AvatarFallback>{initialsOf(account.nickname)}</AvatarFallback>
            <PresenceDot status="online" />
          </Avatar>
          <span className="flex max-w-full flex-col gap-0.5">
            <span className="truncate text-base text-foreground">{account.nickname}</span>
            <span className="truncate text-xs">Online</span>
            <span className="truncate text-xs">{account.email ?? (account.provider ? `Signed in with ${PROVIDER_NAMES[account.provider]}` : "Demo account")}</span>
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/me">Profile</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/me/games">My games</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/me/friends">Friends</Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <form action="/logout" method="post">
          <DropdownMenuItem asChild>
            <button type="submit" className="w-full">
              Sign out
            </button>
          </DropdownMenuItem>
        </form>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
