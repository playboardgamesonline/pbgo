"use client"

import * as React from "react"
import { ArrowLeft01Icon, ArrowRight01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { cn } from "../utils"
import { Button } from "./button"

// A single row of cards that scrolls sideways, under a title: the games related to a game, at the foot of its page. The cards keep one width (18rem, 16rem on a phone), so that the next one is always half in view and says that there is
// more, and they snap to the start of the row as it scrolls. The row runs out to the edges of the page, past its gutters, and its first card starts where the page does. It scrolls with the pointer, a trackpad, a swipe or the keyboard (a
// card is a link, and focus brings it into view), and the two buttons at the end of the title move it by most of its width, which a mouse with no sideways wheel needs; they are only there when the row holds more than it shows, and each is
// disabled at its end. Less motion asked for, it jumps. It draws no scrollbar.

type ScrollRowProps = Omit<React.ComponentProps<"section">, "title" | "aria-labelledby"> & {
  /** The title of the section. */
  title: string
}

function ScrollRow({ title, className, children, ...props }: ScrollRowProps) {
  const headingId = React.useId()
  const track = React.useRef<HTMLDivElement>(null)
  const [edges, setEdges] = React.useState({ start: true, end: true })

  const measure = React.useCallback(() => {
    const element = track.current
    if (!element) return
    setEdges({ start: element.scrollLeft <= 1, end: element.scrollLeft + element.clientWidth >= element.scrollWidth - 1 })
  }, [])

  React.useEffect(() => {
    const element = track.current
    if (!element) return
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    return () => observer.disconnect()
  }, [measure, children])

  const scroll = (direction: -1 | 1) => {
    const element = track.current
    if (!element) return
    const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    element.scrollBy({ left: direction * element.clientWidth * 0.8, behavior: calm ? "auto" : "smooth" })
  }

  const scrollable = !(edges.start && edges.end)
  return (
    <section data-slot="scroll-row" aria-labelledby={headingId} className={className} {...props}>
      <div className="mb-6 flex min-h-9 items-center justify-between gap-4">
        <h2 id={headingId} className="font-heading text-2xl">
          {title}
        </h2>
        {scrollable && (
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="icon" aria-label={`Scroll ${title} back`} disabled={edges.start} onClick={() => scroll(-1)}>
              <HugeiconsIcon icon={ArrowLeft01Icon} strokeWidth={2} aria-hidden="true" />
            </Button>
            <Button type="button" variant="outline" size="icon" aria-label={`Scroll ${title} forward`} disabled={edges.end} onClick={() => scroll(1)}>
              <HugeiconsIcon icon={ArrowRight01Icon} strokeWidth={2} aria-hidden="true" />
            </Button>
          </div>
        )}
      </div>
      {/* The padding above and below, taken back by the negative margin, leaves room for the ring and the shadow of a card that rises, which a scroll container would clip */}
      <div
        ref={track}
        onScroll={measure}
        data-slot="scroll-row-track"
        className="-mx-gutter -my-2 flex snap-x snap-mandatory scroll-px-gutter gap-4 overflow-x-auto px-gutter py-2 [scrollbar-width:none] *:w-64 *:shrink-0 *:snap-start sm:*:w-72 [&::-webkit-scrollbar]:hidden"
      >
        {children}
      </div>
    </section>
  )
}

export { ScrollRow }
export type { ScrollRowProps }
