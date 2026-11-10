import Link from "next/link"
import { ArrowLeft01Icon, Brain02Icon, ChildIcon, HourglassIcon, PlusSignIcon, UserMultipleIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react"
import type { AgeRefusal } from "@pbgo/accounts"
import { playTitle } from "@pbgo/catalog/seo"
import { Badge } from "@pbgo/ui/platform/badge"
import { Button } from "@pbgo/ui/platform/button"
import { categoryIcon } from "@/lib/category-icons"
import type { GamePage } from "@/lib/game-page"
import { GameCredits } from "./game-credits"
import { CREATE_ANCHOR } from "./game-play"
import { PlayButton } from "./play-button"
import { RulesButton } from "./rules-button"

// The head of a game's page, the first thing a visitor sees: the game's own background across the whole width of the page, from the very top (the navbar is over it), the art fading into the page under the text, from the left, where the text is, and at the foot, where the page goes on
// (the one place where game art is dimmed: a logo is otherwise drawn straight on its background). On it, in a column at the left as tall as the head, which is 92% of the screen, and 80% of it from `lg` (less the room that the cookie banner takes, `--consent-h`, so that the buttons at its foot are not under it, and taller when its text needs more), everything at its foot, with the room that keeps the top of the next section showing under the head (the way back to the games' list is the navbar's from `sm`, an island at the left of its main block; on a phone, where the bar has no room for it, a text link "Back" is at the top of the column, kept 4rem from the rest): the game's logo in place of its name (the name, written, for a game
// that has no logo; either way the heading reads "Play <name> Online" to a screen reader and to a search engine, `playTitle`), the figures of the game on one line (the players, how long, how complex, from what age, after "Coming soon" for a game that is not live), under them the description, then the categories as chips that lead to the games' list showing that category, and, last, a row of controls: the main
// controls, all 48px high, a selector, Normal or Ranked, and the button after it, "Play normal" or "Play ranked", with a play icon, which sits the visitor at a table of the game in that mode and becomes a counter with a cross while the search lasts (`PlayButton`); "Create a table", in outline, which leads to the space under the head that opens a lobby (`CREATE_ANCHOR`, set by `GamePlay`); and, as a picto, the rules (`RulesButton`: a link
// to the rulebook, or a menu of languages that a press opens). What the signed-in visitor has done in the game is not in the head: it is the cards under it, the first section of the page (`GamePlayerBar`).
// Under the buttons come the credits of the game, quiet (`GameCredits`). A game that is not live has the selector and the two buttons disabled and keeps the rules.
// Nothing stands in for what is missing: a game with no background has a plain head.

/**
 * A fade from the page's colour (`--background`) to nothing along `direction`. It eases in and out: its stops follow a cosine, so it has no edge where it starts, where it
 * ends or in between, which the eye finds in a gradient of two or three straight stops. `strength` is how opaque it is where it starts, and `reach` how far across the head
 * it goes (both 0 to 1) before nothing is left.
 */
function easedFade(direction: "to right" | "to top", strength: number, reach: number, steps = 12): string {
  const stops = Array.from({ length: steps + 1 }, (_, i) => {
    const t = i / steps
    const opacity = strength * 0.5 * (1 + Math.cos(Math.PI * t))
    return `color-mix(in oklab, var(--background) ${(opacity * 100).toFixed(1)}%, transparent) ${(t * reach * 100).toFixed(1)}%`
  })
  return `linear-gradient(${direction}, ${stops.join(", ")})`
}

// From the left, where the text is, and at the foot, where the head meets the next section and has to end in the page's own colour
const FADE_FROM_LEFT = easedFade("to right", 0.35, 0.65)
const FADE_FROM_FOOT = easedFade("to top", 1, 0.8)

export type GameHeadProps = Pick<GamePage, "slug" | "name" | "live" | "description" | "players" | "duration" | "complexity" | "age" | "categories" | "rulebooks" | "hero" | "facts" | "bgg" | "shop"> & {
  /** What the visitor has to do before they may play this game, when it asks for an age (PLT-125): the buttons that look for a table ask first, so that a member is asked for their date of birth before the search begins. None: they may. */
  ageRefusal?: AgeRefusal | null
}

export function GameHead({ slug, name, live, description, players, duration, complexity, age, categories, rulebooks, hero, facts, bgg, shop, ageRefusal = null }: GameHeadProps) {
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
      {/* The art fades into the page, darker where the text is: from the left, and at the foot, where the head meets the next section. Both fades ease in and out, so no edge shows */}
      <div aria-hidden="true" className="absolute inset-0 -z-10" style={{ backgroundImage: FADE_FROM_LEFT }} />
      <div aria-hidden="true" className="absolute inset-0 -z-10" style={{ backgroundImage: FADE_FROM_FOOT }} />

      <div className="mx-auto flex min-h-[calc((100svh-var(--consent-h,0px))*0.92)] lg:min-h-[calc((100svh-var(--consent-h,0px))*0.8)] w-full max-w-page flex-col justify-end gap-16 px-gutter pt-navbar pb-10 max-sm:justify-between md:gap-8 md:pb-14">
        <Link href="/games" aria-label="Back to all games" className="mt-2 inline-flex items-center gap-1.5 self-start text-sm text-muted-foreground underline-offset-4 hover:underline sm:hidden">
          <HugeiconsIcon icon={ArrowLeft01Icon} strokeWidth={2} className="size-4" />
          Back
        </Link>

        <div className="flex flex-col items-start gap-6">
          <h1 className={hero.logo ? undefined : "font-heading text-4xl md:text-6xl"}>
            {hero.logo ? (
              // The logo is the name: its text is the picture's, said as the heading is, "Play <name> Online" (`playTitle`), and it is as wide as 18rem (24rem from `md`) and as tall as 5rem (7rem), whatever its shape
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={hero.logo}
                alt={playTitle(name)}
                fetchPriority="high"
                decoding="async"
                className="h-auto max-h-20 w-auto max-w-72 object-contain object-left drop-shadow-lg md:max-h-28 md:max-w-96"
              />
            ) : (
              // The written name keeps its look; the two words around it, which make the same heading, are for a screen reader and a search engine
              <>
                <span className="sr-only">Play </span>
                {name}
                <span className="sr-only"> Online</span>
              </>
            )}
          </h1>

          {(figures.length > 0 || !live) && (
            // The text sits straight on the art, which the fades leave bright: white at an opacity, not the grey of the page's secondary text
            <ul className="flex flex-wrap items-center gap-x-5 gap-y-2 text-foreground/90">
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
            <p lang={description.language} className="max-w-xl text-pretty whitespace-pre-line text-foreground/90">
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
            <PlayButton slug={slug} name={name} disabled={!live} refusal={ageRefusal} />
            {live ? (
              <Button variant="outline" size="xl" asChild>
                <a href={`#${CREATE_ANCHOR}`}>
                  <HugeiconsIcon icon={PlusSignIcon} strokeWidth={2} data-icon="inline-start" aria-hidden="true" />
                  Create<span className="sr-only"> a table</span>
                </a>
              </Button>
            ) : (
              <Button variant="outline" size="xl" disabled>
                <HugeiconsIcon icon={PlusSignIcon} strokeWidth={2} data-icon="inline-start" aria-hidden="true" />
                Create<span className="sr-only"> a table</span>
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
