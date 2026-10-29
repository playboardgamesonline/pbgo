"use client"

import * as React from "react"
import { animate, motion, useMotionValue, useReducedMotion, useTransform, type AnimationPlaybackControls, type MotionValue } from "motion/react"
import { PLAYFUL } from "../motion"

// The die of the home's title, an "o": a cube seen straight on, in perspective (the utility `title-piece` of `styles/platform.css` draws it: four sides with their pips, and no top or bottom, which are never seen) that turns from the
// left to the right around its vertical axis, as the coin of the title turns around its horizontal one (`TitleCoin`). It turns on that axis only, so only its four sides take turns to face the viewer: a five on the front, then a four,
// a two and a three. Every fifteen seconds it rolls, 2 or 3 whole turns (chance decides which) and a quarter more, so that it lands on the next side, and it plays while it does (`PLAYFUL.die`): an exponential in and out
// (slow to wake up, all at once, a long gentle stop) and a swell toward the viewer at the fastest moment, as if it were thrown at them. To look solid, each side is darkened as it turns away from the light, which comes from
// the left and the front. A visitor who asks for less motion keeps the five, and nothing moves.

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

/** The cube itself, drawn from the motion values it is given, which `TitleDie` drives: how far it has turned around its vertical axis, in degrees, and how big it is, 1 being what it is. */
function DieCube({ angle, scale }: { angle: MotionValue<number>; scale: MotionValue<number> }) {
  const front = useShade(angle, 0)
  const right = useShade(angle, 90)
  const back = useShade(angle, 180)
  const left = useShade(angle, 270)
  return (
    <motion.i data-slot="die" aria-hidden="true" style={{ rotateY: angle, scale }}>
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

/** `first`: how long the page waits for the first roll, and `every`: how long there is between two rolls, in milliseconds. */
function TitleDie({ first = 4000, every = 15000 }: { first?: number; every?: number }) {
  const angle = useMotionValue(0)
  const swell = useMotionValue(1)
  const reduced = useReducedMotion()

  React.useEffect(() => {
    if (reduced) return
    let timer: ReturnType<typeof setTimeout> | undefined
    let running: AnimationPlaybackControls[] = []
    const { ease, secondsATurn, turns: range, swell: size } = PLAYFUL.die

    const roll = () => {
      const turns = range.min + Math.floor(Math.random() * (range.max - range.min + 1))
      const seconds = (turns + 0.25) * secondsATurn * (0.95 + Math.random() * 0.1)
      running = [
        animate(angle, angle.get() + turns * 360 + 90, { duration: seconds, ease }),
        animate(swell, [1, size, 1], { duration: seconds, ease: "easeInOut" }),
      ]
      timer = setTimeout(roll, every)
    }

    timer = setTimeout(roll, first)
    return () => {
      if (timer) clearTimeout(timer)
      running.forEach((controls) => controls.stop())
    }
  }, [reduced, angle, swell, first, every])

  return <DieCube angle={angle} scale={swell} />
}

export { TitleDie }
