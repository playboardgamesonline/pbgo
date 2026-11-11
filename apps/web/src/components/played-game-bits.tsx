import { HourglassIcon, UserMultipleIcon, ZapIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { lengthOf } from "@pbgo/ui/results"
import { PACES } from "@pbgo/ui/tables"
import { cn } from "@pbgo/ui/utils"

// The small facts of a game that was played, said the same wherever its row is drawn: the recent games of a game's page (`GamePlayerBar`) and the games of a profile and of the home (`GameRecord`). The icon, its place before the figure and the words
// are the platform's one language for them: how long it lasted (an hourglass), how many sat at the table (a group), the speed (a lightning bolt, "Slow", "Normal", "Fast", "No timer", "Async").

/** How long a game lasted, small and quiet, with an hourglass at its left (the head's, which says how long a game takes): the hourglass is centred on the line and the figure stands on the baseline of the text around it. */
export function Duration({ seconds, className }: { seconds: number; className?: string }) {
  return (
    <span className={cn("flex items-baseline gap-1 text-xs text-muted-foreground tabular-nums", className)}>
      <HugeiconsIcon icon={HourglassIcon} strokeWidth={2} className="size-3.5 shrink-0 self-center" aria-hidden="true" />
      <span>{lengthOf(seconds)}</span>
    </span>
  )
}

/** How many players sat at the table, the group icon before the figure; screen readers say it in words. */
export function PlayerCount({ count, className }: { count: number; className?: string }) {
  return (
    <span className={cn("flex shrink-0 items-center gap-1", className)}>
      <HugeiconsIcon icon={UserMultipleIcon} strokeWidth={2} className="size-3.5 shrink-0" aria-hidden="true" />
      <span aria-hidden="true">{count}</span>
      <span className="sr-only">{count === 1 ? "1 player" : `${count} players`}</span>
    </span>
  )
}

/** The words for the speed of a table (`PACES`), whatever it was: the value itself for one the list does not know. */
export const paceLabel = (value: string): string => PACES.find((pace) => pace.value === value)?.label ?? value

/** The speed a game was played at, a lightning bolt and its word, whatever the speed was. */
export function PaceFact({ value, label = paceLabel(value), className }: { value: string; label?: string; className?: string }) {
  return (
    <span data-pace={value} className={cn("flex shrink-0 items-center gap-1", className)}>
      <HugeiconsIcon icon={ZapIcon} strokeWidth={2} className="size-3.5 shrink-0" aria-hidden="true" />
      <span>{label}</span>
    </span>
  )
}
