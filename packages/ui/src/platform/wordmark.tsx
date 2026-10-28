import * as React from "react"
import { cn } from "../utils"

// The name of the brand as four big letters, PBGO, as wide as the room it is given: the footer's backdrop. It is SVG text scaled by its viewBox,
// so it is always the width of its container whatever the screen, and `textLength` pins that width whatever font answers (the letters are
// spaced out to fill it, never stretched), so nothing moves when Geist arrives. The text starts a little left of the viewBox and runs a little
// past it: that is the side bearings of Geist's P and O, so the ink of the letters, not their boxes, is flush with the container's edges (measured:
// no gap on either side at 390 and 1440 px). Low contrast (`fill-secondary`, a step above the page), so it is a drawing behind the page's text and
// not a title. It is decorative: the brand is named by the logo and the page's own text.

/** The letters PBGO across the width of the container, in the platform's face and a low-contrast fill. Size it with the width of its parent. */
function Wordmark({ className, ...props }: Omit<React.ComponentProps<"svg">, "children" | "viewBox" | "aria-hidden">) {
  return (
    <svg
      data-slot="wordmark"
      viewBox="0 0 1000 280"
      aria-hidden="true"
      className={cn("block w-full fill-secondary select-none", className)}
      {...props}
    >
      <text x="-29.5" y="268" fontSize="360" textLength="1046" lengthAdjust="spacing" className="font-heading">
        PBGO
      </text>
    </svg>
  )
}

export { Wordmark }
