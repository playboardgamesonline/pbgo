import * as React from "react"
import { Calendar01Icon, InfinityIcon, RabbitIcon, TurtleIcon, WalkingIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react"
import type { Pace } from "../tables"
import { cn } from "../utils"

// The picto of a pace, the speed of a game: one for each of the five paces (`Pace`), so that a speed looks the same wherever it is said. The speed slider of a lobby (`LobbySettings`) puts it on its chips, and the row of a table in the list of the open
// tables (`TableEntry`) puts it before the words that say how fast that table is played. They are icons of the library that the platform draws all its icons from, none of them made for it: no timer is an infinity, slow a turtle, normal a person walking,
// fast a rabbit, and a table that leaves a day or more for each turn (`async`) a calendar. The picto is decoration: the words that say the pace stand beside it, or, for the one chip that has none (no timer), in the chip's name.

const PICTOS: Record<Pace, IconSvgElement> = {
  none: InfinityIcon,
  slow: TurtleIcon,
  normal: WalkingIcon,
  fast: RabbitIcon,
  async: Calendar01Icon,
}

function PaceIcon({ pace, className }: { pace: Pace; className?: string }) {
  return <HugeiconsIcon icon={PICTOS[pace]} strokeWidth={2} aria-hidden="true" className={cn("size-4", className)} />
}

export { PaceIcon }
