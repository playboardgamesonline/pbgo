import Link from "next/link"
import { ordinal, type PlayedGame } from "@pbgo/accounts"
import { Avatar, AvatarFallback, AvatarImage } from "@pbgo/ui/platform/avatar"
import { Badge } from "@pbgo/ui/platform/badge"
import { Button } from "@pbgo/ui/platform/button"
import { Item, ItemActions, ItemContent, ItemDescription, ItemMedia, ItemTitle } from "@pbgo/ui/platform/item"
import { pointsLabel, pointsTone } from "@pbgo/ui/results"
import { gameDate } from "@/lib/account-data"

/** The picture of a game, from the catalog's route (the game's icon): the first letters of its name when the game has none. Rounded like the rest, never a circle: only the picture of a person is round. */
export function GameThumb({ slug, name }: { slug: string; name: string }) {
  return (
    <Avatar className="size-10 rounded-xl after:rounded-xl">
      <AvatarImage src={`/api/catalog/${slug}/icon`} alt="" className="rounded-xl" />
      <AvatarFallback className="rounded-xl text-xs">{name.slice(0, 2).toUpperCase()}</AvatarFallback>
    </Avatar>
  )
}

/** How a finished game ended, as a badge: solid for a win, quiet for a loss, outlined for a draw. */
function ResultBadge({ result }: { result: NonNullable<PlayedGame["result"]> }) {
  return result === "won" ? <Badge>Won</Badge> : result === "lost" ? <Badge variant="secondary">Lost</Badge> : <Badge variant="outline">Draw</Badge>
}

/**
 * One game of a visitor, as a row: the game (and its table, while it is in progress: a game that is over keeps its result and no table), when it started or ended and with whom (nobody, for a game played alone), then, for a game in progress, a
 * button to go back to its table, and for a game that is over, how it ended, the rank and the rank points it gave or took.
 */
export function GameRecord({ game }: { game: PlayedGame }) {
  const names = game.opponents.map((opponent) => opponent.nickname)
  return (
    <Item size="sm">
      <ItemMedia>
        <GameThumb slug={game.slug} name={game.name} />
      </ItemMedia>
      <ItemContent>
        <ItemTitle>
          <Link href={`/game/${game.slug}`} className="hover:underline">
            {game.name}
          </Link>
          {game.table && <span className="text-muted-foreground">· table {game.table}</span>}
        </ItemTitle>
        <ItemDescription>
          {gameDate(game.playedAt)}
          {names.length > 0 && ` · with ${names.join(", ")}`}
        </ItemDescription>
      </ItemContent>
      <ItemActions>
        {game.state === "in-progress" ? (
          <>
            <Badge variant="secondary">In progress</Badge>
            {game.table && (
              <Button size="sm" asChild>
                <Link href={`/${game.slug}/game/${game.table}`}>Rejoin</Link>
              </Button>
            )}
          </>
        ) : (
          <>
            {game.rank !== undefined && (
              <span className="text-sm text-muted-foreground">
                {ordinal(game.rank)} of {game.opponents.length + 1}
              </span>
            )}
            {game.result && <ResultBadge result={game.result} />}
            {game.points !== undefined && (
              <Badge variant={pointsTone(game.points)} className="tabular-nums">
                {pointsLabel(game.points)}
              </Badge>
            )}
          </>
        )}
      </ItemActions>
    </Item>
  )
}
