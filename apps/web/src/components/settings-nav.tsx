"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { CreditCardIcon, LockIcon, Notification01Icon, Shield01Icon, UserIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { cn } from "@pbgo/ui/utils"

/** The sections of the settings, in order: what a member edits about themselves, how they get in, what they pay, what reaches them and who sees what. */
const SECTIONS = [
  { href: "/me/settings/profile", label: "Profile", icon: UserIcon },
  { href: "/me/settings/account", label: "Account", icon: Shield01Icon },
  { href: "/me/settings/billing", label: "Billing", icon: CreditCardIcon },
  { href: "/me/settings/notifications", label: "Notifications", icon: Notification01Icon },
  { href: "/me/settings/privacy", label: "Privacy", icon: LockIcon },
] as const

/**
 * The way from one section of the settings to the next: a column of links at the left of the page from `md`, a row that scrolls sideways above it on a phone, the current one lit (`aria-current`). Each section is a page of its own, so that a link
 * (the e-mail that confirms a new address, the pricing page) can lead straight to it; they are links and not `Tabs`.
 */
export function SettingsNav({ className }: { className?: string }) {
  const pathname = usePathname()
  return (
    <nav aria-label="Settings" className={cn("flex gap-1 overflow-x-auto md:flex-col md:overflow-visible", className)}>
      {SECTIONS.map((section) => {
        const current = pathname.startsWith(section.href)
        return (
          <Link
            key={section.href}
            href={section.href}
            aria-current={current ? "page" : undefined}
            className={cn(
              "flex shrink-0 items-center gap-3 rounded-xl px-3 py-2 text-sm text-muted-foreground transition-colors duration-fast outline-none hover:bg-muted/50 hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/30",
              current && "bg-muted text-foreground",
            )}
          >
            <HugeiconsIcon icon={section.icon} strokeWidth={2} className="size-4" aria-hidden="true" />
            {section.label}
          </Link>
        )
      })}
    </nav>
  )
}
