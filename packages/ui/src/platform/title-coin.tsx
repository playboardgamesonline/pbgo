"use client"

import * as React from "react"
import { animate, motion, useMotionValue, useReducedMotion, type AnimationPlaybackControls, type MotionValue } from "motion/react"
import { PLAYFUL } from "../motion"
import { HEADS, TAILS, type Drawing } from "./coin-drawings"

// The coin of the home's title, an "o": two sides drawn in lines, a laureate in profile and a star with facets in a wreath of laurel (`coin-drawings.ts`), on a struck gold coin that the utility `title-piece` of
// `styles/platform.css` draws. It is tossed, from the top to the bottom, and it does not rise: now and then it spins for 1 or 2 whole turns (that is all the chance there is), and it plays while it does (`PLAYFUL.coin`):
// it dips as if gathering itself, swells toward the viewer at the top of the toss, slows down as an ease in and out does, and lands with a squash that springs back. A whole number of turns, so it always stops flat
// on its profile. It rests 14 to 24 seconds between two spins, and the first one comes 12 to 15 seconds after the page is shown, once the die has rolled and the suit has changed. A visitor who asks for less
// motion gets the profile and nothing moves.

/** A drawing, as the stylesheet engraves it: the relief under it, a lighter copy of the outline a hair lower, then each line in the weight of its `data-line`. */
function Engraved({ drawing }: { drawing: Drawing }) {
  const lines = (items: readonly string[], line: string) => items.map((d) => <path key={d} data-line={line} d={d} />)
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true">
      <path data-relief d={drawing.outline} />
      <g data-engraving>
        {lines(drawing.leaves, "leaf")}
        <path data-line="outline" d={drawing.outline} />
        {lines(drawing.detail, "detail")}
        {lines(drawing.fine, "fine")}
        <circle data-line="dot" cx={drawing.dot[0]} cy={drawing.dot[1]} r={drawing.dot[2]} />
      </g>
    </svg>
  )
}

/** The two sides of the coin, turned by `angle` degrees around its horizontal axis, and drawn `scale` times as big. */
function CoinSides({ angle, scale }: { angle: MotionValue<number>; scale: MotionValue<number> }) {
  return (
    <motion.i data-slot="coin" aria-hidden="true" style={{ rotateX: angle, scale }}>
      <b data-face="heads">
        <Engraved drawing={HEADS} />
      </b>
      <b data-face="tails">
        <Engraved drawing={TAILS} />
      </b>
    </motion.i>
  )
}

/** `first`: how long the page waits for the first spin, and `rest`: how long the coin rests between two (milliseconds, and a quarter or two thirds more, at random). */
function TitleCoin({ first = 12500, rest = 14000 }: { first?: number; rest?: number }) {
  const angle = useMotionValue(0)
  const scale = useMotionValue(1)
  const reduced = useReducedMotion()

  React.useEffect(() => {
    if (reduced) return
    let stopped = false
    let timer: ReturnType<typeof setTimeout> | undefined
    let running: AnimationPlaybackControls[] = []
    const { ease, secondsATurn, turns: range, dip, swell, squash, landing } = PLAYFUL.coin

    const spin = async () => {
      const turns = range.min + Math.floor(Math.random() * (range.max - range.min + 1))
      const seconds = turns * secondsATurn * (0.96 + Math.random() * 0.08)
      running = [
        animate(angle, angle.get() - turns * 360, { duration: seconds, ease }),
        animate(scale, [1, dip, swell, 1], { duration: seconds, times: [0, 0.08, 0.5, 1], ease: "easeInOut" }),
      ]
      await Promise.all(running)
      if (stopped) return
      running = [animate(scale, squash, { duration: 0.07 })]
      await running[0]
      if (stopped) return
      running = [animate(scale, 1, landing)]
      await running[0]
      if (!stopped) timer = setTimeout(spin, rest * (1 + Math.random() * 0.72))
    }

    timer = setTimeout(spin, first * (1 + Math.random() * 0.24))
    return () => {
      stopped = true
      if (timer) clearTimeout(timer)
      running.forEach((controls) => controls.stop())
    }
  }, [reduced, angle, scale, first, rest])

  return <CoinSides angle={angle} scale={scale} />
}

export { TitleCoin }
