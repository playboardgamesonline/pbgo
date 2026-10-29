"use client"

import type { ReactNode } from "react"
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

/**
 * The menu of the account, which opens from its trigger (`children`: a button, the visitor's picture in the navbar's island), under it and to its end (`align`: to its start when the
 * picture is at the start of the open dock's header, so that the menu stays under the dock): their name, the
 * pages of their account and Sign out. At the top, their picture, big, with the dot of their presence, their name and the word that says it. Sign out is a form that posts to `/logout`, never a link: nothing but a click may end a session.
 */
export function AccountMenu({ account, align = "end", children }: { account: Account; align?: "start" | "end"; children: ReactNode }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{children}</DropdownMenuTrigger>
      <DropdownMenuContent align={align} className="w-60">
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
