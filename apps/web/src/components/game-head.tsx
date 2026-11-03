import Link from "next/link"
import { ArrowLeft01Icon, Brain02Icon, ChildIcon, HourglassIcon, PlusSignIcon, UserMultipleIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react"
import { Badge } from "@pbgo/ui/platform/badge"
import { Button } from "@pbgo/ui/platform/button"
import { MediaGallery } from "@pbgo/ui/platform/media-gallery"
import { categoryIcon } from "@/lib/category-icons"
import type { GamePage } from "@/lib/game-page"
import { FindGameButton } from "./find-game-button"
import { CREATE_ANCHOR } from "./game-play"
import { RulesButton } from "./rules-button"

// The head of a game's page, the first thing a visitor sees: on the right, the game's gallery (`MediaGallery`: the picture of its card first, then up to five pictures and clips of the game being played, in a 4:3 viewer with a row of tiles under it, three or four of them showing at once; the cover alone when the Studio has none); on the left, a column as tall as the gallery when that is the taller, with the way back to the games' list ("All games") at its top and everything else at its foot, level with
// the gallery's (`justify-between`). That is the name (with "Coming soon" beside it for a game that is not live), the figures of the game on one line (the players, how long, how complex, from what age), under them the description, then the categories as chips that lead to the games'
// list showing that category, and, last, the three main buttons, all 48px high: "Find a game", which puts the visitor in a queue and becomes a counter with a cross while it lasts (`FindGameButton`); "Create a game", in outline, which leads to the space under the head that opens
// a lobby (`CREATE_ANCHOR`, set by `GamePlay`); and, as a picto beside them, the rules (`RulesButton`: a link to the rulebook, or a menu of languages that a press opens). A game that is not live has the first two disabled and keeps the rules. Nothing stands in for what
// is missing. The credits are not here but lower on the page (`GameCredits`). One column, then two from `lg`; on a narrow screen the gallery comes after the buttons. When the text is taller than the gallery, which the narrowest `lg` widths do, the column is as tall as the text and the gallery stands at its foot.

export type GameHeadProps = Pick<GamePage, "slug" | "name" | "live" | "description" | "players" | "duration" | "complexity" | "age" | "categories" | "rulebooks" | "picture" | "gallery">

export function GameHead({ slug, name, live, description, players, duration, complexity, age, categories, rulebooks, picture, gallery }: GameHeadProps) {
  const figures = [
    { icon: UserMultipleIcon, text: players },
    { icon: HourglassIcon, text: duration },
    { icon: Brain02Icon, text: complexity },
    { icon: ChildIcon, text: age },
  ].filter((figure): figure is { icon: IconSvgElement; text: string } => figure.text !== null)

  return (
    <div className="grid gap-x-12 gap-y-8 lg:grid-cols-2">
      <div className="flex flex-col justify-between gap-8 lg:col-start-1">
        <Link href="/games" className="inline-flex items-center gap-1.5 self-start text-sm text-muted-foreground underline-offset-4 hover:underline">
          <HugeiconsIcon icon={ArrowLeft01Icon} strokeWidth={2} className="size-4" />
          All games
        </Link>

        <div className="flex flex-col items-start gap-6">
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

          <div className="flex flex-wrap gap-3">
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
        </div>
      </div>

      {/* The game's gallery: the cover first, the picture of its card drawn larger (its logo over its background, a plain frame when the game has neither), then the pictures and the clips of the game being played, when the Studio has some. The cover is the page's first picture, so it loads at once */}
      <MediaGallery name={name} cover={picture} media={gallery} className="lg:col-start-2 lg:row-start-1 lg:self-end" />
    </div>
  )
}
