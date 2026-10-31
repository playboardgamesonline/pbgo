"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@pbgo/ui/utils"

/** The pages of an account, in order. */
const PAGES = [
  { href: "/me", label: "Profile" },
  { href: "/me/games", label: "Games" },
  { href: "/me/friends", label: "Friends" },
] as const

/**
 * The way from one page of an account to the next: a row of links under the profile's header, the current one underlined (`aria-current`). It is the
 * tabs of a page that are pages of their own, so they are links and not `Tabs`.
 */
export function AccountNav({ className }: { className?: string }) {
  const pathname = usePathname()
  return (
    <nav aria-label="Your account" className={cn("-mb-px flex gap-6 overflow-x-auto border-b", className)}>
      {PAGES.map((page) => {
        const current = page.href === "/me" ? pathname === "/me" : pathname.startsWith(page.href)
        return (
          <Link
            key={page.href}
            href={page.href}
            aria-current={current ? "page" : undefined}
            className={cn(
              "-mb-px shrink-0 border-b-2 border-transparent py-3 text-sm text-muted-foreground transition-colors duration-fast outline-none hover:text-foreground focus-visible:text-foreground",
              current && "border-foreground text-foreground",
            )}
          >
            {page.label}
          </Link>
        )
      })}
    </nav>
  )
}
