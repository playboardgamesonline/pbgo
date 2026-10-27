import Link from "next/link"
import { Button } from "@pbgo/ui/platform/button"
import { Logo } from "@pbgo/ui/platform/logo"
import { Navbar, NavbarBrand, NavbarEnd, NavbarStart, NavbarTab, NavbarTabs } from "@pbgo/ui/platform/navbar"
import { SITE_NAME } from "@/site"

/**
 * The navbar of the hub's own pages (the home and a game's page), fixed to the top of the window: the logo and the tabs on the left, the
 * account on the right, apart. The page leaves `pt-navbar` under it, and an anchor that lands under it has `scroll-mt-navbar`.
 * Tournaments, What's New and the two account buttons are placeholders: there is no page behind the tabs and no account yet, so the tabs are
 * text and the buttons do nothing. Games is always the current tab, since the pages that wear this bar are the games'.
 */
export function SiteHeader() {
  return (
    <Navbar className="fixed inset-x-0 top-0 z-40">
      <NavbarStart>
        <NavbarBrand asChild>
          <Link href="/" aria-label={SITE_NAME}>
            <Logo />
          </Link>
        </NavbarBrand>
        <NavbarTabs aria-label="Main">
          <NavbarTab asChild current>
            <Link href="/#games">Games</Link>
          </NavbarTab>
          <NavbarTab disabled title="Coming soon">
            Tournaments
          </NavbarTab>
          <NavbarTab disabled title="Coming soon">
            What&apos;s New
          </NavbarTab>
        </NavbarTabs>
      </NavbarStart>
      <NavbarEnd>
        <Button variant="ghost" type="button" aria-disabled="true" title="Coming soon">
          Sign in
        </Button>
        <Button type="button" aria-disabled="true" title="Coming soon">
          Sign up
        </Button>
      </NavbarEnd>
    </Navbar>
  )
}
