import { Fragment } from "react"
import { ArrowUpRight01Icon, ShoppingBag01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { Button } from "@pbgo/ui/platform/button"
import { CreditLink } from "@pbgo/ui/platform/credit-link"
import { cn } from "@pbgo/ui/utils"
import type { GamePage } from "@/lib/game-page"
import { BggButton } from "./bgg-button"

// The credits of a game, in the head of its page under the buttons, small and quiet (14px, the muted text): the people and the publishers, then the year the game came out, packed in one line that wraps, with no label and a "·" after each term but the last. The labels (Designer, Artist, Publisher, each in the plural when there are
// several, and Released) are not drawn: a screen reader still has them, before each term, and does not read the dots. At the end of the line come the buttons that belong to them, as small and as quiet: a link to buy the game in a shop, there only when the Studio has a shop's page for the game, and BoardGameGeek's icon, a small button that
// leads to the game's page there (`BggButton`: its icon and "Powered by BGG", the credit BoardGameGeek asks for the figures it gives the catalog), there only when the Studio has the game's id. A publisher is a link to its website, with the icon of that site before its name, the two being one link. Nothing is drawn when the Studio has none of it: nothing stands in for what is missing.

export type GameCreditsProps = Pick<GamePage, "facts" | "bgg" | "shop"> & { slug: string; className?: string }

export function GameCredits({ slug, facts, bgg, shop, className }: GameCreditsProps) {
  if (facts.length === 0 && !bgg && !shop) return null

  return (
    <div role="group" aria-label="Credits" data-slot="game-credits" className={cn("flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-muted-foreground/60", className)}>
      {facts.length > 0 && (
        <ul className="flex flex-wrap">
          {facts.map((fact, index) => (
            <li key={fact.label} className="text-muted-foreground">
              <span className="sr-only">{fact.label}: </span>
              {fact.values.map((value, valueIndex) => (
                <Fragment key={`${value.text}-${valueIndex}`}>
                  {valueIndex > 0 && ", "}
                  {value.href ? (
                    <CreditLink href={value.href} icon={value.icon} className="text-muted-foreground">
                      {value.text}
                    </CreditLink>
                  ) : (
                    value.text
                  )}
                </Fragment>
              ))}
              {index < facts.length - 1 && (
                <span aria-hidden="true" className="px-2 text-muted-foreground/60">
                  ·
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
      {(shop || bgg) && (
        <div className="flex items-center gap-2">
          {shop && (
            <Button variant="ghost" size="sm" className="text-muted-foreground/60 hover:text-foreground" asChild>
              <a href={shop} target="_blank" rel="noopener noreferrer" data-cta="buy" data-cta-game={slug}>
                <HugeiconsIcon icon={ShoppingBag01Icon} strokeWidth={2} data-icon="inline-start" aria-hidden="true" />
                Buy the game
                <HugeiconsIcon icon={ArrowUpRight01Icon} strokeWidth={2} data-icon="inline-end" aria-hidden="true" />
              </a>
            </Button>
          )}
          {bgg && <BggButton href={bgg.href} icon={bgg.icon} />}
        </div>
      )}
    </div>
  )
}
