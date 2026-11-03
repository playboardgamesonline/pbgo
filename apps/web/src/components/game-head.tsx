import Link from "next/link"
import { ArrowLeft01Icon, Brain02Icon, ChildIcon, HourglassIcon, PlusSignIcon, UserMultipleIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react"
import { Badge } from "@pbgo/ui/platform/badge"
import { Button } from "@pbgo/ui/platform/button"
import { categoryIcon } from "@/lib/category-icons"
import type { GamePage } from "@/lib/game-page"
import { FindGameButton } from "./find-game-button"
import { GameCredits } from "./game-credits"
import { CREATE_ANCHOR } from "./game-play"
import { RulesButton } from "./rules-button"

// The head of a game's page, the first thing a visitor sees: the game's own background across the whole width of the page, from the very top (the navbar is over it), the art fading into the page under the text, from the left, where the text is, and at the foot, where the page goes on
// (the one place where game art is dimmed: a logo is otherwise drawn straight on its background). On it, in a column at the left whose foot is the foot of the head, the way back to the games' list ("All games") at its top, 8rem over the logo on a wide screen (4rem on a phone), and everything else at its foot: the game's logo in place of its name (the name, written, for a game
// that has no logo), the figures of the game on one line (the players, how long, how complex, from what age, after "Coming soon" for a game that is not live), under them the description, then the categories as chips that lead to the games' list showing that category, and, last, a row of controls: the three main
// buttons, all 48px high, "Find a game", which puts the visitor in a queue and becomes a counter with a cross while it lasts (`FindGameButton`); "Create a game", in outline, which leads to the space under the head that opens a lobby (`CREATE_ANCHOR`, set by `GamePlay`); and, as a picto, the rules (`RulesButton`: a link
// to the rulebook, or a menu of languages that a press opens). Under the buttons come the credits of the game, quiet (`GameCredits`). What the signed-in visitor has done in the game is not here: it is in the thin banner under the head (`GameHistoryStats`). A game that is not live has the first two buttons disabled and keeps the rules.
// Nothing stands in for what is missing: a game with no background has a plain head. The gallery of the game's pictures and clips (`MediaGallery`) is not drawn for now: it will have a place again.

export type GameHeadProps = Pick<GamePage, "slug" | "name" | "live" | "description" | "players" | "duration" | "complexity" | "age" | "categories" | "rulebooks" | "hero" | "facts" | "bgg" | "shop">

export function GameHead({ slug, name, live, description, players, duration, complexity, age, categories, rulebooks, hero, facts, bgg, shop }: GameHeadProps) {
  const figures = [
    { icon: UserMultipleIcon, text: players },
    { icon: HourglassIcon, text: duration },
    { icon: Brain02Icon, text: complexity },
    { icon: ChildIcon, text: age },
  ].filter((figure): figure is { icon: IconSvgElement; text: string } => figure.text !== null)

  return (
    <div data-slot="game-head" className="relative isolate overflow-hidden">
      {hero.background && (
        // The first picture of the page, and its largest: it loads at once
        // eslint-disable-next-line @next/next/no-img-element
        <img src={hero.background} alt="" fetchPriority="high" decoding="async" className="absolute inset-0 -z-20 size-full object-cover" />
      )}
      {/* The art fades into the page, darker where the text is: from the left, and at the foot, where the head meets the next section */}
      <div aria-hidden="true" className="absolute inset-0 -z-10 bg-linear-to-r from-background/90 via-background/50 to-transparent" />
      <div aria-hidden="true" className="absolute inset-0 -z-10 bg-linear-to-t from-background via-background/30 to-transparent" />

      <div className="mx-auto flex min-h-136 w-full max-w-page flex-col justify-between gap-16 px-gutter pt-navbar pb-10 md:min-h-152 md:gap-32 md:pb-14">
        <Link href="/games" className="mt-2 inline-flex items-center gap-1.5 self-start text-sm text-muted-foreground underline-offset-4 hover:underline">
          <HugeiconsIcon icon={ArrowLeft01Icon} strokeWidth={2} className="size-4" />
          All games
        </Link>

        <div className="flex flex-col items-start gap-6">
          <h1 className={hero.logo ? undefined : "font-heading text-4xl md:text-6xl"}>
            {hero.logo ? (
              // The logo is the name: its text is the picture's, and it is as wide as 18rem (24rem from `md`) and as tall as 5rem (7rem), whatever its shape
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={hero.logo}
                alt={name}
                fetchPriority="high"
                decoding="async"
                className="h-auto max-h-20 w-auto max-w-72 object-contain object-left drop-shadow-lg md:max-h-28 md:max-w-96"
              />
            ) : (
              name
            )}
          </h1>

          {(figures.length > 0 || !live) && (
            <ul className="flex flex-wrap items-center gap-x-5 gap-y-2 text-muted-foreground">
              {!live && (
                <li>
                  <Badge variant="outline">Coming soon</Badge>
                </li>
              )}
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

          <div className="flex flex-wrap items-center gap-3">
            <FindGameButton slug={slug} name={name} disabled={!live} />
            {live ? (
              <Button variant="outline" size="xl" asChild>
                <a href={`#${CREATE_ANCHOR}`}>
                  <HugeiconsIcon icon={PlusSignIcon} strokeWidth={2} data-icon="inline-start" aria-hidden="true" />
                  Create a game
                </a>
              </Button>
            ) : (
              <Button variant="outline" size="xl" disabled>
                <HugeiconsIcon icon={PlusSignIcon} strokeWidth={2} data-icon="inline-start" aria-hidden="true" />
                Create a game
              </Button>
            )}
            <RulesButton rulebooks={rulebooks} />
          </div>

          <GameCredits facts={facts} bgg={bgg} shop={shop} className="mt-6" />
        </div>
      </div>
    </div>
  )
}
