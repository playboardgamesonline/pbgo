import Link from "next/link"
import { FavouriteIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { CoverTile, type CoverTileProps } from "@pbgo/ui/platform/cover-tile"
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@pbgo/ui/platform/hover-card"
import { RankBadge } from "@pbgo/ui/platform/rank-badge"
import { StatBarLabel } from "@pbgo/ui/platform/stat-bar"
import type { Rank } from "@pbgo/ui/ranks"

// The games a member picked as their favourites, small, at the right of their bio and under no title: a small label ("Favorite", with a filled heart) and the tiles, in the order the member put them, each leading to the game. What the member did at a game is one hover away: the card that
// opens on a tile gives the game's rank where the member rated it, the games they played, the ones they won and their share. A member who hides their games has no card on their tiles: the games they picked are what they filled in, what they did at them is not. A server component: the
// cards are the client's, and bring what they say with them.

/** What a member did at a game: the games they played and won there, and their rank where they rated it. */
export type FavoriteRecord = { played: number; wins: number; rank: Rank | null }

/** A game of the row: its picture and name from the catalog, and what the member did at it (null where they hide their games from the visitor: the tile has no card then). */
export type FavoriteGame = { slug: string; name: string; picture: CoverTileProps; record: FavoriteRecord | null }

/** One figure on the card of a game: what it counts, small and quiet, and the figure under it. */
function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="font-heading text-lg tabular-nums">{value}</dd>
    </div>
  )
}

export function FavoriteGames({ games, className }: { games: readonly FavoriteGame[]; className?: string }) {
  return (
    <div className={className}>
      <StatBarLabel className="mb-2.5 flex items-center gap-1.5">
        <HugeiconsIcon icon={FavouriteIcon} fill="currentColor" aria-hidden="true" className="size-3.5 shrink-0" />
        Favorite
      </StatBarLabel>
      <ul aria-label="Favorite board games" className="flex flex-wrap gap-3">
        {games.map((game) => {
          const tile = (
            <Link href={`/game/${game.slug}`} className="group/favorite flex w-18 flex-col gap-1.5 outline-none">
              <CoverTile
                className="size-auto w-18 aspect-4/3 ring-1 ring-foreground/10 transition-shadow duration-fast group-hover/favorite:ring-foreground/30 group-focus-visible/favorite:ring-3 group-focus-visible/favorite:ring-ring/30"
                {...game.picture}
              />
              <span className="truncate text-xs group-hover/favorite:underline">{game.name}</span>
            </Link>
          )
          const { record } = game
          return (
            <li key={game.slug}>
              {record === null ? (
                tile
              ) : (
                <HoverCard>
                  <HoverCardTrigger asChild>{tile}</HoverCardTrigger>
                  <HoverCardContent className="w-64">
                    <div className="flex items-center justify-between gap-3">
                      <p className="min-w-0 truncate font-heading">{game.name}</p>
                      {record.rank && <RankBadge rank={record.rank} labelled />}
                    </div>
                    <dl className="mt-4 grid grid-cols-3 gap-3">
                      <Figure label="Played" value={String(record.played)} />
                      <Figure label="Won" value={String(record.wins)} />
                      <Figure label="Win rate" value={record.played > 0 ? `${Math.round((record.wins / record.played) * 100)}%` : "—"} />
                    </dl>
                  </HoverCardContent>
                </HoverCard>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
