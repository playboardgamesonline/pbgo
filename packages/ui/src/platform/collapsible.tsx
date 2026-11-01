"use client"

import * as React from "react"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import { Slot } from "radix-ui"
import { DURATION, EASE_STANDARD } from "../motion"
import { cn } from "../utils"

// A block that unrolls: a trigger, and what it shows. It draws nothing of its own (the page gives the trigger its look, a button of a row, a head of a list), it only keeps whether the block is open and moves the height of what it holds, the way the heads of
// the friends' roster do: `DURATION.slow` with `EASE_STANDARD`, and no motion at all when less motion is asked for. What is closed is not in the page, so it is neither read by a screen reader nor reached by the keyboard, and what it holds is
// only drawn once it opens. The state is the block's own, or the page's (`open` and `onOpenChange`).

type CollapsibleContext = { open: boolean; setOpen: (open: boolean) => void; contentId: string }

const Context = React.createContext<CollapsibleContext | null>(null)

function useCollapsible(): CollapsibleContext {
  const context = React.useContext(Context)
  if (!context) throw new Error("CollapsibleTrigger and CollapsibleContent go inside a Collapsible")
  return context
}

type CollapsibleProps = React.ComponentProps<"div"> & {
  /** Whether it is open, when the page keeps that itself (with `onOpenChange`). */
  open?: boolean
  /** Whether it starts open, when it keeps that itself. */
  defaultOpen?: boolean
  onOpenChange?: (open: boolean) => void
}

function Collapsible({ open: controlled, defaultOpen = false, onOpenChange, className, ...props }: CollapsibleProps) {
  const [own, setOwn] = React.useState(defaultOpen)
  const contentId = React.useId()
  const open = controlled ?? own
  const setOpen = (next: boolean) => {
    setOwn(next)
    onOpenChange?.(next)
  }
  return (
    <Context.Provider value={{ open, setOpen, contentId }}>
      <div data-slot="collapsible" data-state={open ? "open" : "closed"} className={className} {...props} />
    </Context.Provider>
  )
}

/** The button that opens and closes the block: it says so (`aria-expanded`) and points at what it opens. `asChild` gives its behaviour to the element the page draws. */
function CollapsibleTrigger({ asChild = false, onClick, ...props }: React.ComponentProps<"button"> & { asChild?: boolean }) {
  const { open, setOpen, contentId } = useCollapsible()
  const Comp = asChild ? Slot.Root : "button"
  return (
    <Comp
      data-slot="collapsible-trigger"
      data-state={open ? "open" : "closed"}
      type={asChild ? undefined : "button"}
      aria-expanded={open}
      aria-controls={contentId}
      onClick={(event: React.MouseEvent<HTMLButtonElement>) => {
        onClick?.(event)
        if (!event.defaultPrevented) setOpen(!open)
      }}
      {...props}
    />
  )
}

/** What the block shows while it is open: it unrolls from nothing to its height and rolls back up. */
function CollapsibleContent({ className, children, ...props }: Omit<React.ComponentProps<"div">, "ref" | "onDrag" | "onDragStart" | "onDragEnd" | "onAnimationStart">) {
  const { open, contentId } = useCollapsible()
  const transition = useReducedMotion() ? { duration: 0 } : { duration: DURATION.slow, ease: EASE_STANDARD }
  return (
    <AnimatePresence initial={false}>
      {open && (
        <motion.div
          key="content"
          id={contentId}
          data-slot="collapsible-content"
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={transition}
          className={cn("overflow-hidden", className)}
          {...props}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export { Collapsible, CollapsibleContent, CollapsibleTrigger }
export type { CollapsibleProps }
