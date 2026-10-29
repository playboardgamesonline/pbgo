import * as React from "react"
import { cn } from "../utils"
import { TitleCoin } from "./title-coin"
import { TitleDie } from "./title-die"
import { TitleSuits } from "./title-suits"

// What stands for a letter or an ornament in the home's title, in the pieces of a game table (the utilities `title-piece` and `title-cards` of `styles/platform.css`, sized in `em` so they follow the title and set on
// its baseline): a die, a coin or the suits of a deck of cards for an "o", and two dark blue playing cards, the backs of a deck, that overlap between two words. They play, and not often (`PLAYFUL` of `@pbgo/ui/motion`,
// chosen on `/design`): the die rolls from the left to the right every fifteen seconds for 3, 4 or 5 turns (`TitleDie`), the suits scroll up like a wheel to a random one every fifteen seconds, a red one and a black one in turn
// (`TitleSuits`), and the coin is tossed now and then for 5 or 6 turns (`TitleCoin`); a visitor who asks for less motion gets them still, the die on its five, the suit a heart and the coin on its profile. The letter a piece
// stands for stays in the page, for a screen reader and a search engine (`sr-only`), so the title reads as it is written; the cards stand for no letter, so they are `aria-hidden`.

type TitlePieceKind = "die" | "coin" | "suits"

/** A piece for a letter of the title, `children`: the letter itself, which is not drawn but is read. */
function TitlePiece({ kind, children, className, ...props }: Omit<React.ComponentProps<"span">, "children"> & { kind: TitlePieceKind; children: string }) {
  return (
    <span data-slot="title-piece" data-kind={kind} className={cn("title-piece", className)} {...props}>
      <span className="sr-only">{children}</span>
      {kind === "suits" && <TitleSuits />}
      {kind === "die" && <TitleDie />}
      {kind === "coin" && <TitleCoin />}
    </span>
  )
}

/** Two dark blue playing cards, the backs of a deck, that overlap, a little turned: an ornament between two words of the title, left out on a phone, where the line is as wide as the window lets it be. */
function TitleCards({ className, ...props }: Omit<React.ComponentProps<"span">, "children" | "aria-hidden">) {
  return (
    <span data-slot="title-cards" aria-hidden="true" className={cn("title-cards", className)} {...props}>
      <i />
      <i />
    </span>
  )
}

export { TitleCards, TitlePiece }
export type { TitlePieceKind }
