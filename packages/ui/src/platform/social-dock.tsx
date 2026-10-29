"use client"

import * as React from "react"
import { AnimatePresence, MotionConfig, animate, motion, useMotionValue, useReducedMotion } from "motion/react"
import { DURATION, EASE_STANDARD } from "../motion"
import { cn } from "../utils"

// The container on the right of the navbar that is, in one piece, the bar of the games the friends are in, the visitor's profile and the social panel: a glass surface that is a
// bar (a rounded square 3.5rem high, as wide as what is in it) while it is closed, and a real side panel (20rem wide, down to the bottom of the window) while it is open. It is
// the same element in both: it grows and shrinks between the two (its width, its height and, through the `rounded-2xl` and `rounded-4xl` steps, its corners, over `DURATION.slow` with
// `EASE_STANDARD`) and the panel fades in under the bar while the room for it is made, and out before the room goes.
//
// The bar is the header of the panel, the way the Riot Client has it, and it changes with the dock instead of staying what it was. Closed, it is the games the friends are in, the
// visitor's picture and the button of the panel. Open, the games fold away (their width, then their opacity), the picture glides to the start of the bar as they go, what the profile says
// unfolds beside it (`SocialDockIdentity`: the name and the word of the status), and the button stays at the end of the bar. The header has the room of what is under it: it grows from 54px
// to 80px, the picture 24px from the start, from the top and from the tabs, for the room from the corner, and the button 16px from the end, in line with the tabs, the search and the list. All of it moves with the same
// transition as the dock, so the bar never jumps.
//
// The page puts a place for it in the navbar (3.5rem high, as wide as the bar) and the dock grows out of that place, over the page, to the left of it: the place is a flex row that ends at
// its right edge, so a box wider than it overflows at its start (a grid area would not), and it keeps the bar's width for as long as the dock is open, so that the rest of the navbar (the
// brand, the tabs) is not pushed aside by a panel that lies over it. The panel is out of the flow of the dock (`absolute`, as wide as the open dock whatever the dock is now): its text does not
// reflow while the dock grows. The width of the dock is not a prop of the animation but a motion value that this component drives: `auto` cannot be animated to when what is in the bar changes
// at the same time (it would be measured with the bar of the other state), so the dock goes from the width it has to 20rem, and back to the width the bar had when it opened, before it is `auto` again.
// A visitor who asks for less motion gets the change with no travel. It takes the pointer back (`pointer-events-auto`): the navbar it is in lets it through.

/** How wide the open dock is, in px. */
const COLUMN_WIDTH = 320

/** How high the closed dock is, in px (`h-14`). */
const BAR_HEIGHT = 56

/** The bar closed: 54px high, since the dock is 56px with its border, and 8px from the sides of the dock. */
const BAR_INNER = 54
const BAR_INSET = 8

/**
 * The bar open, the header of the panel: 80px high, the picture (32px) centred in it so 24px from the top and 24px above the tabs, as it is 24px from the start, for the room from the
 * rounded corner of the dock, and so is the name beside it. The button is 16px from the end, in line with the tabs, the search and the list.
 */
const HEADER_HEIGHT = 80
const HEADER_INSET_START = 24
const HEADER_INSET_END = 16

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

/** The one way the dock changes, and the way it changes for a visitor who asks for less motion: at once. */
const SLOW = { duration: DURATION.slow, ease: EASE_STANDARD } as const
const STILL = { duration: 0 } as const

/** What the parts of the bar need to know of the dock they are in. */
const DockState = React.createContext({ open: false, reduced: false })

/**
 * What the bar shows only while the dock is closed, at its start: the games the friends are in. It folds away as the dock opens (its width and the margin after it, with the transition of the dock,
 * and its opacity, quickly, so that nothing is left to be cut off as it narrows) and the picture that follows it glides to the start of the bar; it unfolds as the dock closes. Folded, it takes no pointer and no focus.
 */
function DockGames({ children }: { children: React.ReactNode }) {
  const { open, reduced } = React.useContext(DockState)
  const travel = reduced ? STILL : SLOW
  return (
    <motion.div
      data-slot="social-dock-games"
      inert={open}
      initial={false}
      animate={
        open
          ? { width: 0, marginRight: 0, opacity: 0, transition: { width: travel, marginRight: travel, opacity: reduced ? STILL : { duration: DURATION.fast, ease: EASE_STANDARD } } }
          : { width: "auto", marginRight: 4, opacity: 1, transition: { width: travel, marginRight: travel, opacity: reduced ? STILL : { duration: DURATION.base, delay: DURATION.fast, ease: EASE_STANDARD } } }
      }
      className="flex shrink-0 items-center overflow-x-clip"
    >
      <div className="flex w-max shrink-0 items-center gap-1">{children}</div>
    </motion.div>
  )
}

/**
 * What the profile says beside the picture while the dock is open: the name and the word of the status. It goes inside the button of the profile, after the picture, and it is not there while the
 * dock is closed: it unfolds as the dock opens (its width, with the transition of the dock, then its opacity) and folds away as it closes.
 */
