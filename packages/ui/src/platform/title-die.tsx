"use client"

import * as React from "react"
import { animate, motion, useMotionValue, useReducedMotion, useTransform, type MotionValue } from "motion/react"
import { EASE_FRICTION } from "../motion"

// The die of the home's title, an "o": a cube seen straight on, in perspective (the utility `title-piece` of `styles/platform.css` draws it: four sides with their pips, and no top or bottom, which are never seen) that turns from the left to the right
// around its vertical axis, as the coin of the title turns around its horizontal one (`TitleCoin`). It turns on that axis only, so only its four sides take turns to face the viewer: a five on the front, then a four,
// a two and a three. Every fifteen seconds it rolls, 3, 4 or 5 whole turns (chance decides which) and a quarter more, so that it lands on the next side, faster than the coin (a turn and two thirds a second at the most) and slower and slower
// until it stops. To look solid, each side is darkened as it turns away from the light, which comes from the upper left of the viewer. A visitor who asks for less motion keeps the five, and nothing moves.

/** How long the page waits for the first roll, and how long there is between two rolls (milliseconds). */
const FIRST_ROLL = 4000
const EVERY = 15000

/** The seconds that a turn takes on average: the slowing makes the first one almost twice as quick. */
const SECONDS_A_TURN = 1.2

/** The darkest a side gets, when it is edge-on to the viewer: the share of ink over its ivory. */
const DARKEST = 0.5

/**
 * How dark a side is when the cube is turned by `degrees` from the viewer: nothing while it faces the viewer, up to `DARKEST` as it turns away. The light comes from the left and the front, so a side that turns to the left is
 * lit longer than one that turns to the right.
 */
function shadeOf(degrees: number) {
  const angle = (degrees * Math.PI) / 180
  const lit = -0.4 * Math.sin(angle) + 0.77 * Math.cos(angle)
  return Math.min(1, Math.max(0, 1 - lit / 0.77)) * DARKEST
}

/** The shade of the side that is `offset` degrees round the cube from the front one, for as long as the cube turns. */
function useShade(angle: MotionValue<number>, offset: number) {
  return useTransform(angle, (degrees) => shadeOf(degrees + offset))
}

function TitleDie() {
  const angle = useMotionValue(0)
  const reduced = useReducedMotion()
  const front = useShade(angle, 0)
  const right = useShade(angle, 90)
  const back = useShade(angle, 180)
  const left = useShade(angle, 270)

  React.useEffect(() => {
    if (reduced) return
    let timer: ReturnType<typeof setTimeout> | undefined
    let running: ReturnType<typeof animate> | undefined

    const roll = () => {
      const turns = 3 + Math.floor(Math.random() * 3)
      running = animate(angle, angle.get() + turns * 360 + 90, {
        duration: (turns + 0.25) * SECONDS_A_TURN * (0.95 + Math.random() * 0.1),
        ease: EASE_FRICTION,
      })
      timer = setTimeout(roll, EVERY)
    }

    timer = setTimeout(roll, FIRST_ROLL)
    return () => {
      if (timer) clearTimeout(timer)
      running?.stop()
    }
  }, [reduced, angle])

  return (
    <motion.i data-slot="die" aria-hidden="true" style={{ rotateY: angle }}>
      <b data-face="front" data-pips={5} className="die-pips">
        <motion.i data-shade style={{ opacity: front }} />
      </b>
      <b data-face="right" data-pips={3} className="die-pips">
        <motion.i data-shade style={{ opacity: right }} />
      </b>
      <b data-face="back" data-pips={2} className="die-pips">
        <motion.i data-shade style={{ opacity: back }} />
      </b>
      <b data-face="left" data-pips={4} className="die-pips">
        <motion.i data-shade style={{ opacity: left }} />
      </b>
    </motion.i>
  )
}

export { TitleDie }
