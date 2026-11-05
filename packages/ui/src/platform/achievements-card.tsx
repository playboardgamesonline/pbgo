"use client"

import * as React from "react"
import { ArrowRight01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { shownIn } from "../achievements"
import { cn } from "../utils"
import { AchievementBadge } from "./achievement-tile"
import { Button } from "./button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "./dialog"
import { HoverCard, HoverCardContent, HoverCardTrigger } from "./hover-card"
import { StatBarItem, StatBarValue } from "./stat-bar"

// The achievements a visitor has earned, as a card of the stat bar (`StatBarItem`) for a page that shows what a visitor did: the badges in a block of at most two rows of three, 4.75rem each, the latest first, and at the right of its label a "See all" button. The count of what is earned, over how many there
// are when that is known, is in the label, in brackets after its name ("Achievements (9/12)"). When there are more than six, the sixth place, at the bottom right, is the number of those that are left ("+5": the bare number, no outline, with a round background under the pointer to say that it can be pressed) and the
// badges are the first five. The button, the number and each badge open the same window, which lists every one with its picture, its name, what it was for and the day, and scrolls when they do not fit, so that a touch, which has no hover, reaches what the card under the pointer says on a badge (the name, what it
// was for and the day). A visitor who has earned none has "None yet" and no button. A badge is drawn from the achievement's id (`AchievementBadge`).

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

/** The places of the block: three to a row, two rows. */
const PLACES = 6

/** What a badge and the number are pressed with: the ring that shows where the keyboard is. */
const PRESS = "block cursor-pointer rounded-2xl outline-none focus-visible:ring-3 focus-visible:ring-ring/30"

function AchievementsCard({ achievements, total = 0, ...props }: AchievementsCardProps) {
  if (achievements.length === 0) {
    return (
      <StatBarItem label="Achievements" {...props}>
        <StatBarValue>None yet</StatBarValue>
      </StatBarItem>
    )
  }
  const { shown, hidden } = shownIn(achievements.length, PLACES)
  const label = total >= achievements.length && total > 0 ? `Achievements (${achievements.length}/${total})` : `Achievements (${achievements.length})`
  return (
    <Dialog>
      <StatBarItem
        label={label}
        action={
          <DialogTrigger asChild>
            <Button variant="outline" size="sm">
              See all
              <span className="sr-only"> achievements</span>
              <HugeiconsIcon icon={ArrowRight01Icon} strokeWidth={2} data-icon="inline-end" aria-hidden="true" />
            </Button>
          </DialogTrigger>
        }
        {...props}
      >
        <ul data-slot="achievement-badges" aria-label="Your achievements" className="grid w-fit grid-cols-3 gap-1">
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
