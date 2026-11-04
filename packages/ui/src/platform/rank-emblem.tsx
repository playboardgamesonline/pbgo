import * as React from "react"
import type { Rank } from "../ranks"
import { cn } from "../utils"
import { CRESTS } from "./rank-crests"

// The emblem of a rank: the picture that stands for its tier, next to its name. The crests are the owner's to hand over, one SVG a tier (`rank-crests.tsx`: Grandmaster's is there, the others are to come): a tier that has one is drawn by it, as it is, with no tile behind it. A tier that has not has the stand-in, the first letter
// of the tier on a tile, the way an expansion with no picture has the initials of its name, and a player with no rank a plain dashed frame. It is decorative (the name of the rank is written beside it) and 4rem wide unless it is given another size.

function RankEmblem({ rank, className, ...props }: Omit<React.ComponentProps<"span">, "children"> & { rank: Rank | null }) {
  const Crest = rank ? CRESTS[rank.tier] : undefined
  if (Crest) {
    return (
      <span data-slot="rank-emblem" aria-hidden="true" className={cn("flex size-16 shrink-0 items-center justify-center", className)} {...props}>
        <Crest className="size-full" />
      </span>
    )
  }
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
