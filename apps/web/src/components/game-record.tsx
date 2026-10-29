import Link from "next/link"
import { ordinal, type PlayedGame } from "@pbgo/accounts"
import { Avatar, AvatarFallback, AvatarImage } from "@pbgo/ui/platform/avatar"
import { Badge } from "@pbgo/ui/platform/badge"
import { Button } from "@pbgo/ui/platform/button"
import { Item, ItemActions, ItemContent, ItemDescription, ItemMedia, ItemTitle } from "@pbgo/ui/platform/item"
import { gameDate } from "@/lib/account-data"

/** The picture of a game, from the catalog's route (the game's icon): the first letters of its name when the game has none. Square: only the picture of a person is round. */
function GameThumb({ slug, name }: { slug: string; name: string }) {
  return (
    <Avatar className="size-10 rounded-none after:hidden">
      <AvatarImage src={`/api/catalog/${slug}/icon`} alt="" className="rounded-none" />
      <AvatarFallback className="rounded-none text-xs">{name.slice(0, 2).toUpperCase()}</AvatarFallback>
    </Avatar>
  )
}

/** How a finished game ended, as a badge: solid for a win, quiet for a loss, outlined for a draw. */
function ResultBadge({ result }: { result: NonNullable<PlayedGame["result"]> }) {
  return result === "won" ? <Badge>Won</Badge> : result === "lost" ? <Badge variant="secondary">Lost</Badge> : <Badge variant="outline">Draw</Badge>
}

/**
 * One game of a visitor, as a row: the game and its table, when it started and with whom, then, for a game in progress, a button to go back to its
 * table, and for a game that is over, how it ended and the rank.
 */
export function GameRecord({ game }: { game: PlayedGame }) {
  const names = game.opponents.map((opponent) => opponent.nickname)
  return (
    <Item variant="outline" size="sm">
      <ItemMedia>
        <GameThumb slug={game.slug} name={game.name} />
      </ItemMedia>
      <ItemContent>
        <ItemTitle>
          <Link href={`/game/${game.slug}`} className="hover:underline">
            {game.name}
          </Link>
          <span className="text-muted-foreground">· table {game.table}</span>
        </ItemTitle>
        <ItemDescription>
          {gameDate(game.playedAt)} · with {names.join(", ")}
        </ItemDescription>
      </ItemContent>
      <ItemActions>
        {game.state === "in-progress" ? (
          <>
            <Badge variant="secondary">In progress</Badge>
            <Button size="sm" asChild>
              <Link href={`/${game.slug}/game/${game.table}`}>Rejoin</Link>
            </Button>
          </>
        ) : (
          <>
            {game.rank !== undefined && (
              <span className="text-sm text-muted-foreground">
                {ordinal(game.rank)} of {game.opponents.length + 1}
              </span>
            )}
            {game.result && <ResultBadge result={game.result} />}
          </>
        )}
      </ItemActions>
    </Item>
  )
}
