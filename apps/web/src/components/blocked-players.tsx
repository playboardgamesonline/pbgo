"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { UserBlock01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import type { Person } from "@pbgo/core/lib/friends"
import { tagText } from "@pbgo/accounts"
import { Avatar, AvatarFallback, AvatarImage } from "@pbgo/ui/platform/avatar"
import { Button } from "@pbgo/ui/platform/button"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@pbgo/ui/platform/empty"
import { Item, ItemActions, ItemContent, ItemMedia, ItemTitle } from "@pbgo/ui/platform/item"
import { changeFriends } from "@/components/friend-actions"

/** One blocked player, with the button that lifts the block. */
function BlockedRow({ person }: { person: Person }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  async function unblock() {
    setBusy(true)
    const done = await changeFriends("unblock", { nickname: person.nickname, tag: person.tag })
    setBusy(false)
    if (done) router.refresh()
  }
  return (
    <Item>
      <ItemMedia>
        <Avatar>
          {person.avatarUrl && <AvatarImage src={person.avatarUrl} alt="" referrerPolicy="no-referrer" />}
          <AvatarFallback className="ph-mask">{person.nickname.slice(0, 1).toUpperCase()}</AvatarFallback>
        </Avatar>
      </ItemMedia>
      <ItemContent>
        <ItemTitle>
          <span className="ph-mask">
            {person.nickname}
            <span className="text-muted-foreground">#{tagText(person.tag)}</span>
          </span>
        </ItemTitle>
      </ItemContent>
      <ItemActions>
        <Button type="button" variant="outline" onClick={unblock} disabled={busy}>
          Unblock
        </Button>
      </ItemActions>
    </Item>
  )
}

/**
 * The players a member blocked (PLT-23), in the Data & Privacy settings: each with the button that lifts the block, and the empty state while there are none. The list is the one the page read on the server; an unblock is sent and the page reads it again.
 * The demo account of development lists made-up ones, and its unblock says it is done.
 */
export function BlockedPlayers({ blocked }: { blocked: readonly Person[] }) {
  if (blocked.length === 0) {
    return (
      <Empty className="border p-6">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <HugeiconsIcon icon={UserBlock01Icon} strokeWidth={2} aria-hidden="true" />
          </EmptyMedia>
          <EmptyTitle>No one blocked</EmptyTitle>
          <EmptyDescription>The players you block cannot write to you or invite you. They are listed here.</EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }
  return (
    <div className="flex flex-col gap-2">
      {blocked.map((person) => (
        <BlockedRow key={`${person.nickname.toLowerCase()}#${person.tag}`} person={person} />
      ))}
    </div>
  )
}
