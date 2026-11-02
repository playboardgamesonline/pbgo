import { Fragment } from "react"
import Link from "next/link"
import { ArrowUpRight01Icon, Brain02Icon, ChildIcon, HourglassIcon, PlusSignIcon, UserMultipleIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react"
import { Badge } from "@pbgo/ui/platform/badge"
import { Button } from "@pbgo/ui/platform/button"
import { CreditLink } from "@pbgo/ui/platform/credit-link"
import { GameCardVisual } from "@pbgo/ui/platform/game-card"
import { categoryIcon } from "@/lib/category-icons"
import type { GamePage } from "@/lib/game-page"
import { FindGameButton } from "./find-game-button"
import { CREATE_ANCHOR } from "./game-play"
import { RulesButton } from "./rules-button"

// The head of a game's page, the first thing a visitor sees. On the left: the name (with "Coming soon" beside it for a game that is not live), the figures of the
// game on one line (the players, how long, how complex, from what age), under them the description, then the categories as chips that lead to the games' list showing that category, and a row of buttons. The main button is "Find a game", which puts the visitor in a queue and becomes a counter with a cross while it lasts
// (`FindGameButton`); beside it, in the second place, "Create a game", which leads to the space under the head that opens a lobby (`CREATE_ANCHOR`, set by `GamePlay`); then, apart, the rules (`RulesButton`: a link, or a menu of languages).
// A game that is not live has the two disabled, and keeps the rules. Under a hairline come the credits, with the year the game came out as one of their lines, and the button to see the game on BoardGameGeek, which is there only when the
// Studio has the game's id. A shop that sells the game, a partner's, would be one more button of the credits: nothing is built, there is no data. On the right, the picture of the game's card. One column, then two from `lg`; on a
// narrow screen the picture comes before the credits.

export type GameHeadProps = Pick<GamePage, "slug" | "name" | "live" | "description" | "players" | "duration" | "complexity" | "age" | "categories" | "facts" | "rulebooks" | "bgg" | "picture">

export function GameHead({ slug, name, live, description, players, duration, complexity, age, categories, facts, rulebooks, bgg, picture }: GameHeadProps) {
  const figures = [
    { icon: UserMultipleIcon, text: players },
    { icon: HourglassIcon, text: duration },
    { icon: Brain02Icon, text: complexity },
    { icon: ChildIcon, text: age },
  ].filter((figure): figure is { icon: IconSvgElement; text: string } => figure.text !== null)

  return (
    <div className="grid gap-x-12 gap-y-8 lg:grid-cols-2">
      <div className="flex flex-col items-start gap-6 lg:col-start-1">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <h1 className="font-heading text-4xl md:text-6xl">{name}</h1>
          {!live && <Badge variant="outline">Coming soon</Badge>}
        </div>

        {figures.length > 0 && (
          <ul className="flex flex-wrap items-center gap-x-5 gap-y-2 text-muted-foreground">
            {figures.map(({ icon, text }) => (
              <li key={text} className="inline-flex items-center gap-1.5">
                <HugeiconsIcon icon={icon} strokeWidth={2} className="size-4" aria-hidden="true" />
                {text}
              </li>
            ))}
          </ul>
        )}

        {/* The text is the game's own, in the language it was found in; line breaks of the source are kept */}
        {description && (
          <p lang={description.language} className="max-w-xl text-pretty whitespace-pre-line text-muted-foreground">
            {description.text}
          </p>
        )}

        {categories.length > 0 && (
          <ul aria-label="Categories" className="flex flex-wrap gap-2">
            {categories.map(({ name: category, href }) => (
              <li key={category}>
                <Badge variant="secondary" asChild className="h-7 gap-1.5 px-2.5 text-sm [&>svg]:size-4!">
                  <Link href={href}>
                    <HugeiconsIcon icon={categoryIcon(category)} strokeWidth={2} aria-hidden="true" />
                    {category}
                  </Link>
                </Badge>
              </li>
            ))}
          </ul>
        )}

        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
          <div className="flex flex-wrap gap-3">
            <FindGameButton slug={slug} name={name} disabled={!live} />
            {live ? (
              <Button variant="secondary" size="lg" asChild>
                <a href={`#${CREATE_ANCHOR}`}>
                  <HugeiconsIcon icon={PlusSignIcon} strokeWidth={2} data-icon="inline-start" aria-hidden="true" />
                  Create a game
                </a>
              </Button>
            ) : (
              <Button variant="secondary" size="lg" disabled>
                <HugeiconsIcon icon={PlusSignIcon} strokeWidth={2} data-icon="inline-start" aria-hidden="true" />
                Create a game
              </Button>
            )}
          </div>
          <RulesButton rulebooks={rulebooks} />
        </div>
      </div>

      {/* The picture of the game's card, drawn larger: its logo over its background, a plain frame when the game has neither. It is the page's first picture, so it loads at once */}
      <GameCardVisual {...picture} loading="eager" className="rounded-4xl ring-1 ring-foreground/10 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:self-start" />

      {(facts.length > 0 || bgg) && (
        // Under the text: the credits follow one another, one line each (Designer, Artist, Publisher, each in the plural when there are several, then the year it came out). A publisher is a link to its website,
        // with the icon of that site before its name, the two being one link. The lines keep the height of their text and the same gap, whatever room the picture beside them leaves: the block is stretched by the grid of the head,
        // and a grid shares the height it is given between its rows unless it is told to start them at the top (`content-start`)
        <div className="flex flex-col items-start gap-5 border-t pt-6 lg:col-start-1">
          {facts.length > 0 && (
            <dl className="grid grid-cols-[auto_1fr] content-start gap-x-4 gap-y-3">
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
          {bgg && (
            <Button variant="outline" asChild>
              <a href={bgg} target="_blank" rel="noopener noreferrer">
                BoardGameGeek
                <HugeiconsIcon icon={ArrowUpRight01Icon} strokeWidth={2} data-icon="inline-end" aria-hidden="true" />
              </a>
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
