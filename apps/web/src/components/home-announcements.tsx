"use client"

import { useState } from "react"
import { AnnouncementBar } from "@pbgo/ui/platform/announcement-bar"

/** An announcement as the home draws it. `link` is where the arrow leads, already chosen. */
export type HomeAnnouncement = { id: string; title: string; message: string; tone: "info" | "success" | "alert"; dismissible: boolean; link: { href: string; label: string } | null }

/**
 * The announcements at the top of the signed-in home: a slim bar each, in the middle (`AnnouncementBar`), with its title and, when it leads somewhere, an arrow; its message is left to screen readers. When the Studio says it can be dismissed it has a button that closes it.
 * Closing one keeps nothing: it comes back with the next page, since the platform stores nothing on the device for it. Nothing is drawn when there is none.
 */
export function HomeAnnouncements({ items }: { items: readonly HomeAnnouncement[] }) {
  const [closed, setClosed] = useState<ReadonlySet<string>>(new Set())
  const shown = items.filter((item) => !closed.has(item.id))
  if (shown.length === 0) return null
  return (
    <section aria-label="Announcements" className="flex w-full flex-col items-center gap-2 px-gutter pb-6">
      {shown.map((item) => (
        <AnnouncementBar
          key={item.id}
          title={item.title}
          message={item.message}
          tone={item.tone}
          href={item.link?.href}
          linkLabel={item.link?.label}
          onDismiss={item.dismissible ? () => setClosed(new Set([...closed, item.id])) : undefined}
        />
      ))}
    </section>
  )
}
