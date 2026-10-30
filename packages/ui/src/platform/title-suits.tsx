"use client"

import * as React from "react"
import { animate, motion, useMotionValue, useReducedMotion, useTransform, useVelocity, type AnimationPlaybackControls } from "motion/react"
import { PLAYFUL } from "../motion"
import { Suit, type SuitName } from "./suits"
import { rhythm, usePlayOnEnter } from "./title-play"

// The suits of the home's title, one in the place of an "o": a wheel, like the reel of a slot machine (`PLAYFUL.suit`). Every fifteen seconds, the first time eleven seconds after the page is shown, it scrolls up through
// the suits, a red one and a white one in turn (a black one would be lost on the page's black), with a wind-up and then slower and slower, blurred up and down by its own speed and stretched a little, goes a little past
// its stop and settles back on a spring, and it always stops on the heart it started on: a whole number of laps of the four suits, two or three by chance. It also turns when the pointer comes onto it, if it is not turning
// already (`usePlayOnEnter`), and the next turn then comes after the usual time. The heart is also the one that a visitor who asks for less motion keeps, for whom nothing moves.
// The wheel is one strip of suits that repeats every four, longer than the longest turn, in a window (the stylesheet draws it) that is taller than one suit: a suit comes in and goes out through a fade, at the top and at the
// bottom, and at rest the window shows the one suit, the others being farther away than the fade reaches. Once it has stopped the strip is put back at the start of its pattern, which looks the same.
//
// The blur is an SVG filter on the window, a Gaussian one with a deviation along the vertical only (`stdDeviation="0 …"`, in fractions of the window, so it follows the size of the title). A filter's deviation could be
// animated, but a browser does not always redraw what it filters when that changes, so there are a few filters, each with its own deviation, and the speed picks one of them (the `filter` of the window, which any browser
// redraws when it changes).

const SUITS: readonly SuitName[] = ["heart", "spade", "diamond", "club"]

/** The distance between two suits of the strip, in ems: the height of one (0.7) and the gap (0.3). The stylesheet lays them out the same. */
const PITCH = 1

/** The height of the window, in ems, which the stylesheet sets: one suit and a fade of 0.3 above it and below it. The deviation of the blur is a share of it. */
const WINDOW = 1.3

/** How many suits the strip has: enough for the longest turn, which starts on the first place and stops on a heart, and for the suit under the one it stops on. */
const PLACES = PLAYFUL.suit.wheel.laps.max * SUITS.length + 2

/** How many filters there are, from the faintest blur to the strongest: the speed rounds to one of them, or to none. */
const LEVELS = 10

/** `first`: how long the page waits for the first turn, and `every`: how long there is between two, in milliseconds. */
function TitleSuits({ first = 11000, every = 15000 }: { first?: number; every?: number }) {
  const reduced = useReducedMotion()
  const place = useMotionValue(0)
  const root = React.useRef<HTMLSpanElement>(null)
  const playNow = React.useRef<(() => void) | null>(null)
  usePlayOnEnter(root, playNow)
  const id = React.useId().replace(/:/g, "")
  const y = useTransform(place, (places) => `${-places * PITCH}em`)
  const { stretch, maxStretch, blur } = PLAYFUL.suit.wheel
  const speed = useVelocity(place)
  const longer = useTransform(speed, (perSecond) => 1 + Math.min(Math.abs(perSecond) * stretch, maxStretch))
  const filter = useTransform(speed, (perSecond) => {
    const level = Math.round((Math.min(Math.abs(perSecond) * blur.perPlaceASecond, blur.max) / blur.max) * LEVELS)
    return level > 0 ? `url(#${id}-${level})` : "none"
  })

  React.useEffect(() => {
    if (reduced) return
    let running: AnimationPlaybackControls | undefined
    let stopped = false
    const { ease, secondsAPlace, laps, overshoot, settle } = PLAYFUL.suit.wheel

    const turn = async () => {
      // Back to the start of the pattern, the heart: it repeats every four places, so nothing moves
      const from = place.get() % SUITS.length
      place.set(from)
      // A whole number of laps of the four suits, so that it stops on a heart again
      const places = SUITS.length * (laps.min + Math.floor(Math.random() * (laps.max - laps.min + 1)))
      running = animate(place, from + places + overshoot, { duration: places * secondsAPlace * (0.9 + Math.random() * 0.2), ease })
      await running
      if (stopped) return
      running = animate(place, from + places, settle)
    }

    // A turn that is not over (a tab in the background holds the frames back while the timers go on) is left to end where it was going: on a heart
    const beat = rhythm({ first, every, busy: () => place.isAnimating(), start: turn })
    playNow.current = beat.play

    return () => {
      stopped = true
      playNow.current = null
      beat.stop()
      running?.stop()
    }
  }, [reduced, place, first, every])

  return (
    <>
      <motion.span ref={root} data-slot="suit-window" aria-hidden="true" style={{ filter }}>
        <motion.span data-slot="suit-strip" style={{ y }}>
          {Array.from({ length: PLACES }, (_, index) => (
            <motion.span key={index} data-slot="suit-place" style={{ scaleY: longer }}>
              <Suit suit={SUITS[index % SUITS.length]} />
            </motion.span>
          ))}
        </motion.span>
      </motion.span>
      {/* Drawn for a visitor who asks for less motion too, who never uses it: what the client draws first must be what the server drew, and the server does not know the visitor's preference */}
      <svg aria-hidden="true" focusable="false" width="0" height="0" className="absolute">
        {Array.from({ length: LEVELS }, (_, index) => (
          <filter key={index} id={`${id}-${index + 1}`} primitiveUnits="objectBoundingBox" colorInterpolationFilters="sRGB">
            <feGaussianBlur stdDeviation={`0 ${(((index + 1) / LEVELS) * blur.max / WINDOW).toFixed(4)}`} />
          </filter>
        ))}
      </svg>
    </>
  )
}

export { TitleSuits }
