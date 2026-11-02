"use client"

import { useEffect, useState } from "react"
import { QueueButton, QueueCard, QueuePill } from "@pbgo/ui/platform/queue"
import { queueSeconds } from "@pbgo/ui/queue"

// The pieces of the queue's specimens that need the browser: a button that keeps a queue of its own, and the card and the pill, whose cross is a function a server component cannot hand them (`queue-specimen.tsx`).

/** A button with a queue of its own: `startAt` is how many seconds it has already waited when the page opens, none for a button that waits to be pressed. A press starts a count and the cross stops it. */
export function QueueDemo({ disabled, startAt }: { disabled?: boolean; startAt?: number }) {
  const [since, setSince] = useState<number | null>(() => (startAt === undefined ? null : Date.now() - startAt * 1000))
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (since === null) return
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [since])
  return (
    <QueueButton
      searching={since !== null}
      seconds={since === null ? 0 : queueSeconds({ since }, now)}
      disabled={disabled}
      onSearch={() => {
        setNow(Date.now())
        setSince(Date.now())
      }}
      onCancel={() => setSince(null)}
    >
      Find a game
    </QueueButton>
  )
}

/** The card in a panel and the pill in a bar, a moment into the wait. The cross does nothing here. */
export function QueueCardAndPillDemo() {
  return (
    <>
      <div className="w-80 max-w-full rounded-4xl border glass p-4 shadow-overlay">
        <QueueCard game="Courtisans" seconds={42} onCancel={() => {}} />
      </div>
      <div className="flex h-14 w-fit items-center rounded-2xl border glass p-1.5 shadow-overlay">
        <QueuePill game="Courtisans" seconds={42} onCancel={() => {}} />
      </div>
    </>
  )
}
