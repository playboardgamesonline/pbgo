"use client"

import * as React from "react"
import { animate, motion, useMotionValue, useReducedMotion } from "motion/react"
import { EASE_FRICTION } from "../motion"

// The coin of the home's title, an "o": two sides, a profile and a star, drawn by the utility `title-piece` of `styles/platform.css`. It spins on itself, from the top to the bottom, and it does not rise. What
// the CSS cannot do is leave it to chance, so this is the one piece of the title that is not a keyframe: now and then it spins, for 5 or 6 turns (that is all the chance there is), slowly (about eight seconds
// for five turns, ten for six) and slows down the way a thing does that rubs: a quick start, at the most a turn and a fifth a second, then the same slowing at every moment (a quadratic ease-out: dry friction takes
// the same speed off every moment) until it stops. A whole number of turns, so it always stops flat on its profile. It rests 14 to 24 seconds between two spins, and the first one comes 12 to 15 seconds after
// the page is shown, once the die has rolled and the suit has changed. A visitor who asks for less motion gets the profile and nothing moves.

function TitleCoin() {
  const angle = useMotionValue(0)
  const reduced = useReducedMotion()

  React.useEffect(() => {
    if (reduced) return
    let stopped = false
    let timer: ReturnType<typeof setTimeout> | undefined
    let running: ReturnType<typeof animate> | undefined

    const spin = () => {
      const turns = Math.random() < 0.5 ? 5 : 6
      const seconds = (turns === 5 ? 8.3 : 10) * (0.96 + Math.random() * 0.08)
      running = animate(angle, angle.get() - turns * 360, { duration: seconds, ease: EASE_FRICTION })
      running.then(() => {
        if (!stopped) timer = setTimeout(spin, 14000 + Math.random() * 10000)
      })
    }

    timer = setTimeout(spin, 12500 + Math.random() * 3000)
    return () => {
      stopped = true
      if (timer) clearTimeout(timer)
      running?.stop()
    }
  }, [reduced, angle])

  return (
    <motion.i data-slot="coin" aria-hidden="true" style={{ rotateX: angle }}>
      <b data-face="heads">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M9.2 2.8C12.6 1.6 16.1 3 16.8 6.6L17.4 8.8L19.3 11.8L17.7 12.5L18.1 13.6L17.4 14.3L17.9 15.8L16.5 16.9L16.4 18.2C19.2 19 20.7 20.5 21.2 22.4H3.8C4.3 20 6.2 18.8 8.4 18.3C7 16.2 6.3 13.6 6.5 10.9C6.6 7.2 7.6 4.2 9.2 2.8Z" />
        </svg>
      </b>
      <b data-face="tails" />
    </motion.i>
  )
}

export { TitleCoin }
