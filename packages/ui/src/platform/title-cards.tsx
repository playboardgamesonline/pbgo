"use client"

import * as React from "react"
import { animate, motion, useMotionValue, useReducedMotion, useTransform, type AnimationPlaybackControls } from "motion/react"
import { PLAYFUL } from "../motion"
import { cn } from "../utils"

// The two dark blue playing cards after "games" in the home's title, the backs of a deck, that overlap in a fan (the utility `title-cards` of `styles/platform.css` draws them: that fan is how they stand still, and how a visitor
// who asks for less motion sees them). Now and then they play (`PLAYFUL.cards`): the fan folds up, the two cards straighten and come together, they stay together for a beat, and the fan opens again on a spring, a little wider than it
// was before it settles. One number moves everything, how open the fan is (`spread`: 1 is the fan as it stands, 0 is the cards closed on each other), and the angles and the gap between the cards follow it.

/** The fan as it stands, which the stylesheet draws too: the angle of each card, in degrees, and how far the second is from the first, in ems. */
const FAN = { first: -13, second: 11, gap: 0.2 }

const lerp = (from: number, to: number, share: number) => from + (to - from) * share

/** `first`: how long the page waits for the first fold, and `every`: how long there is between two, in milliseconds. */
function TitleCards({ className, first = 8000, every = 15000, ...props }: Omit<React.ComponentProps<"span">, "children" | "aria-hidden"> & { first?: number; every?: number }) {
  const reduced = useReducedMotion()
  const spread = useMotionValue(1)
  const { closed } = PLAYFUL.cards
  const turnFirst = useTransform(spread, (share) => lerp(-closed.turn, FAN.first, share))
  const turnSecond = useTransform(spread, (share) => lerp(closed.turn, FAN.second, share))
  const left = useTransform(spread, (share) => `${lerp(closed.gap, FAN.gap, share)}em`)

  React.useEffect(() => {
    if (reduced) return
    let timer: ReturnType<typeof setTimeout> | undefined
    let running: AnimationPlaybackControls | undefined
    let stopped = false
    const { fold, ease, hold, open } = PLAYFUL.cards

    const play = async () => {
      timer = setTimeout(play, every)
      // A fold that is not over (a tab in the background holds the frames back while the timers go on) is left to end where it was going: open
      if (spread.isAnimating()) return
      running = animate(spread, 0, { duration: fold, ease })
      await running
      if (stopped) return
      running = animate(spread, 1, { ...open, delay: hold })
    }

    timer = setTimeout(play, first)
    return () => {
      stopped = true
      if (timer) clearTimeout(timer)
      running?.stop()
    }
  }, [reduced, spread, first, every])

  return (
    <span data-slot="title-cards" aria-hidden="true" className={cn("title-cards", className)} {...props}>
      <motion.i style={{ rotate: turnFirst, originX: 0.5, originY: 1 }} />
      <motion.i style={{ rotate: turnSecond, left, originX: 0.5, originY: 1 }} />
    </span>
  )
}

export { TitleCards }
