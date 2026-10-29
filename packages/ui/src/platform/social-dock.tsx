"use client"

import * as React from "react"
import { AnimatePresence, MotionConfig, motion } from "motion/react"
import { DURATION, EASE_STANDARD } from "../motion"
import { cn } from "../utils"

// The container on the right of the navbar that is, in one piece, the bar of the games the friends are in, the visitor's profile and the social panel: a glass surface that is a
// recap bar (a rounded square 3.5rem high, as wide as what is in it) while it is closed, and a real side panel (20rem wide, down to the bottom of the window) while it is open. It is
// the same element in both: it grows and shrinks between the two (its width, its height and, through the `rounded-2xl` and `rounded-4xl` steps, its corners, over `DURATION.slow` with
// `EASE_STANDARD`), the bar keeps its place at the top of it, and the panel fades in under the bar while the room for it is made, and out before the room goes.
//
// The page puts a place for it in the navbar (3.5rem high, as wide as the bar) and the dock grows out of that place, over the page, to the left of it: the place is a flex row that ends at
// its right edge, so a box wider than it overflows at its start (a grid area would not), and it keeps the bar's width for as long as the dock is open, so that the rest of the navbar (the
// brand, the tabs) is not pushed aside by a panel that lies over it. The panel is out of the flow of the dock (`absolute`, as wide as the open dock whatever the dock is now): it adds
// nothing to the width of the closed dock, which is the bar's alone (that is what `width: auto` is measured against: a panel that counted would make the dock jump to the width of its
// widest row before it came back to the bar's), and its text does not reflow while the dock grows. A visitor who asks for less motion gets the change with no travel
// (`reducedMotion="user"`). It takes the pointer back (`pointer-events-auto`): the navbar it is in lets it through.

/** How wide the open dock is, in px. */
const COLUMN_WIDTH = 320

/** How high the bar is, in px (`h-14`). */
const BAR_HEIGHT = 56

/** The room around an open dock: 1.5rem above it, and the same under it. */
const MARGIN = 48

const subscribeToResize = (notify: () => void) => {
  window.addEventListener("resize", notify)
  return () => window.removeEventListener("resize", notify)
}

/** How high the open dock can be: the window, less what is around it and the cookie banner, which `@pbgo/analytics` measures and publishes as `--consent-h` on <body>. */
const readRoom = () => {
  const consent = Number.parseFloat(getComputedStyle(document.body).getPropertyValue("--consent-h")) || 0
  return Math.max(240, Math.round(window.innerHeight - MARGIN - consent))
}
const noRoom = () => 480

type SocialDockProps = {
  /** Whether the dock is open: a side panel. Closed, it is the bar. */
  open: boolean
  /** The bar: what the dock holds while it is closed and keeps at its top while it is open (the games, the account, the button of the panel). */
  bar: React.ReactNode
  /** The panel: what the dock shows under the bar while it is open. */
  children: React.ReactNode
  /** How high the open dock is, in px, where the window is not what it is measured against (the specimens of `/design`). */
  height?: number
  className?: string
}

function SocialDock({ open, bar, children, height, className }: SocialDockProps) {
  const room = React.useSyncExternalStore(subscribeToResize, readRoom, noRoom)
  const ease = { duration: DURATION.slow, ease: EASE_STANDARD }
  const place = React.useRef<HTMLDivElement>(null)
  const dock = React.useRef<HTMLDivElement>(null)

  // The place keeps the bar's width for as long as the dock is open: a dock wider than its place would make the place grow, and the rest of the navbar (the brand, the
  // tabs) would be pushed aside by the panel it lies under. The width is taken as the dock opens, when it is still the bar's, and let go when the dock is a bar again.
  React.useLayoutEffect(() => {
    if (open && place.current && dock.current && !place.current.style.width) place.current.style.width = `${dock.current.offsetWidth}px`
  }, [open])

  return (
    <MotionConfig reducedMotion="user">
      <div ref={place} data-slot="social-dock-place" className="flex h-14 shrink-0 justify-end">
        <motion.div
          ref={dock}
          data-slot="social-dock"
          data-state={open ? "open" : "closed"}
          initial={false}
          animate={open ? { width: COLUMN_WIDTH, height: height ?? room } : { width: "auto", height: BAR_HEIGHT }}
          transition={ease}
          onAnimationComplete={() => {
            if (!open && place.current) place.current.style.width = ""
          }}
          className={cn(
            "pointer-events-auto relative flex shrink-0 flex-col self-start overflow-hidden rounded-2xl border bg-background/80 shadow-surface backdrop-blur-md transition-[border-radius] duration-slow ease-standard data-[state=open]:rounded-4xl",
            className
          )}
          style={{ maxWidth: "calc(100vw - 3rem)" }}
        >
          {/* 54px: the dock is 56px high with its border, so the bar is the height of what is inside it, and what it holds (the 40px of a button) is centred in the dock */}
          <div data-slot="social-dock-bar" className="flex h-13.5 shrink-0 items-center justify-between gap-1 p-2">
            {bar}
          </div>
          <AnimatePresence initial={false}>
            {open && (
              <motion.div
                key="panel"
                data-slot="social-dock-panel"
                className="absolute top-13.5 right-0 bottom-0 flex flex-col"
                style={{ width: `min(${COLUMN_WIDTH - 2}px, calc(100vw - 3rem - 2px))` }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1, transition: { duration: DURATION.base, ease: EASE_STANDARD, delay: DURATION.fast } }}
                exit={{ opacity: 0, transition: { duration: DURATION.fast, ease: EASE_STANDARD } }}
              >
                {children}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </MotionConfig>
  )
}

export { SocialDock }
