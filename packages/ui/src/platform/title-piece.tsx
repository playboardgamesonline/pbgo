import * as React from "react"
import { cn } from "../utils"
import { Suit, type SuitName } from "./suits"
import { TitleCoin } from "./title-coin"

// What stands for a letter or an ornament in the home's title, in the pieces of a game table (the utilities `title-piece` and `title-cards` of `styles/platform.css`, sized in `em` so they follow the title
// and set on its baseline): a die, a coin or the suits of a deck of cards for an "o", and two white playing cards that overlap between two words. They move, slowly: the die is flat and turns in its plane, a turn
// in a second and a half at each change of face, every four seconds (CSS keyframes, no script), the suit turns into the next one every four seconds (a heart, a diamond, a club, a spade), and the coin spins on itself for 5 or 6 half turns, in about seven seconds (`TitleCoin`, the one
// piece that needs a script, since a keyframe cannot be left to chance); a visitor who asks for less motion gets them still, the die on its five, the coin on its profile and the suit a heart. The letter a
// piece stands for stays in the page, for a screen reader and a search engine (`sr-only`), so the title reads as it is written; the cards stand for no letter, so they are `aria-hidden`.

type TitlePieceKind = "die" | "coin" | "suits"

/** The suits in the order they take each other's place. */
const SUITS: readonly SuitName[] = ["heart", "diamond", "club", "spade"]

/** The faces the die of the title shows, one after the other: its five first, the one a visitor who asks for less motion keeps. */
const DIE_FACES = [5, 3, 2, 6, 4, 1] as const

/** A piece for a letter of the title, `children`: the letter itself, which is not drawn but is read. */
function TitlePiece({ kind, children, className, ...props }: Omit<React.ComponentProps<"span">, "children"> & { kind: TitlePieceKind; children: string }) {
  return (
    <span data-slot="title-piece" data-kind={kind} className={cn("title-piece", className)} {...props}>
      <span className="sr-only">{children}</span>
      {kind === "suits" && SUITS.map((suit, index) => <Suit key={suit} suit={suit} style={{ "--i": index } as React.CSSProperties} />)}
      {kind === "die" && (
        <i data-slot="die" aria-hidden="true">
          {DIE_FACES.map((pips, index) => (
            <b key={pips} data-pips={pips} className="die-pips" style={{ "--i": index } as React.CSSProperties} />
          ))}
        </i>
      )}
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
