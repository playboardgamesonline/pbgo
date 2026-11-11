"use client"

import { createContext, useContext } from "react"

/**
 * What the "Continue" of the end screen does: it leaves the finished table and goes on to the platform. `GameClient` gives it, since it owns the leaving and the navigation (and the screen that says the player is on their way); the menu of the game's
 * "Leave" does the same on a table that is over. Null where there is no table to leave, as in the admin's preview of a board: the button is then off.
 */
const ContinueContext = createContext<(() => void) | null>(null)

export const ContinueProvider = ContinueContext.Provider

export function useContinue(): (() => void) | null {
  return useContext(ContinueContext)
}
