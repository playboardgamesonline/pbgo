import * as React from "react"
import { cn } from "../utils"
import { Suit, type SuitName } from "./suits"

// What stands for a letter or an ornament in the home's title, in the pieces of a game table (the utilities `title-piece` and `title-cards` of `styles/platform.css`, sized in `em` so they follow the title
// and set on its baseline): a die, a coin or the suits of a deck of cards for an "o", and two white playing cards that overlap between two words. They move, with CSS alone (transforms, no script): the die
// turns to show another of its faces, the coin spins on itself, from the top to the bottom, to show heads (a profile) and tails (a star) in turn, the suit turns into the next one (a heart, a diamond, a club, a spade); a visitor who asks for less motion gets
// them still, the die on its five, the coin on its profile and the suit a heart. The letter a piece stands for stays in the page, for a screen reader and a search engine (`sr-only`), so the title reads as it is
// written; the cards stand for no letter, so they are `aria-hidden`.

type TitlePieceKind = "die" | "coin" | "suits"

/** The suits in the order they take each other's place. */
const SUITS: readonly SuitName[] = ["heart", "diamond", "club", "spade"]

/** The faces of the die of the title and the pips they show: the front first, then the sides in the order the die turns to them; opposite faces make seven. */
const DIE_FACES = [
  ["front", 5],
  ["right", 3],
  ["back", 2],
  ["left", 4],
  ["top", 6],
  ["bottom", 1],
] as const

/** A piece for a letter of the title, `children`: the letter itself, which is not drawn but is read. */
function TitlePiece({ kind, children, className, ...props }: Omit<React.ComponentProps<"span">, "children"> & { kind: TitlePieceKind; children: string }) {
  return (
    <span data-slot="title-piece" data-kind={kind} className={cn("title-piece", className)} {...props}>
      <span className="sr-only">{children}</span>
      {kind === "suits" && SUITS.map((suit, index) => <Suit key={suit} suit={suit} style={{ "--i": index } as React.CSSProperties} />)}
      {kind === "die" && (
        <i data-slot="cube" aria-hidden="true">
          {DIE_FACES.map(([face, pips]) => (
            <b key={face} data-face={face} data-pips={pips} className="die-pips" />
          ))}
        </i>
      )}
      {kind === "coin" && (
        <i data-slot="coin" aria-hidden="true">
          <b data-face="heads">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M9.2 2.8C12.6 1.6 16.1 3 16.8 6.6L17.4 8.8L19.3 11.8L17.7 12.5L18.1 13.6L17.4 14.3L17.9 15.8L16.5 16.9L16.4 18.2C19.2 19 20.7 20.5 21.2 22.4H3.8C4.3 20 6.2 18.8 8.4 18.3C7 16.2 6.3 13.6 6.5 10.9C6.6 7.2 7.6 4.2 9.2 2.8Z" />
            </svg>
          </b>
          <b data-face="tails" />
        </i>
      )}
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
