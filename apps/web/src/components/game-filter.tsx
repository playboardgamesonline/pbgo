import Link from "next/link"
import { Button } from "@pbgo/ui/platform/button"
import { cn } from "@pbgo/ui/utils"
import { GameThumb } from "@/components/game-record"

// The games a career can be narrowed to, as a row of buttons that wraps: "All games" and, for each game the member has finished one of, its picture (the game's icon), which is all of a button until it is the one that is picked: then it says the game's name too. A game is
// known by its picture, so a row of sixteen fits, and its name is under the pointer (`title`) and read out (`aria-label`). The address is the state (`?game=<slug>`, left off for all of them), so that a link, such as the one of a game's page, lands on one game; a press
// is a link that keeps the page where it is (`scroll={false}`). A server component.

const PATH = "/me/career"

export function GameFilter({ games, selected, className }: { games: readonly { slug: string; name: string }[]; selected: string | null; className?: string }) {
  return (
    <nav aria-label="Games" className={cn("flex flex-wrap items-center gap-2", className)}>
      <Button asChild size="lg" variant={selected === null ? "default" : "outline"}>
        <Link href={PATH} scroll={false} aria-current={selected === null ? "true" : undefined}>
          All games
        </Link>
      </Button>
      {games.map((game) => {
        const current = game.slug === selected
        return (
          <Button key={game.slug} asChild size={current ? "lg" : "icon-lg"} variant={current ? "default" : "outline"} className={cn(current && "pl-1.5")}>
            <Link href={`${PATH}?game=${encodeURIComponent(game.slug)}`} scroll={false} title={game.name} aria-label={game.name} aria-current={current ? "true" : undefined}>
              <GameThumb slug={game.slug} name={game.name} className="size-7" />
              {current && game.name}
            </Link>
          </Button>
        )
      })}
    </nav>
  )
}
