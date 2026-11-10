"use client"

import { tagText, type Account } from "@pbgo/accounts"
import { cn } from "@pbgo/ui/utils"
import { useOwnHandle } from "@/lib/use-own-handle"

/**
 * The member's own name in the navbar (account menu, panel head): the profile's nickname and, once the server has said it, the tag (`Alex#0042`). The name gives way when there is no room, never the tag. Until the tag is known it shows the account's name alone.
 */
export function OwnName({ account, className }: { account: Account; className?: string }) {
  const handle = useOwnHandle(account)
  return (
    <span className={cn("ph-mask flex max-w-full min-w-0 items-baseline", className)}>
      <span className="truncate">{handle?.nickname ?? account.nickname}</span>
      {handle?.tag != null && <span className="shrink-0 text-muted-foreground">#{tagText(handle.tag)}</span>}
    </span>
  )
}
