"use client"

import * as React from "react"
import { animate, motion, useMotionValue, useReducedMotion, useTransform, useVelocity, type AnimationPlaybackControls } from "motion/react"
import { PLAYFUL } from "../motion"
import { Suit, type SuitName } from "./suits"

// The suits of the home's title, one in the place of an "o": a wheel, like the reel of a slot machine (`PLAYFUL.suit`). Every fifteen seconds, the first time eleven seconds after the page is shown, it scrolls up through
// the suits, a red one and a black one in turn, fast at first and slower and slower, stretched at speed as a blur would be, goes a little past its stop and settles back on a spring, on a suit that chance chooses (never the
// one that was shown). The heart is the one it starts on, and the one that a visitor who asks for less motion keeps, for whom nothing moves. The wheel is one strip of suits that repeats every four, longer than
// the longest turn, behind a window as big as one suit (the stylesheet clips it); once it has stopped it is put back at the start of its pattern, which looks the same.

const SUITS: readonly SuitName[] = ["heart", "spade", "diamond", "club"]

/** How many suits the strip has: more than the longest turn plus the four it may start from. */
const PLACES = 24

/** The distance between two suits of the strip, in ems: the height of one (0.7) and a gap (0.2). The stylesheet lays them out the same. */
const PITCH = 0.9

/** `first`: how long the page waits for the first turn, and `every`: how long there is between two, in milliseconds. */
function TitleSuits({ first = 11000, every = 15000 }: { first?: number; every?: number }) {
  const reduced = useReducedMotion()
  const place = useMotionValue(0)
  const y = useTransform(place, (places) => `${-places * PITCH}em`)
  const { stretch, maxStretch } = PLAYFUL.suit.wheel
  const longer = useTransform(useVelocity(place), (speed) => 1 + Math.min(Math.abs(speed) * stretch, maxStretch))

  React.useEffect(() => {
    if (reduced) return
    let timer: ReturnType<typeof setTimeout> | undefined
    let running: AnimationPlaybackControls | undefined
    let stopped = false
    const { ease, secondsAPlace, min, max, overshoot, settle } = PLAYFUL.suit.wheel

    const turn = async () => {
      timer = setTimeout(turn, every)
      // Back to the start of the pattern: it repeats every four places, so nothing moves
      const from = place.get() % SUITS.length
      place.set(from)
      let places = min + Math.floor(Math.random() * (max - min + 1))
      if (places % SUITS.length === 0) places += 1
      running = animate(place, from + places + overshoot, { duration: places * secondsAPlace * (0.9 + Math.random() * 0.2), ease })
      await running
      if (stopped) return
      running = animate(place, from + places, settle)
    }

    timer = setTimeout(turn, first)
    return () => {
      stopped = true
      if (timer) clearTimeout(timer)
      running?.stop()
    }
  }, [reduced, place, first, every])

  return (
    <motion.span data-slot="suit-strip" aria-hidden="true" style={{ y }}>
      {Array.from({ length: PLACES }, (_, index) => (
        <motion.span key={index} data-slot="suit-place" style={{ scaleY: longer }}>
          <Suit suit={SUITS[index % SUITS.length]} />
        </motion.span>
      ))}
    </motion.span>
  )
}

export { TitleSuits }
