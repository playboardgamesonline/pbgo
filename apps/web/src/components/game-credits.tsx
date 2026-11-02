import { Fragment } from "react"
import { ArrowUpRight01Icon, ShoppingBag01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { Button } from "@pbgo/ui/platform/button"
import { CreditLink } from "@pbgo/ui/platform/credit-link"
import type { GamePage } from "@/lib/game-page"
import { BggButton } from "./bgg-button"

// The credits of a game, in a section of their own lower on its page, under the tournaments and over the similar games, under the title "Credits": the people and the publishers one line each (Designer, Artist, Publisher, each in the plural when there are several,
// then the year the game came out), and under the lines the buttons that belong to them, outline and of the default size: a link to buy the game in a shop, there only when the Studio has a shop's page for the game, and BoardGameGeek's icon, a small button that leads
// to the game's page there (`BggButton`), there only when the Studio has the game's id. A publisher is a link to its website, with the icon of that site before its name, the two being one link. The section is not drawn when the Studio has none of it: nothing stands
// in for what is missing.

export type GameCreditsProps = Pick<GamePage, "facts" | "bgg" | "shop">

export function GameCredits({ facts, bgg, shop }: GameCreditsProps) {
  if (facts.length === 0 && !bgg && !shop) return null

  return (
    <section aria-label="Credits">
      <h2 className="mb-6 font-heading text-2xl">Credits</h2>
      <div className="flex flex-col items-start gap-5">
        {facts.length > 0 && (
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-3">
            {facts.map((fact) => (
              <Fragment key={fact.label}>
                <dt className="text-muted-foreground">{fact.label}</dt>
                <dd>
                  {fact.values.map((value, index) => (
                    <Fragment key={`${value.text}-${index}`}>
                      {index > 0 && ", "}
                      {value.href ? (
                        <CreditLink href={value.href} icon={value.icon}>
                          {value.text}
                        </CreditLink>
                      ) : (
                        value.text
                      )}
                    </Fragment>
                  ))}
                </dd>
              </Fragment>
            ))}
          </dl>
        )}
        {(shop || bgg) && (
          <div className="flex flex-wrap items-center gap-3">
            {shop && (
              <Button variant="outline" asChild>
                <a href={shop} target="_blank" rel="noopener noreferrer">
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
    </section>
  )
}
