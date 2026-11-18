"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { useAccount } from "@pbgo/accounts/client"
import { isDemoAccount } from "@pbgo/accounts/demo"
import { panelOf } from "@pbgo/core/lib/friends-view"
import { PARTY_POLL_MS, partyKey, partyStep, type PartyTable } from "@pbgo/core/lib/party"
import { toast } from "@pbgo/ui/platform/sonner"
import { onPartyEnded, readParty, setParty, usePartyTable } from "@/lib/party"
import { useSocialRead } from "@/lib/social-store"
import { enterBoard } from "@/lib/table-door"
import { useJoinTable } from "./join-table"

/** Sits the member down at the table of their group, once, in the tab they have open and with no press: a seat is the secret of this browser's own cookie, so only it can take it. It is a component only because the join of a game is a hook of that game (`useJoinTable`). */
function JoinParty({ table, leader, onDone }: { table: PartyTable; leader: string | null; onDone: (table: PartyTable) => void }) {
  const { join, dialogs } = useJoinTable(table.game, true, { stay: true })
  const started = useRef(false)
  useEffect(() => {
    if (started.current) return
    started.current = true
    void join(table.code)
      .then((sat) => {
        if (!sat) return
        toast.success(
          leader ? (
            <>
              <span className="ph-mask">{leader}</span> opened a table for your group. You are at it.
            </>
          ) : (
            "You joined the table of your group."
          ),
        )
        return readParty()
      })
      .finally(() => onDone(table))
  }, [join, table, leader, onDone])
  return <>{dialogs}</>
}

/**
 * Keeps the table that the leader of the member's group opened for it (PLT-141, `lib/party.ts`) on every page of the hub: the layout mounts it once, next to the navbar, and it draws nothing but the windows a join may need (the date of birth of a game for adults). While the member is in a
 * group it asks the server for the table of the group every few seconds, from a tab in view (and at once when the tab comes back into view). What it does about what it finds is `partyStep`: a table that waits and that the member does not sit at is sat down at with the game's own join
 * route, once and with no press (a table that was refused is not tried again: the member was told why in a toast, and it is the same table every time); a table in its ready check that the member sits at takes them to its board, where everybody says they are there, and the leader too, from the home;
 * a table that its leader cancelled, which the member sat at, is said gone. The presence beat (`PresenceBeat`) stays the safety net of the start. Nothing for a guest or the demo account of development, whose group is made up by the browser.
 */
export function PartySync() {
  const state = useAccount()
  const router = useRouter()
  const member = state.status === "signed-in" && !isDemoAccount(state.account)
  // The group is the social state's, which the panel of the navbar keeps fresh: a page that has no panel does not ask for the table, and a member in no group has none
  const social = useSocialRead()
  const group = member && social ? panelOf(social).group : null
  const inGroup = group !== null
  const leader = group?.members.find((candidate) => candidate.leader && !candidate.you)?.nickname ?? null
  const table = usePartyTable()
  // The tables this tab tried to sit at (a refusal was told in a toast, and the table is the same at every read), and the board it was taken to: each only once
  const [tried, setTried] = useState<ReadonlySet<string>>(new Set())
  const entered = useRef<string | null>(null)

  // The table is asked for while the member is in a group, from a tab in view; a member who leaves their group has none
  useEffect(() => {
    if (!inGroup) {
      setParty(null)
      return
    }
    const ask = () => {
      if (document.visibilityState === "visible") void readParty()
    }
    ask()
    const timer = setInterval(ask, PARTY_POLL_MS)
    document.addEventListener("visibilitychange", ask)
    return () => {
      clearInterval(timer)
      document.removeEventListener("visibilitychange", ask)
    }
  }, [inGroup])

  const step = partyStep(inGroup ? table : null, tried)
  useEffect(() => {
    if (table && step === "enter" && entered.current !== partyKey(table)) {
      entered.current = partyKey(table)
      enterBoard(router, table.game, table.code)
    }
  }, [step, table, router])

  // The member sat at a table that its leader cancelled
  useEffect(() => onPartyEnded(() => toast.info("The game of your group was cancelled.")), [])

  return step === "join" && table ? <JoinParty key={partyKey(table)} table={table} leader={leader} onDone={(done) => setTried((all) => new Set(all).add(partyKey(done)))} /> : null
}
