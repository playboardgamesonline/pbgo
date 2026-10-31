"use client"

import { Fragment, useState } from "react"
import { Avatar, AvatarFallback } from "@pbgo/ui/platform/avatar"
import { Logo } from "@pbgo/ui/platform/logo"
import { Navbar, NavbarBrand, NavbarEnd, NavbarSeparator, NavbarStart, NavbarTab, NavbarTabs } from "@pbgo/ui/platform/navbar"

const TABS = [
  { id: "games", label: "Games", group: "play" },
  { id: "tables", label: "Tables", group: "play" },
  { id: "tournaments", label: "Tournaments", group: "play" },
  { id: "about", label: "About", group: "about" },
  { id: "pricing", label: "Pricing", group: "about" },
] as const

type Current = "home" | (typeof TABS)[number]["id"]

/**
 * A navbar whose logo and tabs can be clicked: the fill behind the current item glides from one to the next, with the spring of `@pbgo/ui/motion`,
 * the way it does on the hub when the visitor goes from page to page. On a phone the tabs leave the bar (`md`) and only the logo is left.
 */
export function NavbarPlayground() {
  const [current, setCurrent] = useState<Current>("home")
  const go = (id: Current) => (event: React.MouseEvent) => {
    event.preventDefault()
    setCurrent(id)
  }
  return (
    <Navbar>
      <NavbarStart>
        <NavbarBrand href="#navbar" aria-label="Home" current={current === "home"} onClick={go("home")}>
          <Logo className="h-6" />
        </NavbarBrand>
        <NavbarTabs aria-label="Main">
          {TABS.map((tab, index) => (
            <Fragment key={tab.id}>
              {index > 0 && TABS[index - 1].group !== tab.group && <NavbarSeparator />}
              <NavbarTab href="#navbar" current={current === tab.id} onClick={go(tab.id)}>
                {tab.label}
              </NavbarTab>
            </Fragment>
          ))}
        </NavbarTabs>
      </NavbarStart>
      <NavbarEnd>
        <Avatar className="size-10">
          <AvatarFallback>AL</AvatarFallback>
        </Avatar>
      </NavbarEnd>
    </Navbar>
  )
}
