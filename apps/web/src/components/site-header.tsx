import Link from "next/link"
import { Button } from "@pbgo/ui/platform/button"
import { Logo } from "@pbgo/ui/platform/logo"
import { Navbar, NavbarBrand, NavbarEnd, NavbarStart, NavbarTab, NavbarTabs } from "@pbgo/ui/platform/navbar"
import { SITE_NAME } from "@/site"

/** The tabs of the navbar, in order, each with the page it leads to. Games is the home. */
export const SITE_TABS = [
  { id: "games", label: "Games", href: "/" },
  { id: "tables", label: "Tables", href: "/tables" },
  { id: "tournaments", label: "Tournaments", href: "/tournaments" },
  { id: "whats-new", label: "What's New", href: "/whats-new" },
] as const

/** A tab of the navbar: the one of the page the bar is on is the current tab. */
export type SiteTabId = (typeof SITE_TABS)[number]["id"]

/**
 * The navbar of the hub's own pages (the home, a game's page and the pages of the other tabs), fixed to the top of the window in two
 * containers kept apart, on the edges of the window: the logo and the tabs on the left, the account on the right, with nothing drawn between
 * them. A page leaves `pt-navbar` under it (or lets its backdrop run under the two containers, as the home's hero does), and an anchor
 * that lands under it has `scroll-mt-navbar`.
 * `current` is the tab of the page: the home and a game's page are Games. Tables, Tournaments and What's New lead to pages with nothing on
 * them yet (`BlankPage`). The two account buttons are placeholders: there is no account yet, so they do nothing.
 */
export function SiteHeader({ current }: { current: SiteTabId }) {
  return (
    <Navbar className="fixed inset-x-0 top-0 z-40">
      <NavbarStart>
        <NavbarBrand asChild>
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
