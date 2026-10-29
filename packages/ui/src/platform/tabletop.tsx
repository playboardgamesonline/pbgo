import * as React from "react"
import { cn } from "../utils"

// The backdrop of a hero: a plain table seen from above at a low angle, in perspective, under a lamp, with the pattern of a game on it (Courtisans'
// diamonds for now), picked out of the dark by a pool of light, the soft glow of the lamp at the top, and a fine grain. It is all CSS (the utilities `tabletop*` of `styles/platform.css`)
// and all `foreground` at a few percent, so it is made of no image and no colour of its own, and the title and the search bar keep the page. It is
// decorative: `aria-hidden`, and it takes no click.

/**
 * The table under the lamp, as wide and as high as the parent that gives it a size: a layer that is `absolute inset-0`, to lay in a `relative` section
 * whose content is `relative` too, so the content paints over it. It fades out at its foot, where the black of the page takes over. The tile of the
 * pattern is `--tabletop-tile`, where the table is nearest (6rem on a phone, growing with the window up to 10rem), and the perspective is measured in tiles. One day each game's own pattern may take its turn, one every
 * six seconds (not done).
 */
function Tabletop({ className, ...props }: Omit<React.ComponentProps<"div">, "children" | "aria-hidden">) {
  return (
    <div data-slot="tabletop" aria-hidden="true" className={cn("tabletop", className)} {...props}>
      <div className="tabletop-pool">
        <div className="tabletop-floor">
          <div className="tabletop-pattern" />
        </div>
      </div>
      <div className="tabletop-lamp" />
      <div className="tabletop-grain" />
    </div>
  )
}

export { Tabletop }
