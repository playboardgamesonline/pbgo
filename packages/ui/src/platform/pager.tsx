"use client"

import * as React from "react"
import { prefersReducedMotion } from "../reduced-motion"
import { cn } from "../utils"

// A list that scrolls sideways one page at a time, with a dot under it for each page: the open tournaments of the home, as many to a page as the height it has lets it show. Each page is as wide as the pager and snaps to its start, from the left to the right; they scroll with the pointer, a
// trackpad, a swipe or the keyboard (the pager takes the focus, and the arrow keys move it), and a press on a dot goes to its page, which jumps when less motion is asked for. The dots are there from two pages on, and the row they stand in keeps its height with one, so that what is above it does
// not move when pages come or go. The pager takes the height it is given (`min-h-0` and `flex-1`: give it a height, or put it in a column that has one) and its pages are as tall as it is: what a page holds over that is cut, so the page decides how much it holds. It draws no scrollbar and decides
// nothing: what is on each page and how many pages there are are the caller's.

type PagerProps = Omit<React.ComponentProps<"div">, "children"> & {
  /** What each page holds, in order. */
  pages: readonly React.ReactNode[]
  /** Names the pager for a screen reader: its pages are "1 of 3", "2 of 3"… of it. */
  label: string
}

function Pager({ pages, label, className, ...props }: PagerProps) {
  const track = React.useRef<HTMLDivElement>(null)
  const current = React.useRef(0)
  const [active, setActive] = React.useState(0)
  const count = pages.length

  const settle = React.useCallback((index: number) => {
    current.current = index
    setActive(index)
  }, [])

  // The page that is in view, from how far the track has scrolled
  const onScroll = () => {
    const element = track.current
    if (!element || element.clientWidth === 0) return
    settle(Math.max(0, Math.min(count - 1, Math.round(element.scrollLeft / element.clientWidth))))
  }

  // A pager that is wider or narrower stays on its page, and one with fewer pages than before goes to the last it has
  React.useEffect(() => {
    const element = track.current
    if (!element) return
    const keep = () => {
      element.scrollLeft = current.current * element.clientWidth
    }
    const observer = new ResizeObserver(keep)
    observer.observe(element)
    return () => observer.disconnect()
  }, [])
  React.useEffect(() => {
    const element = track.current
    if (!element || current.current <= count - 1) return
    settle(Math.max(0, count - 1))
    element.scrollLeft = current.current * element.clientWidth
  }, [count, settle])

  const go = (index: number) => {
    const element = track.current
    if (!element) return
    element.scrollTo({ left: index * element.clientWidth, behavior: prefersReducedMotion() ? "auto" : "smooth" })
  }

  return (
    <div data-slot="pager" className={cn("flex min-h-0 flex-col gap-3", className)} {...props}>
      <div
        ref={track}
        role="region"
        aria-roledescription="carousel"
        aria-label={label}
        tabIndex={0}
        onScroll={onScroll}
        data-slot="pager-track"
        className="flex min-h-0 flex-1 snap-x snap-mandatory overflow-x-auto overflow-y-hidden rounded-2xl outline-none focus-visible:ring-3 focus-visible:ring-ring/30 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {pages.map((page, index) => (
          <div key={index} role="group" aria-roledescription="slide" aria-label={`${index + 1} of ${count}`} data-slot="pager-page" className="h-full w-full shrink-0 snap-start">
            {page}
          </div>
        ))}
      </div>
      <div data-slot="pager-dots" className="flex h-5 shrink-0 items-center justify-center">
        {count > 1 &&
          pages.map((_, index) => (
            <button
              key={index}
              type="button"
              aria-label={`Page ${index + 1} of ${count}`}
              aria-current={index === active ? "true" : undefined}
              onClick={() => go(index)}
              className="group/dot flex size-5 items-center justify-center rounded-full outline-none focus-visible:ring-3 focus-visible:ring-ring/30"
            >
              <span aria-hidden="true" className="size-2 rounded-full bg-muted-foreground/40 transition-colors duration-fast group-hover/dot:bg-muted-foreground group-aria-[current=true]/dot:bg-foreground" />
            </button>
          ))}
      </div>
    </div>
  )
}

export { Pager }
export type { PagerProps }
