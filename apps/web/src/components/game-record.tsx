import Link from "next/link"
import { ordinal, profilePath, tagText, type PlayedGame, type TimeFormat } from "@pbgo/accounts"
import { initials } from "@pbgo/ui/friends"
import { Avatar, AvatarFallback, AvatarImage } from "@pbgo/ui/platform/avatar"
import { Badge } from "@pbgo/ui/platform/badge"
import { Button } from "@pbgo/ui/platform/button"
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@pbgo/ui/platform/hover-card"
import { Item, ItemActions, ItemContent, ItemMedia, ItemTitle } from "@pbgo/ui/platform/item"
import { UserCard } from "@pbgo/ui/platform/user-card"
import { QUEUE_MODE_LABELS } from "@pbgo/ui/queue"
import { pointsLabel, pointsTone } from "@pbgo/ui/results"
import type { PlayerRecord, SeatedPlayer } from "@pbgo/ui/tables"
import { gameDate } from "@/lib/account-data"
import { Duration, PaceFact, PlayerCount } from "./played-game-bits"

/** How many of the others at a table are drawn as pictures: a table has ten seats at the most, and a row is not the place to list them. */
const PICTURES_MAX = 6

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

/** The others at a table, as pictures in a row that overlap: under the pointer each opens the card of the player (`UserCard`, the one of a table's seats, here with no tag), and a picture of an account leads to their profile (PLT-39), which is what a touch reaches. Their names are for screen readers. At most `PICTURES_MAX` are drawn and the rest are counted. */
function Opponents({ opponents }: { opponents: PlayedGame["opponents"] }) {
  const shown = opponents.slice(0, PICTURES_MAX)
  return (
    <ul aria-label="Players" className="flex items-center -space-x-2">
      {shown.map((opponent, index) => {
        const href = opponent.handle ? profilePath(opponent.handle, "history") : null
        const picture = (
          <Avatar className="size-7 ring-2 ring-(color:--cutout)">
            {opponent.avatarUrl && <AvatarImage src={opponent.avatarUrl} alt="" referrerPolicy="no-referrer" />}
            <AvatarFallback className="text-xs">{initials(opponent.nickname)}</AvatarFallback>
          </Avatar>
        )
        const trigger = href ? (
          <Link href={href} className="ph-no-capture block rounded-full outline-none focus-visible:z-10 focus-visible:ring-3 focus-visible:ring-ring/30">
            {picture}
            <span className="ph-mask sr-only">{opponent.nickname}</span>
          </Link>
        ) : (
          <span className="block">
            {picture}
            <span className="ph-mask sr-only">{opponent.nickname}</span>
          </span>
        )
        const player: SeatedPlayer = {
          name: opponent.nickname,
          tag: opponent.handle ? tagText(opponent.handle.tag) : null,
          avatarUrl: opponent.avatarUrl ?? null,
          record: (opponent.record as PlayerRecord | null | undefined) ?? null,
          href,
        }
        return (
          <li key={index}>
            <HoverCard>
              <HoverCardTrigger asChild>{trigger}</HoverCardTrigger>
              <HoverCardContent>
                <UserCard player={player} showTag={false} />
              </HoverCardContent>
            </HoverCard>
          </li>
        )
      })}
      {opponents.length > shown.length && <li className="pl-3 text-xs text-muted-foreground">+{opponents.length - shown.length}</li>}
    </ul>
  )
}

/**
 * One game of a visitor, as a row, in the language of the recent games of a game's page (`GamePlayerBar`, which shares its small facts: `played-game-bits.tsx`): the game with how its table counted ("Ranked", gold, or "Normal"), under it when it was played (the time written
 * as the member chose, `timeFormat`), how long it lasted, the speed, the score where the game counts points and the expansions it was played with; at the right how many sat at the table with their pictures (the others: no names here, their card is under the pointer), where
 * the visitor came, and the rank points it gave or took. A game in progress (its table, and a button to go back to it) has none of that yet; a game with no place (played together) says how it ended instead.
 */
export function GameRecord({ game, timeFormat = "auto" }: { game: PlayedGame; timeFormat?: TimeFormat }) {
  const players = game.playerCount ?? game.opponents.length + 1
  return (
    <Item size="sm">
      <ItemMedia>
        <GameThumb slug={game.slug} name={game.name} />
      </ItemMedia>
      {/* The text keeps at least this much room: where the card is narrower, the result goes under it, instead of squeezing the name of the game into three lines */}
      <ItemContent className="min-w-52">
        <ItemTitle className="line-clamp-none flex flex-wrap">
          <Link href={`/game/${game.slug}`} className="hover:underline">
            {game.name}
          </Link>
          {game.ranked !== undefined && <Badge variant={game.ranked ? "ranked" : "secondary"}>{QUEUE_MODE_LABELS[game.ranked ? "ranked" : "normal"]}</Badge>}
          {game.table && <span className="text-muted-foreground">· table {game.table}</span>}
        </ItemTitle>
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 text-sm text-muted-foreground">
          <time dateTime={game.playedAt}>{gameDate(game.playedAt, timeFormat)}</time>
          {game.durationSeconds !== undefined && <Duration seconds={game.durationSeconds} />}
          {game.pace !== undefined && <PaceFact value={game.pace} className="text-xs" />}
          {game.score !== undefined && <span className="text-xs tabular-nums">Score {game.score}</span>}
          {game.expansions && game.expansions.length > 0 && (
            <span className="max-w-full truncate text-xs" title={game.expansions.join(", ")}>
              + {game.expansions.join(", ")}
            </span>
          )}
        </div>
      </ItemContent>
      <ItemActions className="gap-3">
        <span className="flex items-center gap-2 text-sm text-muted-foreground">
          <PlayerCount count={players} />
          {game.opponents.length > 0 && <Opponents opponents={game.opponents} />}
        </span>
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
            {game.rank !== undefined ? <span className="text-sm text-muted-foreground">{ordinal(game.rank)}</span> : game.result && <ResultBadge result={game.result} />}
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
