"use client"

import * as React from "react"
import { shownIn, slotsIn } from "../achievements"
import { cn } from "../utils"
import { AchievementBadge } from "./achievement-tile"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "./dialog"
import { HoverCard, HoverCardContent, HoverCardTrigger } from "./hover-card"

// The achievements a visitor has earned, as one row of badges for a place with the room of a row (a cell of the bar of a game's page): each badge 4.75rem wide, the latest first, and as many as the row holds. When it holds fewer than there are, its last
// place is the number of those that are left ("+7", with no outline of its own: a round background under the pointer says that it can be pressed): the row is a window onto the achievements, not the list of them. Each badge and the tile open the same window, which lists every one with its picture, its name, what it was for and the day, and scrolls when
// they do not fit, so that a touch, which has no hover, reaches what the card under the pointer says (the name, what it was for and the day, on each badge). The room is measured in the browser, the row's width over the width of a badge and its gap
// (`slotsIn`), and kept as the window is resized; the server, and the first paint, draw three places, which is what the row holds where the bar of a game's page has its four cells in one line. A badge is drawn from the achievement's id (`AchievementBadge`).

type AchievementStripItem = {
  id: string
  name: string
  /** What it was for ("Play 20 games."). */
  description: string
  /** The day it was earned, already written ("8 Oct 2026"). */
  date: string
}

type AchievementStripProps = Omit<React.ComponentProps<"ul">, "children"> & {
  /** What they have earned, the latest first. */
  achievements: readonly AchievementStripItem[]
  /** How many there are to earn in all, when that is known ("9 of 12"). */
  total?: number
}

/** The places of the row until it is measured, and on the server. */
const FIRST_SLOTS = 3

/** What a badge and the tile are pressed with: the ring that shows where the keyboard is. */
const PRESS = "block cursor-pointer rounded-2xl outline-none focus-visible:ring-3 focus-visible:ring-ring/30"

function AchievementStrip({ achievements, total = 0, className, ...props }: AchievementStripProps) {
  const row = React.useRef<HTMLUListElement>(null)
  const [slots, setSlots] = React.useState(FIRST_SLOTS)
  const empty = achievements.length === 0

  React.useLayoutEffect(() => {
    const element = row.current
    if (!element) return
    const measure = () => {
      const place = element.firstElementChild
      if (place) setSlots(slotsIn(element.clientWidth, place.getBoundingClientRect().width, parseFloat(getComputedStyle(element).columnGap) || 0))
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    return () => observer.disconnect()
  }, [empty])

  if (empty) return null
  const { shown, hidden } = shownIn(achievements.length, slots)
  return (
    <Dialog>
      <ul ref={row} data-slot="achievement-strip" aria-label="Your achievements" className={cn("flex gap-1", className)} {...props}>
        {achievements.slice(0, shown).map(({ id, name, description, date }) => (
          <li key={id}>
            <HoverCard>
              <HoverCardTrigger asChild>
                <DialogTrigger asChild>
                  <button type="button" className={PRESS}>
                    <AchievementBadge seed={id} className="size-19" />
                    <span className="sr-only">
                      {name}: {description} Earned {date}.
                    </span>
                  </button>
                </DialogTrigger>
              </HoverCardTrigger>
              <HoverCardContent className="w-64">
                <p className="font-heading">{name}</p>
                <p className="mt-1 text-sm text-muted-foreground">{description}</p>
                <p className="mt-3 text-xs text-muted-foreground">Earned {date}</p>
              </HoverCardContent>
            </HoverCard>
          </li>
        ))}
        {hidden > 0 && (
          <li>
            <DialogTrigger asChild>
              <button type="button" className={cn(PRESS, "flex size-19 items-center justify-center rounded-full transition-colors duration-fast hover:bg-accent")}>
                <span aria-hidden="true" className="font-heading text-xl tabular-nums">
                  +{hidden}
                </span>
                <span className="sr-only">Show all {achievements.length} achievements</span>
              </button>
            </DialogTrigger>
          </li>
        )}
      </ul>
      <DialogContent className="gap-0 overflow-hidden p-0">
        <DialogHeader className="p-6 pr-16">
          <DialogTitle>Achievements</DialogTitle>
          <DialogDescription>
            {total >= achievements.length ? `${achievements.length} of ${total} earned` : `${achievements.length} earned`}, the latest first.
          </DialogDescription>
        </DialogHeader>
        <ul className="flex max-h-[min(28rem,60svh)] flex-col overflow-y-auto overscroll-contain border-t">
          {achievements.map(({ id, name, description, date }) => (
            <li key={id} className="flex items-center gap-4 border-b px-6 py-4 last:border-b-0">
              <AchievementBadge seed={id} className="size-16" />
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="font-heading">{name}</span>
                <span className="text-sm text-muted-foreground">{description}</span>
                <span className="mt-1 text-xs text-muted-foreground">Earned {date}</span>
              </div>
            </li>
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  )
}

export { AchievementStrip }
export type { AchievementStripItem, AchievementStripProps }
