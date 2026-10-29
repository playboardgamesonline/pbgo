"use client"

import * as React from "react"
import { animate, motion, useMotionValue, useReducedMotion, type MotionValue } from "motion/react"
import { EASE_FRICTION } from "../motion"

// The coin of the home's title, an "o": two sides, a profile and a star engraved in lines, drawn by the utility `title-piece` of `styles/platform.css`. It spins on itself, from the top to the bottom, and it does not rise. What
// the CSS cannot do is leave it to chance, so this is the one piece of the title that is not a keyframe: now and then it spins, for 5 or 6 turns (that is all the chance there is), slowly (about eight seconds
// for five turns, ten for six) and slows down the way a thing does that rubs: a quick start, at the most a turn and a fifth a second, then the same slowing at every moment (a quadratic ease-out: dry friction takes
// the same speed off every moment) until it stops. A whole number of turns, so it always stops flat on its profile. It rests 14 to 24 seconds between two spins, and the first one comes 12 to 15 seconds after
// the page is shown, once the die has rolled and the suit has changed. A visitor who asks for less motion gets the profile and nothing moves.

/** The emblem of the heads: a head and neck in profile, facing right, and a curve of hair. Lines only. */
const PROFILE = [
  "M7 21.6C7.4 19.4 8.7 18.3 8.5 16.5C6.3 15.3 5.7 12.7 6 9.9C6.5 6.1 9.6 3.4 13.2 3.5C16.5 3.6 18.5 5.8 18.8 8.5C18.9 9.1 18.9 9.5 19 9.8L21.4 12.6L19.3 13.4C19.5 14 19.7 14.3 20.1 14.6L19.1 15.2C19.3 15.6 19.6 15.9 19.9 16.1L18.9 16.8C19.1 17.6 19.1 18.4 18.8 19L16.9 19.7L16.8 21.6Z",
  "M9.2 9.6C9.8 7 12.2 5.2 14.8 5.5",
] as const

/** The emblem of the tails: a star, and a smaller one inside it. */
const STAR = [
  "M12 3.6L14.35 9.56L20.75 9.96L15.8 14.04L17.41 20.24L12 16.8L6.59 20.24L8.2 14.04L3.25 9.96L9.65 9.56Z",
  "M12 8.4L13.12 11.26L16.18 11.44L13.81 13.39L14.59 16.36L12 14.7L9.41 16.36L10.19 13.39L7.82 11.44L10.88 11.26Z",
] as const

/** An engraving: the lines in a dark gold and, a hair lower and lighter under them, the same lines again, which is the relief (the stylesheet draws each). */
function Engraved({ lines }: { lines: readonly string[] }) {
  const paths = lines.map((d) => <path key={d} d={d} />)
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <g data-relief>{paths}</g>
      <g data-engraving>{paths}</g>
    </svg>
  )
}

/** The two sides of the coin, turned by `angle` degrees around its horizontal axis (and `wobble` around its vertical one, `scale` bigger or smaller): a profile and a star, in lines. */
function CoinSides({ angle, wobble, scale }: { angle: MotionValue<number>; wobble?: MotionValue<number>; scale?: MotionValue<number> }) {
  const flat = useMotionValue(0)
  const one = useMotionValue(1)
  return (
    <motion.i data-slot="coin" aria-hidden="true" style={{ rotateX: angle, rotateY: wobble ?? flat, scale: scale ?? one }}>
      <b data-face="heads">
        <Engraved lines={PROFILE} />
      </b>
      <b data-face="tails">
        <Engraved lines={STAR} />
      </b>
    </motion.i>
  )
}

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

  return <CoinSides angle={angle} />
}

export { CoinSides, TitleCoin }
