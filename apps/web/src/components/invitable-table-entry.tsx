"use client"

import { TableEntry, type TableEntryProps } from "@pbgo/ui/platform/table-entry"
import { useInviteFriend } from "./invitation-actions"

/** A row of the member's own lobby on the home, whose free seats invite a friend to it: "Invite a friend" in their menu opens the picker (PLT-109). */
export function InvitableTableEntry({ game, code, ...entry }: TableEntryProps & { game: string; code: string }) {
  const picker = useInviteFriend()
  return (
    <>
      <TableEntry {...entry} onInvite={() => picker.invite(game, code)} />
      {picker.dialog}
    </>
  )
}
