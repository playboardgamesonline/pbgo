import * as React from "react"
import type { Rank } from "../ranks"
import { cn } from "../utils"

// The emblem of a rank: the picture that stands for its tier, next to its name. The crests are the owner's to hand over and none is here yet, so this is their stand-in, the first letter of the tier on a tile, the way an expansion with no picture has the initials of its name, and a plain dashed frame for a
// player with no rank. It is decorative (the name of the rank is written beside it) and 4rem wide unless it is given another size. When the crests come, this is the one place that draws them.

function RankEmblem({ rank, className, ...props }: Omit<React.ComponentProps<"span">, "children"> & { rank: Rank | null }) {
  return (
    <span
      data-slot="rank-emblem"
      aria-hidden="true"
      className={cn("flex size-16 shrink-0 items-center justify-center rounded-2xl font-heading text-3xl", rank ? "bg-muted" : "border border-dashed text-muted-foreground", className)}
      {...props}
    >
      {rank ? rank.tier.charAt(0) : "?"}
    </span>
  )
}

export { RankEmblem }
