"use client"

import { QueueButton } from "@pbgo/ui/platform/queue"
import { joinQueue, leaveQueue, useQueue, useQueueSeconds } from "@/lib/matchmaking"

// The main button of a game's page, "Find a table". A press puts the visitor in the queue of that game (`lib/matchmaking.ts`, where the queue is kept for every page of the hub) and the button becomes a counter of the time they wait
// with a cross that stops it (`QueueButton`). A visitor looks for one table at a time: on the page of another game the button is the one that starts a search again, and the press replaces the first. The social panel shows the same wait.
// A game that cannot be played yet has the button disabled.

export function FindTableButton({ slug, name, disabled }: { slug: string; name: string; disabled?: boolean }) {
  const queue = useQueue()
  const waiting = queue?.slug === slug ? queue : null
  const seconds = useQueueSeconds(waiting)
  return (
    <QueueButton searching={waiting !== null} seconds={seconds} disabled={disabled} onSearch={() => joinQueue({ slug, name })} onCancel={leaveQueue}>
      Find a table
    </QueueButton>
  )
}
