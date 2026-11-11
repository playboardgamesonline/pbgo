import Link from "next/link"
import { Fragment } from "react"
import { ordinal, profilePath, type PlayedGame, type TimeFormat } from "@pbgo/accounts"
import { Avatar, AvatarFallback, AvatarImage } from "@pbgo/ui/platform/avatar"
import { Badge } from "@pbgo/ui/platform/badge"
import { Button } from "@pbgo/ui/platform/button"
import { Item, ItemActions, ItemContent, ItemDescription, ItemMedia, ItemTitle } from "@pbgo/ui/platform/item"
import { pointsLabel, pointsTone } from "@pbgo/ui/results"
import { gameDate } from "@/lib/account-data"

/** The picture of a game, from the catalog's route (the game's icon): the first letters of its name when the game has none. A tile (`rounded-tile`), never a circle: only the picture of a person is round. */
export function GameThumb({ slug, name }: { slug: string; name: string }) {
  return (
    <Avatar className="size-10 rounded-tile after:rounded-tile">
      <AvatarImage src={`/api/catalog/${slug}/icon`} alt="" className="rounded-tile" />
      <AvatarFallback className="rounded-tile text-xs">{name.slice(0, 2).toUpperCase()}</AvatarFallback>
    </Avatar>
  )
}

/** How a finished game ended, as a badge: solid for a win, quiet for a loss, outlined for a draw. */
function ResultBadge({ result }: { result: NonNullable<PlayedGame["result"]> }) {
  return result === "won" ? <Badge>Won</Badge> : result === "lost" ? <Badge variant="secondary">Lost</Badge> : <Badge variant="outline">Draw</Badge>
}

/** The others at a table. A name links to that player's profile when they have an account (PLT-39). Names are `ph-mask` and links that hold one are `ph-no-capture`. */
function Opponents({ opponents }: { opponents: PlayedGame["opponents"] }) {
  return (
    <>
      {opponents.map((opponent, index) => (
        <Fragment key={index}>
          {index > 0 && ", "}
          {opponent.handle ? (
            <Link href={profilePath(opponent.handle, "history")} className="ph-mask ph-no-capture underline-offset-4 hover:text-foreground hover:underline">
              {opponent.nickname}
            </Link>
          ) : (
            <span className="ph-mask">{opponent.nickname}</span>
          )}
        </Fragment>
      ))}
    </>
  )
}

/**
 * One game of a visitor, as a row: the game (and its table, while it is in progress: a game that is over keeps its result and no table), when it started or ended (the time written as the member chose, `timeFormat`) and with whom (nobody, for a game played alone), then, for a game in progress, a
 * button to go back to its table, and for a game that is over, how it ended, the rank and the rank points it gave or took.
 */
export function GameRecord({ game, timeFormat = "auto" }: { game: PlayedGame; timeFormat?: TimeFormat }) {
  return (
    <Item size="sm">
      <ItemMedia>
        <GameThumb slug={game.slug} name={game.name} />
      </ItemMedia>
      {/* The text keeps at least this much room: where the card is narrower, the result goes under it, instead of squeezing the name of the game into three lines */}
      <ItemContent className="min-w-52">
        <ItemTitle>
          <Link href={`/game/${game.slug}`} className="hover:underline">
            {game.name}
          </Link>
          {game.table && <span className="text-muted-foreground">· table {game.table}</span>}
        </ItemTitle>
        <ItemDescription>
          {gameDate(game.playedAt, timeFormat)}
          {game.opponents.length > 0 && (
            <>
              {" · with "}
              <Opponents opponents={game.opponents} />
            </>
          )}
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
