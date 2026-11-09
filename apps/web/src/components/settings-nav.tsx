"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { CreditCardIcon, LockIcon, Notification01Icon, Shield01Icon, TranslationIcon, UniversalAccessCircleIcon, UserIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { cn } from "@pbgo/ui/utils"

/**
 * The sections of the settings, in two groups. The first is the member and their account: what the others see of them, how they get in, what they pay, what reaches them and who sees what. The second, under a quiet label of its own,
 * is how the site is for them, whoever they are: its language and its clock, and what makes it easier to use.
 */
const GROUPS = [
  {
    label: null,
    sections: [
      { href: "/me/settings/profile", label: "Profile", icon: UserIcon },
      { href: "/me/settings/account", label: "Account", icon: Shield01Icon },
      { href: "/me/settings/billing", label: "Billing", icon: CreditCardIcon },
      { href: "/me/settings/notifications", label: "Notifications", icon: Notification01Icon },
      { href: "/me/settings/privacy", label: "Privacy", icon: LockIcon },
    ],
  },
  {
    label: "Experience",
    sections: [
      { href: "/me/settings/language", label: "Language & time", icon: TranslationIcon },
      { href: "/me/settings/accessibility", label: "Accessibility & appearance", icon: UniversalAccessCircleIcon },
    ],
  },
] as const

/**
 * The way from one section of the settings to the next: a column of links at the left of the page from `md`, a row that scrolls sideways above it on a phone (with no scrollbar, and never up or down), the current one lit (`aria-current`).
 * The second group starts under its label in the column and after a hairline in the row. Each section is a page of its own, so that a link (the e-mail that confirms a new address, the pricing page) can lead straight to it; they are links and
 * not `Tabs`.
 */
export function SettingsNav({ className }: { className?: string }) {
  const pathname = usePathname()
  return (
    <nav aria-label="Settings" className={cn("flex gap-1 overflow-x-auto overflow-y-hidden [scrollbar-width:none] md:flex-col md:overflow-visible [&::-webkit-scrollbar]:hidden", className)}>
      {GROUPS.map((group, index) => (
        <div key={group.label ?? index} className="contents">
          {index > 0 && <span aria-hidden="true" className="mx-2 my-2 w-px shrink-0 bg-border md:hidden" />}
          {group.label && <p className="hidden px-3 pt-6 pb-1 text-sm text-muted-foreground md:block">{group.label}</p>}
          {group.sections.map((section) => {
            const current = pathname.startsWith(section.href)
            return (
              <Link
                key={section.href}
                href={section.href}
                aria-current={current ? "page" : undefined}
                className={cn(
                  "flex shrink-0 items-center gap-3 rounded-xl px-3 py-2 text-sm whitespace-nowrap text-muted-foreground transition-colors duration-fast outline-none hover:bg-muted/50 hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/30 max-md:focus-visible:ring-inset",
                  current && "bg-muted text-foreground",
                )}
              >
                <HugeiconsIcon icon={section.icon} strokeWidth={2} className="size-4 shrink-0" aria-hidden="true" />
                {section.label}
              </Link>
            )
          })}
        </div>
      ))}
    </nav>
  )
}
