"use client"

import type { ReactNode } from "react"
import { useAccount } from "@pbgo/accounts/client"
import { HudDockProvider, type HudMenu } from "@pbgo/core/components/game/hud-dock"
import { SiteSocial } from "@/components/site-social"

/**
 * The dock of the visitor's social panel at the top right of a game's screen, the one the hub's navbar has, whose picture opens the menu of the game (core's `HudMenu`: its sound, its setup, its rules, the way out…) above the pages of
 * their account, which keeps their language, their cookies and the legal notice (`site` is not drawn). A visitor who is not signed in has no friends to see and no account: core draws their picture alone, with the menu of the game and
 * those three (`fallback`). While the browser has not read its session the place is kept and nothing is drawn, so that a signed-in visitor never sees the bar change.
 */
function GameDock({ menu, fallback }: { menu: HudMenu; fallback: ReactNode }) {
  const account = useAccount()
  if (account.status === "loading") return <div aria-hidden="true" className="h-14" />
  if (account.status === "signed-out") return fallback
  return (
    <>
      <SiteSocial account={account.account} game={menu.game} />
      {menu.windows}
    </>
  )
}

/** Gives core the dock of the app for the screens of a game (`HudDockProvider`), mounted by the layout of the games. */
export function GameDockProvider({ children }: { children: ReactNode }) {
  return <HudDockProvider value={GameDock}>{children}</HudDockProvider>
}
