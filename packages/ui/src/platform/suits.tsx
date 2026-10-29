import * as React from "react"

// The four suits of a deck of cards, drawn in a 24 × 24 box on `currentColor` (a fill), as the pips of a French deck are: a heart with two round lobes and a pointed foot, a diamond with four straight sides, a spade (a heart
// upside down, with a stem) and a club (three discs and a stem). The playing cards of the hero's table (`Tabletop`) wear them, and the heart is the "o" of a word in its title (`TitlePiece`). They are decorative: `aria-hidden`.

type SuitName = "heart" | "diamond" | "spade" | "club"

function Suit({ suit, ...props }: Omit<React.ComponentProps<"svg">, "children" | "viewBox" | "aria-hidden"> & { suit: SuitName }) {
  return (
    <svg data-slot="suit" data-suit={suit} viewBox="0 0 24 24" aria-hidden="true" {...props}>
      {suit === "heart" && <path d="M12 22.5C10.2 20.3 2 14.6 2 8.4 2 4.9 4.5 2.5 7.5 2.5c1.9 0 3.6 1 4.5 2.8.9-1.8 2.6-2.8 4.5-2.8 3 0 5.5 2.4 5.5 5.9 0 6.2-8.2 11.9-10 14.1Z" />}
      {suit === "diamond" && <path d="M12 1.5 20.5 12 12 22.5 3.5 12Z" />}
      {suit === "spade" && (
        <path d="M12 1.5C9.5 6.2 2.5 8.7 2.5 14.4a4.9 4.9 0 0 0 8.4 3.5C10.7 20.2 10 21.5 8 22.5h8c-2-1-2.7-2.3-2.9-4.6a4.9 4.9 0 0 0 8.4-3.5C21.5 8.7 14.5 6.2 12 1.5Z" />
      )}
      {suit === "club" && (
        <>
          <circle cx="12" cy="6.6" r="4.7" />
          <circle cx="6.5" cy="13.6" r="4.7" />
          <circle cx="17.5" cy="13.6" r="4.7" />
          <path d="M10.6 14h2.8c-.1 3.4.9 6.7 2.6 8.5H8c1.7-1.8 2.7-5.1 2.6-8.5Z" />
        </>
      )}
    </svg>
  )
}

export { Suit }
export type { SuitName }
