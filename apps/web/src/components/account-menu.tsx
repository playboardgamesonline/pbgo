"use client"

import Link from "next/link"
import { PROVIDER_NAMES, initialsOf, type Account } from "@pbgo/accounts"
import { Avatar, AvatarFallback, AvatarImage } from "@pbgo/ui/platform/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@pbgo/ui/platform/dropdown-menu"

/**
 * The account in the navbar, in place of Sign in: the visitor's picture (their initials when their provider gives none) that opens a menu with their
 * name, the pages of their account and Sign out. Sign out is a form that posts to `/logout`, never a link: nothing but a click may end a session.
 */
export function AccountMenu({ account }: { account: Account }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={`Account of ${account.nickname}`}
          className="rounded-full outline-none focus-visible:ring-3 focus-visible:ring-ring/30"
        >
          <Avatar size="lg">
            {account.avatarUrl && <AvatarImage src={account.avatarUrl} alt="" referrerPolicy="no-referrer" />}
            <AvatarFallback>{initialsOf(account.nickname)}</AvatarFallback>
          </Avatar>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="flex flex-col gap-0.5 px-2 py-1.5">
          <span className="truncate text-sm text-foreground">{account.nickname}</span>
          <span className="truncate text-xs">{account.email ?? (account.provider ? `Signed in with ${PROVIDER_NAMES[account.provider]}` : "Demo account")}</span>
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
