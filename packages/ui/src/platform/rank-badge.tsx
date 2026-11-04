import * as React from "react"
import { rankLabel, type Rank } from "../ranks"
import { cn } from "../utils"
import { Badge } from "./badge"

// A player's rank in a game as a small badge: the name of its tier and, but for Legend, its division ("Gold II"). It is plain on purpose: no colour, no icon and no word besides the tier's own, until the owner asks for them. The platform shows a rank where
// it would show a rating, which stays hidden (`@pbgo/ui/ranks`: nine tiers, three divisions each but the last). It draws what it is given, and says what it is to a screen reader ("Rank: Gold II") unless something around it already does (`labelled`: a column header, a label). It is the outline badge, the one that is not a status:
// `success` and `destructive` are results and `secondary` is a label such as "Host". Where a rank is a word under a name rather than a badge, `quiet` draws it with no border, no padding and the muted colour; `className` sizes it where a figure is big.

type RankBadgeProps = Omit<React.ComponentProps<typeof Badge>, "children"> & {
  rank: Rank
  /** A word under a name: no border, no padding, the muted colour. */
  quiet?: boolean
  /** Something around the badge already says it is a rank (the header of its column, a label before it): a screen reader is not told twice. */
  labelled?: boolean
}

function RankBadge({ rank, quiet = false, labelled = false, variant = "outline", className, ...props }: RankBadgeProps) {
  return (
    <Badge data-slot="rank-badge" variant={variant} className={cn("tabular-nums", quiet && "h-auto border-transparent px-0 py-0 text-muted-foreground", className)} {...props}>
      {!labelled && <span className="sr-only">Rank: </span>}
      {rankLabel(rank)}
    </Badge>
  )
}

export { RankBadge }
export type { RankBadgeProps }
