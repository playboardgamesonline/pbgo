import * as React from "react"
import { cn } from "../utils"

// The backdrop of a hero: a table of board games seen from above at a low angle, in perspective, under a lamp, with nothing on it. It is all CSS (the utility `tabletop` of `styles/platform.css` draws the planks, the lamp
// and the shade from the `data-slot` attributes set here), so it is made of no image, it is decorative (`aria-hidden`) and it takes no click. The colours are those of a game table (`--wood-*`, `--piece-*`), the hero's alone,
// and the title and the search bar keep the page over them. Nothing moves: the table is a still scene.

/**
 * The table under the lamp, as wide and as high as the parent that gives it a size: a layer that is `absolute inset-0`, to lay in a `relative` section whose content is `relative` too, so the content paints over it.
 * It fades out at its foot, where the black of the page takes over.
 */
function Tabletop({ className, ...props }: Omit<React.ComponentProps<"div">, "children" | "aria-hidden">) {
  return (
    <div data-slot="tabletop" aria-hidden="true" className={cn("tabletop", className)} {...props}>
      <div data-slot="tabletop-light" />
      <div data-slot="tabletop-stage">
        <div data-slot="tabletop-plane">
          <div data-slot="tabletop-wood" />
        </div>
      </div>
      <div data-slot="tabletop-shade" />
    </div>
  )
}

export { Tabletop }
