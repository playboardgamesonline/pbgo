"use client"

import * as React from "react"
import { createPortal } from "react-dom"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import { cardPosition, type Placement } from "../card-position"
import { DURATION, EASE_STANDARD } from "../motion"

// The card that a list of things shows about the one under the pointer (a friend, a game in the bar): one card for the whole list, not one for each thing. It opens beside the
// thing the pointer rests on; when the pointer goes to the next one the card does not close and open again, it moves there (its position, with the transition of the platform)
// and what it says changes, the old words fading out as the new ones fade in and the card growing or shrinking to what it holds. A card about a game will hold more one day (how far
// the game has got), which is why its height follows its content. It is made of two parts: `useMovingCard`, which is the state (what the card is about, when it opens and closes,
// and the pointer on the thing or on the card), and `MovingCard`, which draws it, in the page (a portal) and above the navbar, in the `platform` look. The list decides what the
// things are (`show` on the pointer entering one, `hide` on its leaving) and what the card says. It is for the pointer and the keyboard, never a touch: a touch has no hover.

/** How long the pointer rests on a thing before the first card opens, in ms. Once a card is open the next thing is shown at once. */
const SHOW_DELAY = 300

/** How long a card stays when the pointer leaves, so that it can cross to the card or to the next thing, in ms. */
const HIDE_DELAY = 140

/** What the card is about: the key that tells it from the other things of the list, and the element it stands beside. */
export type CardTarget = { key: string; element: HTMLElement }

export type MovingCardControl = {
  target: CardTarget | null
  /** The card's own element: a press inside it is not a press away from it. */
  ref: React.RefObject<HTMLDivElement | null>
  /** The pointer rests on a thing, or the keyboard is on it (`now`: no wait). The card opens, or moves there if it is open. */
  show: (key: string, element: HTMLElement, now?: boolean) => void
  /** The pointer leaves a thing: the card closes after a moment, unless the pointer is on it or on another thing by then. */
  hide: () => void
  /** At once. */
  close: () => void
  /** The pointer is on the card, or leaves it. */
  keep: () => void
  leave: () => void
}

/**
 * The state of a moving card. `inside` says whether a press on a node is a press on the list, which does not close the card (the list decides what the press does); any other press, the Escape
 * key, and the scrolling of the page or of a box in it close the card.
 */
export function useMovingCard(inside?: (node: Node) => boolean): MovingCardControl {
  const [target, setTarget] = React.useState<CardTarget | null>(null)
  const opened = React.useRef(false)
  const timer = React.useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const overCard = React.useRef(false)
  const ref = React.useRef<HTMLDivElement>(null)
  const insideList = React.useRef(inside)
  React.useEffect(() => {
    insideList.current = inside
  })

  const set = React.useCallback((next: CardTarget | null) => {
    opened.current = next !== null
    setTarget(next)
  }, [])
  const close = React.useCallback(() => {
    clearTimeout(timer.current)
    overCard.current = false
    set(null)
  }, [set])
  const show = React.useCallback(
    (key: string, element: HTMLElement, now = false) => {
      clearTimeout(timer.current)
      timer.current = setTimeout(() => set({ key, element }), now || opened.current ? 0 : SHOW_DELAY)
    },
    [set],
  )
  const hide = React.useCallback(() => {
    clearTimeout(timer.current)
    if (overCard.current) return
    timer.current = setTimeout(() => set(null), HIDE_DELAY)
  }, [set])
  const keep = React.useCallback(() => {
    overCard.current = true
    clearTimeout(timer.current)
  }, [])
  const leave = React.useCallback(() => {
    overCard.current = false
    hide()
  }, [hide])
  React.useEffect(() => () => clearTimeout(timer.current), [])

  const isOpen = target !== null
  React.useEffect(() => {
    if (!isOpen) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close()
    }
    const onDown = (event: PointerEvent) => {
      const node = event.target as Node
      if (ref.current?.contains(node) || insideList.current?.(node)) return
      close()
    }
    document.addEventListener("keydown", onKey)
    document.addEventListener("pointerdown", onDown)
    window.addEventListener("scroll", close, true)
    return () => {
      document.removeEventListener("keydown", onKey)
      document.removeEventListener("pointerdown", onDown)
      window.removeEventListener("scroll", close, true)
    }
  }, [isOpen, close])

  return { target, ref, show, hide, close, keep, leave }
}

type MovingCardProps = {
  card: MovingCardControl
  /** What the card says is about: when it changes the card moves and the words change. Keep the last one while the card closes, so that it does not empty as it fades. */
  contentKey: string
  /** The width of the card, in px. */
  width: number
  placement: Placement
  /** Names the card for a screen reader. */
  label: string
  /** The padding and the gaps of what is in the card. */
  contentClassName?: string
  children: React.ReactNode
}

/** The card of a list: one for all of its things (`useMovingCard`), drawn in the page above the navbar. */
function MovingCard({ card, contentKey, width, placement, label, contentClassName, children }: MovingCardProps) {
  const reduced = useReducedMotion()
  const { target } = card
  // The card stays where it was while it closes
  const element = React.useRef<HTMLElement | null>(null)
  if (target) element.current = target.element
  // Its height is its content's: measured, so that the card grows and shrinks to what it holds
  const [height, setHeight] = React.useState(0)
  const measure = React.useCallback((node: HTMLDivElement | null) => {
    if (!node) return
    const observer = new ResizeObserver(([entry]) => setHeight(Math.round(entry?.borderBoxSize[0]?.blockSize ?? 0)))
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  if (typeof document === "undefined") return null
  const anchor = element.current?.getBoundingClientRect()
  const { x, y } = anchor
    ? cardPosition(anchor, { width, height: height || 140 }, { width: window.innerWidth, height: window.innerHeight }, placement)
    : { x: 0, y: 0 }
  const travel = reduced ? { duration: 0 } : { duration: DURATION.slow, ease: EASE_STANDARD }
  const shrunk = reduced ? 1 : 0.97

  return createPortal(
    <AnimatePresence>
      {target && (
        <motion.div
          key="card"
          ref={card.ref}
          role="group"
          aria-label={label}
          data-slot="moving-card"
          className="platform fixed top-0 left-0 z-50 overflow-hidden rounded-4xl glass text-popover-foreground shadow-float ring-1 ring-foreground/10 backdrop-blur-xl"
          style={{ width }}
          initial={{ opacity: 0, scale: shrunk, x, y }}
          animate={{
            opacity: 1,
            scale: 1,
            x,
            y,
            ...(height > 0 ? { height } : {}),
            transition: { x: travel, y: travel, height: travel, opacity: { duration: DURATION.fast }, scale: { duration: DURATION.base, ease: EASE_STANDARD } },
          }}
          exit={{ opacity: 0, scale: shrunk, transition: { duration: DURATION.fast } }}
          onPointerEnter={card.keep}
          onPointerLeave={card.leave}
        >
          <div ref={measure} className="relative">
            <AnimatePresence initial={false} mode="popLayout">
              <motion.div
                key={contentKey}
                className={contentClassName}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: DURATION.fast }}
              >
                {children}
              </motion.div>
            </AnimatePresence>
          </div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  )
}

export { MovingCard }
