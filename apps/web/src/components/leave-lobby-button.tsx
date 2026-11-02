"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Logout01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { LobbySideButton } from "@pbgo/ui/platform/lobby-panel"

// The secondary button beside the main one at the bottom of the visitor's lobby, which leaves it, whoever opened it. The game's own route takes them out of the table (`POST /api/<slug>/games/<code>/leave`, which the in-game lobby uses too: another host
// is made of the first player left, and a table that is being played cannot be left that way, so a game in play has no such button), then the page asks again where the visitor sits. It is an icon alone: its name is for screen readers and for the
// pointer (`title`).

export function LeaveLobbyButton({ slug, code }: { slug: string; code: string }) {
  const router = useRouter()
  const [leaving, setLeaving] = useState(false)
  return (
    <LobbySideButton
      type="button"
      aria-label="Leave the lobby"
      title="Leave the lobby"
      disabled={leaving}
      onClick={async () => {
        setLeaving(true)
        try {
          await fetch(`/api/${slug}/games/${code}/leave`, { method: "POST" })
        } finally {
          setLeaving(false)
          router.refresh()
        }
      }}
    >
      <HugeiconsIcon icon={Logout01Icon} strokeWidth={2} aria-hidden="true" />
    </LobbySideButton>
  )
}
