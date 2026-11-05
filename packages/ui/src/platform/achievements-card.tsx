"use client"

import * as React from "react"
import { ArrowRight01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { slotsIn } from "../achievements"
import { AchievementBadge } from "./achievement-tile"
import { Button } from "./button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "./dialog"
import { HoverCard, HoverCardContent, HoverCardTrigger } from "./hover-card"
import { StatBarItem, StatBarNote, StatBarValue } from "./stat-bar"

// The achievements a visitor has earned, as a card of the stat bar (`StatBarItem`) for a page that shows what a visitor did: the badges in up to two rows of 4.75rem, the latest first, as many as the card holds, and at the right of its label a "View all" button. The count of what is earned, over how many there are
// when that is known, is under the badges ("9/12"), not in the label. The button and each badge open the same window, which lists every one with its picture, its name, what it was for and the day, and scrolls when they do not fit, so that a touch, which has no hover, reaches what the card under the pointer says on a badge (the
// name, what it was for and the day). The room is measured in the browser, the row's width over the width of a badge and its gap (`slotsIn`), and kept as the card is resized; the server, and the first paint, draw three badges to a row. A visitor who has earned none has "None yet" and no button. A badge is drawn from the
// achievement's id (`AchievementBadge`).

type AchievementsCardItem = {
  id: string
  name: string
  /** What it was for ("Play 20 games."). */
  description: string
  /** The day it was earned, already written ("8 Oct 2026"). */
  date: string
}

type AchievementsCardProps = Omit<React.ComponentProps<typeof StatBarItem>, "label" | "action" | "children"> & {
  /** What they have earned, the latest first. */
  achievements: readonly AchievementsCardItem[]
  /** How many there are to earn in all, when that is known ("9 of 12"). */
  total?: number
}

/** How many rows of badges the card holds. */
const ROWS = 2

/** The badges to a row until the card is measured, and on the server. */
const FIRST_SLOTS = 3

/** What a badge is pressed with: the ring that shows where the keyboard is. */
const PRESS = "block cursor-pointer rounded-2xl outline-none focus-visible:ring-3 focus-visible:ring-ring/30"

function AchievementsCard({ achievements, total = 0, ...props }: AchievementsCardProps) {
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

  if (empty) {
    return (
      <StatBarItem label="Achievements" {...props}>
        <StatBarValue>None yet</StatBarValue>
      </StatBarItem>
    )
  }
  return (
    <Dialog>
      <StatBarItem
        label="Achievements"
        action={
          <DialogTrigger asChild>
            <Button variant="outline" size="sm">
              View all
              <span className="sr-only"> achievements</span>
              <HugeiconsIcon icon={ArrowRight01Icon} strokeWidth={2} data-icon="inline-end" aria-hidden="true" />
            </Button>
          </DialogTrigger>
        }
        {...props}
      >
        <ul ref={row} data-slot="achievement-badges" aria-label="Your achievements" className="flex flex-wrap gap-1">
          {achievements.slice(0, slots * ROWS).map(({ id, name, description, date }) => (
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
        </ul>
        <StatBarNote className="text-sm leading-5 tabular-nums">
          {total >= achievements.length && total > 0 ? (
            <>
              {achievements.length}/{total}
              <span className="sr-only"> earned</span>
            </>
          ) : (
            `${achievements.length} earned`
          )}
        </StatBarNote>
      </StatBarItem>
      <DialogContent className="gap-0 overflow-hidden p-0">
        <DialogHeader className="p-6 pr-16">
          <DialogTitle>Achievements</DialogTitle>
          <DialogDescription>{total >= achievements.length ? `${achievements.length} of ${total} earned` : `${achievements.length} earned`}, the latest first.</DialogDescription>
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

export { AchievementsCard }
export type { AchievementsCardItem, AchievementsCardProps }
