import * as React from "react"
import { cn } from "../utils"

// The name of the brand as four big letters, PBGO, as wide as the room it is given: the footer's backdrop. The letters are set in the faces the logo
// is drawn in (the P blackletter, the B handwritten, the G pixel, the O script: `display-*`, `styles/platform.css`), so it is the logo's own lettering
// and not Geist. It is SVG text scaled by its viewBox, so it is always the width of its container, and `textLength` pins that width whatever font
// answers (the letters are spaced out to fill it, never stretched), so nothing moves when the fonts arrive. The text starts a little left of the
// viewBox and runs a little past it: that is the side bearings of the P and the O, so the ink of the letters, not their boxes, is flush with the
// container's edges (measured in the page, see `docs/design-system.md`). Low contrast (`fill-secondary`, a step above the page), so it is a drawing
// behind the page's text and not a title. It is decorative: the brand is named by the logo and the page's own text.

/** The letters PBGO across the width of the container, in the faces of the logo and a low-contrast fill. Size it with the width of its parent. */
function Wordmark({ className, ...props }: Omit<React.ComponentProps<"svg">, "children" | "viewBox" | "aria-hidden">) {
  return (
    <svg
      data-slot="wordmark"
      viewBox="0 0 1000 320"
      aria-hidden="true"
      className={cn("block w-full overflow-visible fill-secondary select-none", className)}
      {...props}
    >
      <text x="-5" y="270" fontSize="360" textLength="1008" lengthAdjust="spacing">
        <tspan className="display-fraktur">P</tspan>
        <tspan className="display-unkempt">B</tspan>
        <tspan className="display-jersey">G</tspan>
        <tspan className="display-birthstone">O</tspan>
      </text>
    </svg>
  )
}

export { Wordmark }
