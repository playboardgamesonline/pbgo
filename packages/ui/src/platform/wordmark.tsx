import * as React from "react"
import { cn } from "../utils"

// The name of the brand as four big letters, PBGO, as wide as the room it is given: the footer's backdrop. The letters are set in the faces the logo
// is drawn in (the P blackletter, the B handwritten, the G pixel, the O script: `display-*`, `styles/platform.css`), so it is the logo's own lettering
// and not Geist. It is SVG text scaled by its viewBox, so it is always the width of its container.
//
// Each letter is placed by hand, from its measured ink and not from the advance of its glyph: the faces have very different side bearings, which
// left the P and the B nearly touching and a wide gap between the B and the G. So the gap between the ink of two letters is the same (20 units), the
// ink of the P starts at the left edge of the viewBox and the ink of the O ends at its right edge, and the four letters are aligned on the middle of
// their ink, not on a baseline (the P and the O have a tail under it that the B and the G do not, and a baseline would drop them). The numbers come
// from `measureText` of a canvas at 360 units, with the faces' own scales (0.92, 1, 1.28, 0.92), then scaled so the ink fills 1000 units; measure
// them again when a face changes. The fill fades from the colour of a backdrop one step above the page (`--secondary`) at the top to nothing at
// the bottom. It is decorative: the brand is named by the logo and the page's own text.

/** The letters PBGO across the width of the container, in the faces of the logo, fading out at the bottom. Size it with the width of its parent. */
function Wordmark({ className, ...props }: Omit<React.ComponentProps<"svg">, "children" | "viewBox" | "aria-hidden">) {
  const fade = React.useId()
  return (
    <svg
      data-slot="wordmark"
      viewBox="0 0 1000 314"
      aria-hidden="true"
      className={cn("block w-full overflow-visible select-none", className)}
      {...props}
    >
      <defs>
        <linearGradient id={fade} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" style={{ stopColor: "var(--secondary)" }} />
          <stop offset="1" style={{ stopColor: "var(--secondary)", stopOpacity: 0 }} />
        </linearGradient>
      </defs>
      <text fontSize="371.3" fill={`url(#${fade})`}>
        <tspan x="-5.2" y="248.5" className="display-fraktur">P</tspan>
        <tspan x="322.7" y="286.9" className="display-unkempt">B</tspan>
        <tspan x="563.0" y="289.1" className="display-jersey">G</tspan>
        <tspan x="770.1" y="250.0" className="display-birthstone">O</tspan>
      </text>
    </svg>
  )
}

export { Wordmark }
