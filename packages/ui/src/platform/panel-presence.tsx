"use client"

import * as React from "react"
import { AnimatePresence, MotionConfig, motion } from "motion/react"
import { DURATION, EASE_STANDARD } from "../motion"
import { cn } from "../utils"

// What lets a panel that a page shows and hides (the social panel, a chat window) arrive and leave instead of appearing and vanishing: it slides a few rem in from
// the edge it belongs to, fades and settles a little (`DURATION.slow`, `EASE_STANDARD`), and goes the same way back, which a panel that is only no longer rendered cannot
// do: it keeps the last panel it was given while it leaves. The page places it (`className`: `fixed`, an edge, a size) and the panel fills it. A visitor who asks for
// less motion gets the fade and no travel (`reducedMotion="user"`). It takes the pointer back (`pointer-events-auto`): the navbar that the page mounts it in lets it through, and a
// panel that inherited that could not be clicked.

const FROM = {
  right: { x: 24, y: 0, transformOrigin: "top right" },
  bottom: { x: 0, y: 24, transformOrigin: "bottom right" },
} as const

type PanelPresenceProps = {
  /** Whether the panel is shown. */
  open: boolean
  /** The edge it comes from and goes back to. */
  from?: keyof typeof FROM
  /** Where it stands and how big it is: the page's. */
  className?: string
  children: React.ReactNode
}

function PanelPresence({ open, from = "right", className, children }: PanelPresenceProps) {
  const gone = { opacity: 0, scale: 0.98, ...FROM[from] }
  return (
    <MotionConfig reducedMotion="user">
      <AnimatePresence>
        {open && (
          <motion.div
            data-slot="panel-presence"
            className={cn("pointer-events-auto", className)}
            initial={gone}
            animate={{ opacity: 1, scale: 1, x: 0, y: 0 }}
            exit={gone}
            transition={{ duration: DURATION.slow, ease: EASE_STANDARD }}
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </MotionConfig>
  )
}

export { PanelPresence }
