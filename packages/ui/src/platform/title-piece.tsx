import * as React from "react"
import { cn } from "../utils"
import { TitleCards } from "./title-cards"
import { TitleCoin } from "./title-coin"
import { TitleDie } from "./title-die"
import { TitleSuits } from "./title-suits"

// What stands for a letter or an ornament in the home's title, in the pieces of a game table (the utilities `title-piece` and `title-cards` of `styles/platform.css`, sized in `em` so they follow the title and set on
// its baseline): a die, a coin or the suits of a deck of cards for an "o", and two dark blue playing cards, the backs of a deck, that overlap between two words. They play, and not often (`PLAYFUL` of `@pbgo/ui/motion`,
// chosen on `/design`): the die rolls from the left to the right every fifteen seconds for 2 or 3 turns and switches between a six and a three (`TitleDie`), the suits scroll up like a wheel every fifteen seconds and stop on the heart, a red one and a white one in turn,
// faded at the top and at the bottom of their window and blurred as they go (`TitleSuits`), the coin is tossed now and then for 1 or 2 turns (`TitleCoin`), and the two cards fold up, come together and open again (`TitleCards`); a visitor who asks for less motion gets them still, the die on its six, the suit a heart and the coin on its profile. The letter a piece
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

export { TitleCards, TitlePiece }
export type { TitlePieceKind }
