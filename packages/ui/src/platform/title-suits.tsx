"use client"

import * as React from "react"
import { animate, motion, useMotionValue, useReducedMotion, useTransform, type AnimationPlaybackControls, type MotionValue } from "motion/react"
import { PLAYFUL } from "../motion"
import { Suit, type SuitName } from "./suits"

// The suits of the home's title, one in the place of an "o": the suit that is shown pops into the next one, every fifteen seconds, the first change eleven seconds after the page is shown (`PLAYFUL.suit`): the one
// that is shown shrinks, rises a little and fades, and the next grows from small, turned and low to its place on a spring. They come in turn a red one and a black one, the heart first: the one that a visitor who asks
// for less motion keeps, for whom nothing moves. Two layers take turns: the one that comes in is not seen yet, so it takes the next suit without anyone seeing it change.

const SUITS: readonly SuitName[] = ["heart", "spade", "diamond", "club"]

/** What places one of the two suits: how far it is from its place (in ems, up being negative), how big, how turned, how clear. */
type Layer = { y: MotionValue<number>; s: MotionValue<number>; r: MotionValue<number>; o: MotionValue<number> }

function useLayer(clear: number): Layer {
  const y = useMotionValue(0)
  const s = useMotionValue(1)
  const r = useMotionValue(0)
  const o = useMotionValue(clear)
  // One object for as long as the piece lives: the effect that changes the suits starts over when what it plays with changes
  return React.useMemo(() => ({ y, s, r, o }), [y, s, r, o])
}

function SuitLayer({ layer, suit }: { layer: Layer; suit: SuitName }) {
  const y = useTransform(layer.y, (ems) => `${ems}em`)
  return (
    <motion.span data-slot="suit-layer" style={{ y, scale: layer.s, rotate: layer.r, opacity: layer.o }}>
      <Suit suit={suit} />
    </motion.span>
  )
}

/** `first`: how long the page waits for the first change, and `every`: how long there is between two, in milliseconds. */
function TitleSuits({ first: wait = 11000, every = 15000 }: { first?: number; every?: number }) {
  const reduced = useReducedMotion()
  const first = useLayer(1)
  const second = useLayer(0)
  const [shown, setShown] = React.useState<readonly [number, number]>([0, 1])

  React.useEffect(() => {
    if (reduced) return
    let timer: ReturnType<typeof setTimeout> | undefined
    let running: AnimationPlaybackControls[] = []
    let step = 0
    const { leave, enter } = PLAYFUL.suit

    const change = () => {
      const firstIsOut = step % 2 === 0
      const out = firstIsOut ? first : second
      const coming = firstIsOut ? second : first
      const next = (step + 1) % SUITS.length
      setShown((current) => (firstIsOut ? [current[0], next] : [next, current[1]]))
      coming.y.set(enter.from.drop)
      coming.s.set(enter.from.scale)
      coming.r.set(enter.from.rotate)
      coming.o.set(0)
      const away = { duration: leave.seconds, ease: leave.ease }
      const pop = { ...enter.spring, delay: enter.delay }
      running = [
        animate(out.o, 0, away),
        animate(out.s, leave.scale, away),
        animate(out.y, -leave.rise, away),
        animate(coming.o, 1, { duration: enter.fade, delay: enter.delay }),
        animate(coming.s, 1, pop),
        animate(coming.y, 0, pop),
        animate(coming.r, 0, pop),
      ]
      step += 1
      timer = setTimeout(change, every)
    }

    timer = setTimeout(change, wait)
    return () => {
      if (timer) clearTimeout(timer)
      running.forEach((controls) => controls.stop())
    }
  }, [reduced, first, second, wait, every])

  return (
    <>
      <SuitLayer layer={first} suit={SUITS[shown[0]]} />
      <SuitLayer layer={second} suit={SUITS[shown[1]]} />
    </>
  )
}

export { TitleSuits }
