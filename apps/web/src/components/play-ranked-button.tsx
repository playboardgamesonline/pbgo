"use client"

import { PlayIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { QueueButton } from "@pbgo/ui/platform/queue"
import { joinQueue, leaveQueue, useQueue, useQueueSeconds } from "@/lib/matchmaking"

// The main button of a game's page, "Play ranked", with a play icon at its left. A press puts the visitor in the queue of that game (`lib/matchmaking.ts`, where the queue is kept for every page of the hub) and the button becomes a counter of the time they wait
// with a cross that stops it (`QueueButton`). A visitor looks for tables through one search at a time: the button counts when that search is a ranked one that has this game among its games, whichever page began it (the signed-in home searches several games at once),
// and on any other search it is the one that starts a ranked search of this game, in place of the first. The social panel shows the same wait. A game that cannot be played yet has the button disabled.

export function PlayRankedButton({ slug, name, disabled }: { slug: string; name: string; disabled?: boolean }) {
  const queue = useQueue()
  const waiting = queue?.mode === "ranked" && queue.games.some((game) => game.slug === slug) ? queue : null
  const seconds = useQueueSeconds(waiting)
  return (
    <QueueButton searching={waiting !== null} seconds={seconds} disabled={disabled} onSearch={() => joinQueue([{ slug, name }], "ranked")} onCancel={leaveQueue}>
      <HugeiconsIcon icon={PlayIcon} strokeWidth={2} data-icon="inline-start" aria-hidden="true" />
      Play ranked
    </QueueButton>
  )
}
