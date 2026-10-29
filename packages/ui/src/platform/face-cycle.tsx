"use client"

import * as React from "react"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import { DISPLAY_FACES } from "../faces"
import { DURATION, EASE_STANDARD } from "../motion"
import { cn } from "../utils"

/**
 * A word of a title set in one of the platform's display faces, which changes to the next one every few seconds: the "board games" of the home's
 * title. The rest of the line (`before`, `after`) stays in the face of its parent and glides to its new place when the word changes width, since
 * a centred line moves when one of its words does. The word fades out and the next fades in, with the platform's easing (`@pbgo/ui/motion`).
 *
 * It is a word of a title, in capitals, from `text-3xl` up: the script and the blackletter are hard to read small. It is one text in the page,
 * written as it is, whichever face it is in (`before`, the word and `after` read as one sentence for a screen reader and a search engine), and
 * there is nothing to turn for a visitor who asks for less motion: it stays in its first face.
 */
function FaceCycle({
  before,
  children,
  after,
  interval = 6000,
  className,
  ...props
}: Omit<React.ComponentProps<"span">, "children"> & {
  /** The text before the word on the same line, without the space between them. */
  before?: string
  /** The word, or the few words, that change face. */
  children: string
  /** The text after the word on the same line, without the space between them. */
  after?: string
  /** How long a face stays, in milliseconds. */
  interval?: number
}) {
  const [index, setIndex] = React.useState(0)
  const reduced = useReducedMotion()

  React.useEffect(() => {
    if (reduced) return
    const timer = window.setInterval(() => setIndex((current) => (current + 1) % DISPLAY_FACES.length), interval)
    return () => window.clearInterval(timer)
  }, [reduced, interval])

  return (
    <span data-slot="face-cycle" className={className} {...props}>
      {before && (
        <>
          <motion.span layout="position" className="inline-block">
            {before}
          </motion.span>{" "}
        </>
      )}
      <motion.span layout="position" className="inline-block whitespace-nowrap">
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={index}
            className={cn("inline-block", DISPLAY_FACES[index]?.utility)}
            initial={{ opacity: 0, y: "0.12em" }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: "-0.12em" }}
            transition={{ duration: DURATION.slow, ease: EASE_STANDARD }}
          >
            {children}
          </motion.span>
        </AnimatePresence>
      </motion.span>
      {after && (
        <>
          {" "}
          <motion.span layout="position" className="inline-block">
            {after}
          </motion.span>
        </>
      )}
    </span>
  )
}

export { FaceCycle }
