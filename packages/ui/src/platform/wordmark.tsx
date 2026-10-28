import * as React from "react"
import { cn } from "../utils"

// The name of the brand as four big letters, PBGO, as wide as the room it is given: the footer's backdrop. The letters are set in the faces the logo
// is drawn in (the P blackletter, the B handwritten, the G pixel, the O script: `display-*`, `styles/platform.css`), so it is the logo's own lettering
// and not Geist. It is SVG text scaled by its viewBox, so it is always the width of its container.
//
// Each letter is placed by hand, from its measured ink and not from the advance of its glyph: the faces have very different side bearings, which
// left the P and the B nearly touching and a wide gap between the B and the G. So the boxes of the ink of two letters are 20 units apart, but the P
// and the B: the P is a bowl on top and a tail below with nothing in between at its right, so on its closest row the B was 69 units from it, against
// 20 for the B and the G and for the G and the O. The B and what follows come 33 units closer to the P (their boxes overlap, their shapes do not),
// which leaves the closest row about 38 units apart: nearer than it was, a little looser than the others, which is what looks right (50 units
// closer, as close as the others, was too tight). The ink of the P starts at the left edge of the viewBox and the ink of the O ends
// at its right edge, and the four letters are aligned on the middle of their ink, not on a baseline (the P and the O have a tail under it that the
// B and the G do not, and a baseline would drop them). The numbers come from `measureText` of a canvas at 360 units, with the faces' own scales
// (0.92, 1, 1.28, 0.92), then scaled so the ink fills 1000 units; the spaces were measured on the letters as drawn, row by row. Do both again when
// a face changes. The fill fades from the colour of the footer's text (`--muted-foreground`) at the top of the ink (y 20, in the units of the
// viewBox: the gradient is not measured on the box of the text, which starts well above the capitals) to nothing at nine tenths of its height (y 292),
// so the last tenth of the letters is transparent and the rest is the gradient. The box of the drawing ends where the ink does. It is decorative: the brand is named by the logo and the page's own text.

/** The letters PBGO across the width of the container, in the faces of the logo, fading out before the bottom. Size it with the width of its parent. */
function Wordmark({ className, ...props }: Omit<React.ComponentProps<"svg">, "children" | "viewBox" | "aria-hidden">) {
  const fade = React.useId()
  return (
    <svg
      data-slot="wordmark"
      viewBox="0 0 1000 324.7"
      aria-hidden="true"
      className={cn("block w-full overflow-visible select-none", className)}
      {...props}
    >
      <defs>
        <linearGradient id={fade} gradientUnits="userSpaceOnUse" x1="0" y1="20" x2="0" y2="292">
          <stop offset="0" style={{ stopColor: "var(--muted-foreground)" }} />
          <stop offset="0.78" style={{ stopColor: "var(--muted-foreground)", stopOpacity: 0 }} />
        </linearGradient>
      </defs>
      <text fontSize="384.0" fill={`url(#${fade})`}>
        <tspan x="-5.4" y="257.0" className="display-fraktur">P</tspan>
        <tspan x="299.6" y="296.7" className="display-unkempt">B</tspan>
        <tspan x="548.1" y="299.0" className="display-jersey">G</tspan>
        <tspan x="762.3" y="258.5" className="display-birthstone">O</tspan>
      </text>
    </svg>
  )
}

export { Wordmark }
