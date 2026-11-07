"use client"

import { useState } from "react"
import { Cancel01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { Alert, AlertDescription, AlertTitle } from "@pbgo/ui/platform/alert"
import { Button } from "@pbgo/ui/platform/button"

/** An announcement as the home draws it. `link` is where "Read more" leads, already chosen. */
export type HomeAnnouncement = { id: string; title: string; message: string; tone: "info" | "success" | "alert"; dismissible: boolean; link: { href: string; label: string } | null }

/**
 * The announcements at the top of the signed-in home: a message bar each (an alert for the tone `alert`, a green rim for `success`), with its link and, when the Studio says it can be dismissed, a button that closes it.
 * Closing one keeps nothing: it comes back with the next page, since the platform stores nothing on the device for it. Nothing is drawn when there is none.
 */
export function HomeAnnouncements({ items }: { items: readonly HomeAnnouncement[] }) {
  const [closed, setClosed] = useState<ReadonlySet<string>>(new Set())
  const shown = items.filter((item) => !closed.has(item.id))
  if (shown.length === 0) return null
  return (
    <section aria-label="Announcements" className="flex w-full flex-col gap-2 px-gutter pb-6">
      {shown.map((item) => (
        <Alert key={item.id} variant={item.tone === "alert" ? "destructive" : "default"} className={item.tone === "success" ? "relative border-success/40" : "relative"}>
          <AlertTitle>{item.title}</AlertTitle>
          <AlertDescription>
            {item.message}
            {item.link && (
              <>
                {" "}
                <a href={item.link.href} className="underline underline-offset-3 hover:text-foreground">
                  {item.link.label}
                </a>
              </>
            )}
          </AlertDescription>
          {item.dismissible && (
            <Button variant="ghost" size="icon-sm" className="absolute top-2 right-2" aria-label={`Dismiss: ${item.title}`} onClick={() => setClosed(new Set([...closed, item.id]))}>
              <HugeiconsIcon icon={Cancel01Icon} strokeWidth={2} aria-hidden="true" />
            </Button>
          )}
        </Alert>
      ))}
    </section>
  )
}
