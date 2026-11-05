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

// The achievements a visitor has earned, as a card of the stat bar (`StatBarItem`) for a page that shows what a visitor did: the badges, the latest first, and at the right of its label a "See all" button. The count of what is earned, over how many there are when that is known, is in the label, in brackets after its name
// ("Achievements (9/12)"). What the badges do depends on the room that the card gives them, which it asks of its own width (a container, `@min-[19.75rem]`: four badges and three gaps), not of the window. In a card that is narrow (a column of the stat bar, a phone) the badges are in at most two rows of three, 4.75rem each, and when there
// are more than six the sixth place, at the bottom right, is the number of those that are left ("+5": the bare number, no outline, with a round background under the pointer to say that it can be pressed) and the badges are the first five. In a card that has room they are in as many columns as fit, 4.75rem each, up to twelve places,
// and when there are more than twelve the twelfth place is that number. The fewer there are, the bigger each is, up to the room: one or two are 7.5rem, three 6rem, four and more 4.75rem, so that a card with one badge does not look empty (`columnsOf`). The button, the number and each badge open the same window, which lists every one with its picture, its
// name, what it was for and the day, and scrolls when they do not fit, so that a touch, which has no hover, reaches what the card under the pointer says on a badge (the name, what it was for and the day). A visitor who has earned none has "None yet" and no button. A badge is drawn from the achievement's id (`AchievementBadge`).

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

/** The places of the block in a card that is narrow (three to a row, two rows) and in one that has room (as many columns as fit, twelve places at the most). */
const NARROW_PLACES = 6
const ROOMY_PLACES = 12

/**
 * The columns of the block by how many badges there are: one or two are 7.5rem and three 6rem each, in one row, or less when the card has not the room for that (a track that is `minmax(0, ...)` shrinks, and the number of columns is the number of badges, so that three are never two and one); four or more are 4.75rem,
 * as many columns as fit (`auto-fit`, whose count is made of the biggest size a track can have, which is why the bigger sizes do not go through it).
 */
function columnsOf(count: number): string {
  if (count <= 1) return "grid-cols-[minmax(0,7.5rem)]"
  if (count === 2) return "grid-cols-[repeat(2,minmax(0,7.5rem))]"
  if (count === 3) return "grid-cols-[repeat(3,minmax(0,6rem))]"
  return "grid-cols-[repeat(auto-fit,minmax(4.75rem,4.75rem))]"
}

/** What a badge and the number are pressed with: the ring that shows where the keyboard is. */
const PRESS = "block cursor-pointer rounded-2xl outline-none focus-visible:ring-3 focus-visible:ring-ring/30"

/** The number of the achievements that are not drawn ("+5"): the bare number with a round background under the pointer, which opens the window with all of them. */
function MoreButton({ hidden, total }: { hidden: number; total: number }) {
  return (
    <DialogTrigger asChild>
      <button type="button" className={cn(PRESS, "flex aspect-square w-full items-center justify-center rounded-full transition-colors duration-fast hover:bg-accent")}>
        <span aria-hidden="true" className="font-heading text-xl tabular-nums">
          +{hidden}
        </span>
        <span className="sr-only">Show all {total} achievements</span>
      </button>
    </DialogTrigger>
  )
}

function AchievementsCard({ achievements, total = 0, ...props }: AchievementsCardProps) {
  if (achievements.length === 0) {
    return (
      <StatBarItem label="Achievements" {...props}>
        <StatBarValue>None yet</StatBarValue>
      </StatBarItem>
    )
  }
  const narrow = shownIn(achievements.length, NARROW_PLACES)
  const roomy = shownIn(achievements.length, ROOMY_PLACES)
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
        <div className="@container">
          <ul data-slot="achievement-badges" aria-label="Your achievements" className={cn("grid justify-start gap-1", columnsOf(achievements.length))}>
            {achievements.slice(0, roomy.shown).map(({ id, name, description, date }, index) => (
              <li key={id} className={index < narrow.shown ? undefined : "hidden @min-[19.75rem]:block"}>
                <HoverCard>
                  <HoverCardTrigger asChild>
                    <DialogTrigger asChild>
                      <button type="button" className={cn(PRESS, "aspect-square w-full")}>
                        <AchievementBadge seed={id} className="size-full" />
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
            {narrow.hidden > 0 && (
              <li className="@min-[19.75rem]:hidden">
                <MoreButton hidden={narrow.hidden} total={achievements.length} />
              </li>
            )}
            {roomy.hidden > 0 && (
              <li className="hidden @min-[19.75rem]:block">
                <MoreButton hidden={roomy.hidden} total={achievements.length} />
              </li>
            )}
          </ul>
        </div>
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
