"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useEffect, useRef } from "react"
import { CreditCardIcon, Logout01Icon, LockIcon, Notification01Icon, PaletteIcon, TranslationIcon, UniversalAccessCircleIcon, UserIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { cn } from "@pbgo/ui/utils"
import { GAME_SETTINGS_PATH, SETTINGS_PATH } from "@/lib/settings-paths"
import { BILLING_OPEN, NOTIFICATIONS_OPEN } from "@/site"

/** A section of the settings: its name in the address, what it is called, its icon, and whether it exists for now (`open`, which a section that is hidden says is false: no entry here, and its address shows the 404 page). */
type Section = { slug: string; label: string; icon: typeof UserIcon; open?: boolean }

/**
 * The sections of the settings, in two groups, in the owner's order. The first is the member and their account: who they are and how they get in, and who sees what and what is kept; what they pay (`BILLING_OPEN`) and what reaches them
 * (`NOTIFICATIONS_OPEN`) have their place between the two and are hidden for now. The second, under a quiet label of its own, is how the site is for them, whoever they are: how it looks, what makes it easier to use, its language and its
 * clock. Sign out ends the list, the way the sidebar of the apps the owner pointed to ends.
 */
const GROUPS: readonly { label: string | null; sections: readonly Section[] }[] = [
  {
    label: null,
    sections: [
      { slug: "account", label: "Account", icon: UserIcon },
      { slug: "billing", label: "Billing", icon: CreditCardIcon, open: BILLING_OPEN },
      { slug: "notifications", label: "Notifications", icon: Notification01Icon, open: NOTIFICATIONS_OPEN },
      { slug: "privacy", label: "Data & Privacy", icon: LockIcon },
    ],
  },
  {
    label: "Experience",
    sections: [
      { slug: "appearance", label: "Appearance", icon: PaletteIcon },
      { slug: "accessibility", label: "Accessibility", icon: UniversalAccessCircleIcon },
      { slug: "language", label: "Language & Time", icon: TranslationIcon },
    ],
  },
]

/**
 * The way from one section of the settings to the next, the sidebar of the settings window: a column at the left from `md`, a row that scrolls sideways above the section on a phone (with no scrollbar, and never up or down), the current one lit
 * (`aria-current`). The second group starts under its label in the column and after a hairline in the row, and Sign out, a form that posts to `/logout` (nothing but a click may end a session), is the last item, at the foot of the column.
 * Each section is a page of its own, so that a link (the e-mail that confirms a new address) can lead straight to it; they are links and not `Tabs`, and they replace the entry of the history instead of adding one, so that closing the window
 * goes back to the page it opened over. On a phone the row is wider than the screen, so it is scrolled to bring the current section to its middle when a page opens (the row itself, never the page).
 */
export function SettingsNav({ className }: { className?: string }) {
  const pathname = usePathname()
  // Over a game's screen the window is at the alias, and its sections too: a link to the settings' own address would be answered by the hub's window, which leaves the game's page
  const base = pathname.startsWith(`${GAME_SETTINGS_PATH}/`) ? GAME_SETTINGS_PATH : SETTINGS_PATH
  const row = useRef<HTMLElement>(null)
  useEffect(() => {
    const nav = row.current
    const current = nav?.querySelector<HTMLElement>('[aria-current="page"]')
    if (!nav || !current || nav.scrollWidth <= nav.clientWidth) return
    nav.scrollTo({ left: nav.scrollLeft + current.getBoundingClientRect().left - nav.getBoundingClientRect().left - (nav.clientWidth - current.offsetWidth) / 2 })
  }, [pathname])
  const item = "flex shrink-0 items-center gap-3 rounded-xl px-3 py-2 text-sm whitespace-nowrap transition-colors duration-fast outline-none focus-visible:ring-3 focus-visible:ring-ring/30 max-md:focus-visible:ring-inset"
  return (
    <nav ref={row} aria-label="Settings" className={cn("flex gap-1 overflow-x-auto overflow-y-hidden [scrollbar-width:none] md:flex-col md:overflow-visible [&::-webkit-scrollbar]:hidden", className)}>
      {GROUPS.map((group, index) => (
        <div key={group.label ?? index} className="contents">
          {index > 0 && <span aria-hidden="true" className="mx-2 my-2 w-px shrink-0 bg-border md:hidden" />}
          {group.label && <p className="hidden px-3 pt-6 pb-1 text-sm text-muted-foreground md:block">{group.label}</p>}
          {group.sections.filter((section) => section.open !== false).map((section) => {
            const href = `${base}/${section.slug}`
            const current = pathname.startsWith(href)
            return (
              <Link
                key={section.slug}
                href={href}
                replace
                aria-current={current ? "page" : undefined}
                className={cn(item, "text-muted-foreground hover:bg-muted/50 hover:text-foreground", current && "bg-muted text-foreground")}
              >
                <HugeiconsIcon icon={section.icon} strokeWidth={2} className="size-4 shrink-0" aria-hidden="true" />
                {section.label}
              </Link>
            )
          })}
        </div>
      ))}
      <span aria-hidden="true" className="mx-2 my-2 w-px shrink-0 bg-border md:hidden" />
      <form action="/logout" method="post" className="contents">
        <button type="submit" className={cn(item, "cursor-pointer text-destructive hover:bg-destructive/10 md:mt-auto")}>
          <HugeiconsIcon icon={Logout01Icon} strokeWidth={2} className="size-4 shrink-0" aria-hidden="true" />
          Sign out
        </button>
      </form>
    </nav>
  )
}
