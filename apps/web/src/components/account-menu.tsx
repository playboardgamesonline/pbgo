"use client"

import type { ReactNode } from "react"
import Link from "next/link"
import { PROVIDER_NAMES, type Account } from "@pbgo/accounts"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@pbgo/ui/platform/dropdown-menu"

/**
 * The menu of the account, which opens from its trigger (`children`: a button, the visitor's picture and name at the top of the social panel): their name, the
 * pages of their account and Sign out. Sign out is a form that posts to `/logout`, never a link: nothing but a click may end a session.
 */
export function AccountMenu({ account, children }: { account: Account; children: ReactNode }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{children}</DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-60">
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
