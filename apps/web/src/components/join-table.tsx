"use client"

import { useCallback, useRef, useState, type ReactNode } from "react"
import { usePathname, useRouter } from "next/navigation"
import { createApi } from "@pbgo/core/lib/api"
import { seatedPath } from "@pbgo/core/lib/site-url"
import { TableEntry, type TableEntryProps } from "@pbgo/ui/platform/table-entry"
import { enterBoard } from "@/lib/table-door"
import { useAgeGate } from "./age-gate"
import { useSitDown } from "./sit-down"

// Sitting at a table of a game from a list of the hub (PLT-21, PLT-106), the one way for every list: the Join button of a row and the plus of any free seat of it, on a game's page, on the Tables tab and on the home. A member sits down as their account, a guest under the nickname
// they are asked once (`useSitDown`); a table that asks for the date of birth asks for it (`useAgeGate`). The game's own route sits them down (`POST /api/<slug>/games/<code>/join`) and answers with the table, which says where they go: the lobby, `/game/<slug>/<code>`, and,
// when their seat was the last and the table has begun, its board (`seatedPath`). A refusal (a rank or a language the table asks, a table that filled, one that began, the date of birth) is told in a toast in the platform's words, and the page asks for its tables again, since the one that
// was refused is the one that changed.

/**
 * `join(code)` sits the visitor at the table `code` of the game `slug` and takes them to it (it answers whether they sit there now); `joining` is true while it is being done, and `dialogs` are the windows it may open (the nickname, the date of birth), to render beside the list.
 * With `stay` it takes them nowhere while the table waits (the member whose group's leader opened it sits down in the tab they have open, PLT-141) and only to its board when their seat was the last and the table has begun; a refusal does not draw the page again.
 */
export function useJoinTable(slug: string, signedIn: boolean, { stay = false }: { stay?: boolean } = {}) {
  const router = useRouter()
  const pathname = usePathname()
  const { sitDown, dialog } = useSitDown(slug, signedIn)
  const { guard, fail, dialog: ageDialog } = useAgeGate()
  const [joining, setJoining] = useState(false)
  // Two presses before the first answer are one join
  const busy = useRef(false)

  const join = useCallback(
    async (code: string): Promise<boolean> => {
      if (busy.current) return false
      busy.current = true
      try {
        const who = await sitDown()
        if (!who) return false
        setJoining(true)
        // A table with an expansion for adults asks for the date of birth when it is missing (PLT-125): the visitor gives it, and the join goes on
        const table = await guard(() => createApi(slug).join(code, who))
        if (table.status !== "lobby") enterBoard(router, slug, table.code)
        else if (!stay) {
          const lobby = seatedPath(slug, table.code, table.status)
          // Already on the page of this table: it is drawn again, with the visitor's seat in it
          if (pathname.toLowerCase() === lobby.toLowerCase()) router.refresh()
          else router.push(lobby)
        }
        return true
      } catch (error) {
        fail(error)
        if (!stay) router.refresh()
        return false
      } finally {
        busy.current = false
        setJoining(false)
      }
    },
    [slug, stay, sitDown, guard, fail, router, pathname],
  )

  const dialogs: ReactNode = (
    <>
      {dialog}
      {ageDialog}
    </>
  )
  return { join, joining, dialogs }
}

/**
 * A row of a list that spans games or leads to the table's page (the Tables tab, the home), with its Join button and the plus of its free seats sitting the visitor down at the table `code` of `game` (`useJoinTable`) instead of leading to it. A row that is not
 * one to join (the visitor's own table, a table that is full or played) is drawn as it is.
 */
export function JoinableTableEntry({ game, code, signedIn, ...entry }: TableEntryProps & { game: string; code: string; signedIn: boolean }) {
  const { join, dialogs } = useJoinTable(game, signedIn)
  return (
    <>
      <TableEntry {...entry} onJoin={!entry.mine && entry.action === "join" ? () => void join(code) : undefined} />
      {dialogs}
    </>
  )
}
