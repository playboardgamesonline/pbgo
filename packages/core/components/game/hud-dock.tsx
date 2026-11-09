"use client"

import { createContext, useContext, type ComponentType, type ReactNode } from "react"
import { cn } from "@pbgo/ui/utils"

/**
 * What a game's screen puts in the menu of the visitor's picture, at the top right, in the platform's look, as rows (a `DropdownMenuItem` each, to be drawn inside a `DropdownMenuContent`) and the windows they open. `game` is what
 * everyone has: the sound, the setup, the rules, the feedback and the way out. `site` is what a member keeps in their account (their language, the cookies, the legal notice): only a visitor who is not signed in has it in the menu, so
 * the dock of a member does not draw it. A menu unmounts its rows when it closes, so the `windows` are not inside it: the page that draws the menu draws them too, next to it, and they stay mounted.
 */
export type HudMenu = { game: ReactNode; site: ReactNode; windows: ReactNode }

/**
 * What stands at the top right of a game's screen, in the platform's look: the dock of the visitor's social panel (their friends, their messages), whose picture opens the menu of the game beside the pages of their account. Only the app can
 * draw the dock, since it knows the account and the friends, so it gives core a component through `HudDockProvider` (`GameDock` of apps/web). `menu` is what core wants in the menu of the picture, `fallback` what to draw instead when
 * there is no dock to show (a visitor who is not signed in, a page whose app gave none, such as the gamemaster's preview): the picture alone, in a bar, with the same menu.
 */
export type HudDock = ComponentType<{ menu: HudMenu; fallback: ReactNode }>

const HudDockContext = createContext<HudDock | null>(null)

export const HudDockProvider = HudDockContext.Provider

export function useHudDock() {
  return useContext(HudDockContext)
}

/** The bar of the picture alone, the dock's size and look, for a screen that has no dock. */
export function HudBar({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("platform pointer-events-auto flex h-14 items-center gap-1 rounded-2xl border glass px-2 font-sans text-foreground shadow-surface", className)}>{children}</div>
  )
}
