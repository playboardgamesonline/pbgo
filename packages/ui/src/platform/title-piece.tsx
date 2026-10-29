import * as React from "react"
import { cn } from "../utils"
import { Suit, type SuitName } from "./suits"
import { TitleCoin } from "./title-coin"
import { TitleDie } from "./title-die"

// What stands for a letter or an ornament in the home's title, in the pieces of a game table (the utilities `title-piece` and `title-cards` of `styles/platform.css`, sized in `em` so they follow the title
// and set on its baseline): a die, a coin or the suits of a deck of cards for an "o", and two white playing cards that overlap between two words. They move, and not often: the suit rolls up into the next one every fifteen seconds, leaving by the top as the next comes in from the bottom (a heart, a spade, a diamond, a club: a red one and a black one in turn; CSS keyframes, no script), the die is flat and rolls from the left
// to the right every fifteen seconds for 3, 4 or 5 turns (`TitleDie`) and the coin spins on itself, now and then, for 5 or 6 turns, in eight or ten seconds (`TitleCoin`); those two need a script, since a keyframe cannot be left to chance; a visitor who asks for less motion gets them still, the die on its five, the coin on its profile and the suit a heart. The letter a
// piece stands for stays in the page, for a screen reader and a search engine (`sr-only`), so the title reads as it is written; the cards stand for no letter, so they are `aria-hidden`.

type TitlePieceKind = "die" | "coin" | "suits"

/** The suits in the order they take each other's place: a red one and a black one in turn, the heart first (the one a visitor who asks for less motion keeps). */
const SUITS: readonly SuitName[] = ["heart", "spade", "diamond", "club"]

/** A piece for a letter of the title, `children`: the letter itself, which is not drawn but is read. */
function TitlePiece({ kind, children, className, ...props }: Omit<React.ComponentProps<"span">, "children"> & { kind: TitlePieceKind; children: string }) {
  return (
    <span data-slot="title-piece" data-kind={kind} className={cn("title-piece", className)} {...props}>
      <span className="sr-only">{children}</span>
      {kind === "suits" && SUITS.map((suit, index) => <Suit key={suit} suit={suit} style={{ "--i": index } as React.CSSProperties} />)}
      {kind === "die" && <TitleDie />}
      {kind === "coin" && <TitleCoin />}
    </span>
  )
}

/** Two white playing cards that overlap, a little turned: an ornament between two words of the title, left out on a phone, where the line is as wide as the window lets it be. */
function TitleCards({ className, ...props }: Omit<React.ComponentProps<"span">, "children" | "aria-hidden">) {
  return (
    <span data-slot="title-cards" aria-hidden="true" className={cn("title-cards", className)} {...props}>
      <i>
        <Suit suit="spade" />
      </i>
      <i>
        <Suit suit="diamond" />
      </i>
    </span>
  )
}

export { TitleCards, TitlePiece }
export type { TitlePieceKind }