function SocialDockIdentity({ children, className }: { children: React.ReactNode; className?: string }) {
  const { open, reduced } = React.useContext(DockState)
  const travel = reduced ? STILL : SLOW
  return (
    <motion.span
      data-slot="social-dock-identity"
      aria-hidden={!open}
      initial={false}
      animate={
        open
          ? { width: "auto", marginLeft: 12, opacity: 1, transition: { width: travel, marginLeft: travel, opacity: reduced ? STILL : { duration: DURATION.base, delay: DURATION.fast, ease: EASE_STANDARD } } }
          : { width: 0, marginLeft: 0, opacity: 0, transition: { width: travel, marginLeft: travel, opacity: reduced ? STILL : { duration: DURATION.fast, ease: EASE_STANDARD } } }
      }
      className={cn("flex min-w-0 flex-col overflow-hidden text-left", className)}
    >
      {children}
    </motion.span>
  )
}

type SocialDockProps = {
  /** Whether the dock is open: a side panel with the profile for its header. Closed, it is the bar. */
  open: boolean
  /** The games the friends are in: at the start of the bar while the dock is closed, folded away while it is open. */
  games: React.ReactNode
  /** The profile: the visitor's picture, usually the trigger of the menu of their account, with a `SocialDockIdentity` after it for what it says while the dock is open. */
  profile: React.ReactNode
  /** The button that opens and closes the dock: at the end of the bar, in both states. */
  toggle: React.ReactNode
  /** The panel: what the dock shows under the bar while it is open. */
  children: React.ReactNode
  /** How high the open dock is, in px, where the window is not what it is measured against (the specimens of `/design`). */
  height?: number
  className?: string
}

function SocialDock({ open, games, profile, toggle, children, height, className }: SocialDockProps) {
  const room = React.useSyncExternalStore(subscribeToResize, readRoom, noRoom)
  const reduced = useReducedMotion() ?? false
  const place = React.useRef<HTMLDivElement>(null)
  const dock = React.useRef<HTMLDivElement>(null)
  const width = useMotionValue<number | "auto">("auto")
  // What the bar measured as the dock opened: the width it goes back to
  const closedWidth = React.useRef<number | null>(null)
  const started = React.useRef(false)
  const state = React.useMemo(() => ({ open, reduced }), [open, reduced])

  // The width of the dock, from what it is to what it becomes. It is measured as the dock opens, when the bar is still what it was (the parts of the bar start to change on the next frame),
  // and is kept for the way back; the place keeps it too, for as long as the dock is open.
  React.useLayoutEffect(() => {
    const element = dock.current
    const holder = place.current
    if (!element || !holder) return
    if (!started.current) {
      started.current = true
      if (open) width.set(COLUMN_WIDTH)
      return
    }
    const transition = reduced ? STILL : SLOW
    let cancelled = false
    if (open) {
      const from = element.offsetWidth
      if (width.get() === "auto") {
        closedWidth.current = from
        holder.style.width = `${from}px`
      }
      const controls = animate(width, [from, COLUMN_WIDTH], transition)
      return () => {
        cancelled = true
        controls.stop()
      }
    }
    const to = closedWidth.current
    if (to === null || width.get() === "auto") {
      width.set("auto")
      holder.style.width = ""
      return
    }
    const controls = animate(width, [element.offsetWidth, to], transition)
    controls.then(() => {
      if (cancelled) return
      width.set("auto")
      holder.style.width = ""
    })
    return () => {
      cancelled = true
      controls.stop()
    }
  }, [open, reduced, width])

  return (
    <MotionConfig reducedMotion="user">
      <DockState.Provider value={state}>
        <div ref={place} data-slot="social-dock-place" className="flex h-14 shrink-0 justify-end">
          <motion.div
            ref={dock}
            data-slot="social-dock"
            data-state={open ? "open" : "closed"}
            initial={false}
            animate={{ height: open ? (height ?? room) : BAR_HEIGHT }}
            transition={reduced ? STILL : SLOW}
            className={cn(
              "pointer-events-auto relative flex shrink-0 flex-col self-start overflow-hidden rounded-2xl border glass shadow-surface backdrop-blur-md transition-[border-radius] duration-slow ease-standard data-[state=open]:rounded-4xl",
              className
            )}
            style={{ width, maxWidth: "calc(100vw - 3rem)" }}
          >
            <motion.div
              data-slot="social-dock-bar"
              initial={false}
              animate={open ? { height: HEADER_HEIGHT, paddingLeft: HEADER_INSET_START, paddingRight: HEADER_INSET_END } : { height: BAR_INNER, paddingLeft: BAR_INSET, paddingRight: BAR_INSET }}
              transition={reduced ? STILL : SLOW}
              className="flex shrink-0 items-center"
            >
              <DockGames>{games}</DockGames>
              {profile}
              <div aria-hidden="true" className="min-w-1 flex-1" />
              {toggle}
            </motion.div>
            <AnimatePresence initial={false}>
              {open && (
                <motion.div
                  key="panel"
                  data-slot="social-dock-panel"
                  className="absolute right-0 bottom-0 flex flex-col"
                  style={{ width: `min(${COLUMN_WIDTH - 2}px, calc(100vw - 3rem - 2px))` }}
                  initial={{ opacity: 0, top: BAR_INNER }}
                  animate={{ opacity: 1, top: HEADER_HEIGHT, transition: reduced ? STILL : { opacity: { duration: DURATION.base, ease: EASE_STANDARD, delay: DURATION.fast }, top: SLOW } }}
                  exit={{ opacity: 0, transition: reduced ? STILL : { duration: DURATION.fast, ease: EASE_STANDARD } }}
                >
                  {children}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </div>
      </DockState.Provider>
    </MotionConfig>
  )
}

export { SocialDock, SocialDockIdentity }
