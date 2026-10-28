"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Button } from "@pbgo/ui/platform/button"
import { Logo } from "@pbgo/ui/platform/logo"
import { Navbar, NavbarBrand, NavbarEnd, NavbarStart, NavbarTab, NavbarTabs } from "@pbgo/ui/platform/navbar"
import { SITE_NAME } from "@/site"

/** The tabs of the navbar, in order, each with the page it leads to. The home is the logo's, not a tab's. */
const SITE_TABS = [
  { id: "games", label: "Games", href: "/games" },
  { id: "tables", label: "Tables", href: "/tables" },
  { id: "tournaments", label: "Tournaments", href: "/tournaments" },
  { id: "whats-new", label: "What's New", href: "/whats-new" },
] as const

/** What the bar marks as current: a tab, or the logo (`home`, the front page, which no tab leads to). */
type SiteCurrent = (typeof SITE_TABS)[number]["id"] | "home"

/**
 * What the bar marks as current on a page of the hub, from its address: the logo on the front page, a tab on the page of that tab, Games on a
 * game's page on the hub (`/game/<slug>`). `null` on a page that has no bar (the design system, the legal pages, the 404).
 */
function currentOf(pathname: string): SiteCurrent | null {
  if (pathname === "/") return "home"
  if (pathname.startsWith("/game/")) return "games"
  return SITE_TABS.find((tab) => tab.href === pathname)?.id ?? null
}

/**
 * The navbar of the hub's own pages (the home, the pages of the tabs and a game's page), fixed to the top of the window in two rounded-square
 * containers kept apart, on the edges of the window: the logo and the tabs on the left, the account on the right, with nothing drawn between
 * them. A page leaves `pt-navbar` under it (or lets its backdrop run under the two containers, as the home's hero does), and an anchor
 * that lands under it has `scroll-mt-navbar`.
 * The hub's layout mounts it once, and it reads the address to know what is current: the page does not say. That is what lets the fill behind
 * the current item glide from one to the next when the visitor goes from page to page, which a bar that every page drew again could not do.
 * The two account buttons are placeholders: there is no account yet, so they do nothing.
 */
export function SiteHeader() {
  const current = currentOf(usePathname())
  if (current === null) return null

  return (
    <Navbar className="fixed inset-x-0 top-0 z-40">
      <NavbarStart>
        <NavbarBrand asChild current={current === "home"}>
          <Link href="/" aria-label={SITE_NAME}>
            <Logo className="h-6" />
          </Link>
        </NavbarBrand>
        <NavbarTabs aria-label="Main">
          {SITE_TABS.map((tab) => (
            <NavbarTab key={tab.id} asChild current={tab.id === current}>
              <Link href={tab.href}>{tab.label}</Link>
            </NavbarTab>
          ))}
        </NavbarTabs>
      </NavbarStart>
      <NavbarEnd>
        <Button variant="ghost" size="lg" type="button" aria-disabled="true" title="Coming soon">
          Sign in
        </Button>
        <Button size="lg" type="button" aria-disabled="true" title="Coming soon">
          Sign up
        </Button>
      </NavbarEnd>
    </Navbar>
  )
}
