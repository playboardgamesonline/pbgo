import * as React from "react"
import { cn } from "../utils"

type CoverTileProps = Omit<React.ComponentProps<"span">, "children"> & {
  /** URL of a picture that fills the frame, cropped to it (a game's cover, or its background). */
  picture?: string
  /** URL of a logo or an icon, contained on the plain frame: for a game with no `picture`. */
  logo?: string
}

/**
 * A small frame for the picture of a game, where a whole card is too much: an option of a list, a chip, a row of favourites. It draws what it is given and chooses nothing, as the card does (`gamePicture` of the hub): a `picture` fills the frame, else a `logo` is
 * contained on it, else it is a plain frame. Its size and its corners are the caller's (`className`); the picture is a URL, since the package is framework-free.
 */
function CoverTile({ className, picture, logo, ...props }: CoverTileProps) {
  return (
    <span data-slot="cover-tile" className={cn("relative inline-block size-10 shrink-0 overflow-hidden rounded-xl bg-muted", className)} {...props}>
      {picture && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={picture} alt="" loading="lazy" decoding="async" className="absolute inset-0 size-full object-cover" />
      )}
      {!picture && logo && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logo} alt="" loading="lazy" decoding="async" className="absolute inset-0 size-full object-contain p-1" />
      )}
    </span>
  )
}

export { CoverTile }
export type { CoverTileProps }
