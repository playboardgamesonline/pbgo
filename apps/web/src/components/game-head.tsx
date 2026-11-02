import { Fragment } from "react"
import { ArrowUpRight01Icon, Calendar03Icon, ChildIcon, HourglassIcon, PlusSignIcon, Search01Icon, UserMultipleIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react"
import { Button } from "@pbgo/ui/platform/button"
import { CreditLink } from "@pbgo/ui/platform/credit-link"
import { GameCardVisual } from "@pbgo/ui/platform/game-card"
import type { GamePage } from "@/lib/game-page"
import { CREATE_ANCHOR, FIND_ANCHOR } from "./game-play"
import { RulesButton } from "./rules-button"

// The head of a game's page, the first thing a visitor sees: the name, the figures of the game on one line (the players, how long, from what age, the year it came out), the description, a row of buttons, the credits and a picture.
// The row has two groups. The first is what the page is for: to find a game, which leads to the open tables, and to create one, which leads to the space that opens a lobby (`FIND_ANCHOR` and `CREATE_ANCHOR`, set by `GamePlay`); a game
// that is not live has both disabled, there is nothing to play yet. The second is where to read more, and stays for a game to come: its rules (`RulesButton`: a link, or a menu of languages) and its page on BoardGameGeek, each only when the
// Studio has the link. A shop that sells the game, a partner's, would be a third button of that group: nothing is built for it, there is no data. One column, then two from `lg`: the text on the left, the picture on the right with the credits
// under the text. On a narrow screen the picture comes before the credits.

export type GameHeadProps = Pick<GamePage, "name" | "live" | "description" | "players" | "duration" | "age" | "released" | "facts" | "rulebooks" | "bgg" | "picture">

export function GameHead({ name, live, description, players, duration, age, released, facts, rulebooks, bgg, picture }: GameHeadProps) {
  const figures = [
    { icon: UserMultipleIcon, text: players },
    { icon: HourglassIcon, text: duration },
    { icon: ChildIcon, text: age },
    { icon: Calendar03Icon, text: released },
  ].filter((figure): figure is { icon: IconSvgElement; text: string } => figure.text !== null)

  return (
    <div className="grid gap-x-12 gap-y-8 lg:grid-cols-2">
      <div className="flex flex-col items-start gap-6 lg:col-start-1">
        <h1 className="font-heading text-4xl md:text-6xl">{name}</h1>
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

        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
          <div className="flex flex-wrap gap-3">
            {live ? (
              <>
                <Button variant="secondary" size="lg" asChild>
                  <a href={`#${FIND_ANCHOR}`}>
                    <HugeiconsIcon icon={Search01Icon} strokeWidth={2} data-icon="inline-start" aria-hidden="true" />
                    Find a game
                  </a>
                </Button>
                <Button size="lg" asChild>
                  <a href={`#${CREATE_ANCHOR}`}>
                    <HugeiconsIcon icon={PlusSignIcon} strokeWidth={2} data-icon="inline-start" aria-hidden="true" />
                    Create a game
                  </a>
                </Button>
              </>
            ) : (
              <>
                <Button variant="secondary" size="lg" disabled>
                  <HugeiconsIcon icon={Search01Icon} strokeWidth={2} data-icon="inline-start" aria-hidden="true" />
                  Find a game
                </Button>
                <Button size="lg" disabled>
                  <HugeiconsIcon icon={PlusSignIcon} strokeWidth={2} data-icon="inline-start" aria-hidden="true" />
                  Create a game
                </Button>
              </>
            )}
          </div>
          {(rulebooks.length > 0 || bgg) && (
            <div className="flex flex-wrap gap-3">
              <RulesButton rulebooks={rulebooks} />
              {bgg && (
                <Button variant="outline" size="lg" asChild>
                  <a href={bgg} target="_blank" rel="noopener noreferrer">
                    BoardGameGeek
                    <HugeiconsIcon icon={ArrowUpRight01Icon} strokeWidth={2} data-icon="inline-end" aria-hidden="true" />
                  </a>
                </Button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* The picture of the game's card, drawn larger: its logo over its background, a plain frame when the game has neither. It is the page's first picture, so it loads at once */}
      <GameCardVisual {...picture} loading="eager" className="rounded-4xl ring-1 ring-foreground/10 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:self-start" />

      {facts.length > 0 && (
        // Under the text: the credits follow one another, one line each (Designer, Artist, Publisher, each in the plural when there are several). A publisher is a link to its website,
        // with the icon of that site before its name, the two being one link. The lines keep the height of their text and the same gap, whatever room the picture beside them leaves: the block is stretched by the grid of the head,
        // and a grid shares the height it is given between its rows unless it is told to start them at the top (`content-start`)
        <dl className="grid grid-cols-[auto_1fr] content-start gap-x-4 gap-y-1.5 border-t pt-6 lg:col-start-1">
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
    </div>
  )
}
