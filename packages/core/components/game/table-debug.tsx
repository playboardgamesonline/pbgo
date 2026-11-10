"use client"

import { toast } from "sonner"
import { useApi } from "../../lib/binding-context"
import type { SavedState } from "../../lib/game-types"
import { useGame } from "./context"
import { useDebugFolder } from "./debug-folders"

/**
 * The tools of the debug panel that every board has (the GAME tab, folder Table): keep the state of the table (a `SavedState`, copied to the clipboard) and load one back from the clipboard into this table. Nothing is drawn: the folder is
 * made by the panel. On a production deployment nothing is registered (`registerDebugFolder`), and the routes behind the buttons answer 403 anyway.
 *
 * A saved state is portable: its seats are mapped on the seats of the table it is loaded into, in the same order, so a situation copied from a 5-seat table can be loaded into any other 5-seat table of the game.
 */
export function TableDebug() {
  const api = useApi()
  const { game } = useGame()

  const fail = (error: unknown) => toast.error(error instanceof Error ? error.message : String(error))

  useDebugFolder(
    {
      folder: "Table",
      tab: "GAME",
      order: 5,
      schema: ({ button }) => ({
        "Copy state": button(async () => {
          try {
            await navigator.clipboard.writeText(JSON.stringify(await api.debugState(game.code)))
            toast.success("State copied")
          } catch (error) {
            fail(error)
          }
        }),
        "Load state from the clipboard": button(async () => {
          try {
            await api.debugLoad(game.code, JSON.parse(await navigator.clipboard.readText()) as SavedState)
            toast.success("State loaded")
          } catch (error) {
            fail(error)
          }
        }),
      }),
    },
    [game.code],
  )
  return null
}
