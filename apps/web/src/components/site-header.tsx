"use client"

import { Fragment } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useAccount } from "@pbgo/accounts/client"
import { Button } from "@pbgo/ui/platform/button"
import { Logo } from "@pbgo/ui/platform/logo"
import { Navbar, NavbarBrand, NavbarEnd, NavbarSeparator, NavbarStart, NavbarTab, NavbarTabs } from "@pbgo/ui/platform/navbar"
import { SiteSocial } from "@/components/site-social"
import { SITE_NAME } from "@/site"

/**
 * The tabs of the navbar, in order, each with the page it leads to and its `group`: the ones for playing, then the ones about the site, with a hairline between the two groups (`NavbarSeparator`).
 * The home is the logo's, not a tab's. The tabs about the site leave the bar under `lg` (they would not fit between the logo and the account on a tablet): the ones for playing stay.
 */
const SITE_TABS = [
  { id: "games", label: "Games", href: "/games", group: "play" },
  { id: "tables", label: "Tables", href: "/tables", group: "play" },
  { id: "tournaments", label: "Tournaments", href: "/tournaments", group: "play" },
  { id: "about", label: "About", href: "/about", group: "about" },
  { id: "pricing", label: "Pricing", href: "/pricing", group: "about" },
] as const

/** What the bar marks as current: a tab, or the logo (`home`, the front page, which no tab leads to), or nothing (`account`: the sign-in and the pages of a signed-in visitor, which no tab leads to). */
type SiteCurrent = (typeof SITE_TABS)[number]["id"] | "home" | "account"

/**
 * What the bar marks as current on a page of the hub, from its address: the logo on the front page, a tab on the page of that tab, Games on a
 * game's page on the hub (`/game/<slug>`), and nothing on the sign-in and the pages of an account (`/me`), which have the bar and no tab. `null` on a
 * page that has no bar (the design system, the legal pages, the 404).
 */
function currentOf(pathname: string): SiteCurrent | null {
  if (pathname === "/") return "home"
  if (pathname === "/login" || pathname === "/me" || pathname.startsWith("/me/")) return "account"
  if (pathname.startsWith("/game/")) return "games"
  return SITE_TABS.find((tab) => tab.href === pathname)?.id ?? null
}

/**
 * The navbar of the hub's own pages (the home, the pages of the tabs and a game's page), fixed to the top of the window in two rounded-square
 * containers kept apart, on the edges of the window: the logo and the tabs on the left, the account on the right, with nothing drawn between
 * them. A page leaves `pt-navbar` under it, and an anchor
 * that lands under it has `scroll-mt-navbar`.
 * The hub's layout mounts it once, and it reads the address to know what is current: the page does not say. That is what lets the fill behind
 * the current item glide from one to the next when the visitor goes from page to page, which a bar that every page drew again could not do.
 * The account is on the right: Sign in (to `/login`, which brings the visitor back to this page) and Let's play (a placeholder for now), or, once the
 * browser has read a session, the dock of their friends (`SiteSocial`: one container that is a bar, with the games their friends are in, their picture and the button of the panel, and that grows into a side panel, with the friends, the messages and the requests).
 * The server renders every page as if nobody were signed in, so the static pages stay static; while the browser has not read its session the two buttons keep
 * their place but are not drawn, so a signed-in visitor never sees them flash.
 */
export function SiteHeader() {
  const pathname = usePathname()
  const current = currentOf(pathname)
  const account = useAccount()
  if (current === null) return null
  const hidden = account.status === "loading" ? "invisible" : undefined

  return (
    <Navbar className="fixed inset-x-0 top-0 z-40">
      <NavbarStart>
        <NavbarBrand asChild current={current === "home"}>
          <Link href="/" aria-label={SITE_NAME}>
            <Logo className="h-6" />
          </Link>
        </NavbarBrand>
        <NavbarTabs aria-label="Main">
          {SITE_TABS.map((tab, index) => (
            <Fragment key={tab.id}>
              {index > 0 && SITE_TABS[index - 1].group !== tab.group && <NavbarSeparator className="max-lg:hidden" />}
              <NavbarTab asChild current={tab.id === current} className={tab.group === "about" ? "max-lg:hidden" : undefined}>
                <Link href={tab.href}>{tab.label}</Link>
              </NavbarTab>
            </Fragment>
          ))}
        </NavbarTabs>
      </NavbarStart>
      <div className="flex shrink-0 items-center gap-2">
        {account.status === "signed-in" ? (
          <SiteSocial account={account.account} />
        ) : (
          <NavbarEnd>
            <Button variant="ghost" size="lg" className={hidden} asChild>
              <Link href={`/login?next=${encodeURIComponent(pathname)}`}>Sign in</Link>
            </Button>
            <Button size="lg" type="button" className={hidden} aria-disabled="true" title="Coming soon">
              {"Let's play"}
            </Button>
          </NavbarEnd>
        )}
      </div>
    </Navbar>
  )
}
