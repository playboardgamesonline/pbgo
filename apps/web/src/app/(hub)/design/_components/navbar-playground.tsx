"use client"

import { useState } from "react"
import { Avatar, AvatarFallback } from "@pbgo/ui/platform/avatar"
import { Logo } from "@pbgo/ui/platform/logo"
import { Navbar, NavbarBrand, NavbarEnd, NavbarStart, NavbarTab, NavbarTabs } from "@pbgo/ui/platform/navbar"

const TABS = [
  { id: "games", label: "Games" },
  { id: "tables", label: "Tables" },
  { id: "tournaments", label: "Tournaments" },
  { id: "whats-new", label: "What's New" },
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
          {TABS.map((tab) => (
            <NavbarTab key={tab.id} href="#navbar" current={current === tab.id} onClick={go(tab.id)}>
              {tab.label}
            </NavbarTab>
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
