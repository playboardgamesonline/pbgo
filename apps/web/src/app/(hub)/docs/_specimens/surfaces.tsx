// The live specimens of the surfaces page of the design docs (`docs/design`): one component for each piece the markdown shows, registered by name below. The words around them are the page's.

import type { Specimens } from "@pbgo/docs/markdown"
import { HugeiconsIcon } from "@hugeicons/react"
import { Alert02Icon, FolderAddIcon, InformationCircleIcon, MoreHorizontalIcon, Settings01Icon, UserGroupIcon } from "@hugeicons/core-free-icons"
import { getCatalog } from "@pbgo/catalog/server"
import { Alert, AlertDescription, AlertTitle } from "@pbgo/ui/platform/alert"
import { Avatar, AvatarBadge, AvatarCount, AvatarFallback } from "@pbgo/ui/platform/avatar"
import { Button } from "@pbgo/ui/platform/button"
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@pbgo/ui/platform/card"
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@pbgo/ui/platform/empty"
import { GameCard, GameCardVisual } from "@pbgo/ui/platform/game-card"
import { Item, ItemContent, ItemDescription, ItemMedia, ItemTitle } from "@pbgo/ui/platform/item"
import { Progress } from "@pbgo/ui/platform/progress"
import { Separator } from "@pbgo/ui/platform/separator"
import { Skeleton } from "@pbgo/ui/platform/skeleton"
import { Spinner } from "@pbgo/ui/platform/spinner"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@pbgo/ui/platform/table"
import { catalogCardProps, gamePicture } from "@/lib/game-card-props"
import { Frame } from "./text"

const ROW = "flex flex-wrap items-center gap-3"

const SCORES: readonly { rank: number; player: string; rounds: number; score: number }[] = [
  { rank: 1, player: "Alex", rounds: 4, score: 128 },
  { rank: 2, player: "Sam", rounds: 3, score: 112 },
  { rank: 3, player: "Robin", rounds: 1, score: 97 },
  { rank: 4, player: "Jo", rounds: 0, score: 64 },
]

function CardDefaultAndSmall() {
  return (
    <Frame className="grid gap-6 md:grid-cols-2" code={`<Card>
  <CardHeader>
    <CardTitle>Friday night</CardTitle>
    <CardDescription>3 of 5 players</CardDescription>
    <CardAction>
      <Button variant="ghost" size="icon-sm" aria-label="More">
        <HugeiconsIcon icon={MoreHorizontalIcon} strokeWidth={2} />
      </Button>
    </CardAction>
  </CardHeader>
  <CardContent>Waiting for the host to start the game.</CardContent>
  <CardFooter className="gap-2">
    <Button>Join</Button>
    <Button variant="outline">Copy link</Button>
  </CardFooter>
</Card>

<Card size="sm">
  <CardHeader>
    <CardTitle>Play together</CardTitle>
    <CardDescription>
      Everyone plays from their own browser, rules and scoring handled for you.
    </CardDescription>
  </CardHeader>
</Card>`}>
      <Card>
        <CardHeader>
          <CardTitle>Friday night</CardTitle>
          <CardDescription>3 of 5 players</CardDescription>
          <CardAction>
            <Button variant="ghost" size="icon-sm" aria-label="More">
              <HugeiconsIcon icon={MoreHorizontalIcon} strokeWidth={2} />
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent>Waiting for the host to start the game.</CardContent>
        <CardFooter className="gap-2">
          <Button>Join</Button>
          <Button variant="outline">Copy link</Button>
        </CardFooter>
      </Card>

      <Card size="sm">
        <CardHeader>
          <div className="mb-2 flex size-10 items-center justify-center rounded-full bg-muted">
            <HugeiconsIcon icon={UserGroupIcon} strokeWidth={2} className="size-5" />
          </div>
          <CardTitle>Play together</CardTitle>
          <CardDescription>
            Everyone plays from their own browser, rules and scoring handled for you.
          </CardDescription>
        </CardHeader>
      </Card>
    </Frame>
  )
}

/**
 * What the specimens that draw games take from the catalog. The live games are built as the hub builds every card: from the game in the Studio (`catalogCardProps`), the registry only making them play cards. While the
 * platform's Sanity project cannot be read they are plain cards from the registry, with no picture. The tiles that are made up for a specimen are not a game of the catalog, so the first logo of the catalog stands in for a
 * game's logo and the first background for its background (a game has to have one in the Studio first).
 */
async function readCatalog() {
  const { entries } = await getCatalog()
  const pictures = entries.map((entry) => gamePicture(entry.game))
  return {
    live: entries.filter((entry) => entry.live),
    logo: pictures.find((picture) => picture.logo)?.logo,
    background: pictures.find((picture) => picture.background)?.background,
  }
}

async function GameCardTheLiveGamesAndWithoutArt() {
  const { live, logo, background } = await readCatalog()
  return (
    <Frame className="grid gap-4 sm:grid-cols-2" code={`import { getCatalog } from "@pbgo/catalog/server"
import { catalogCardProps } from "@/lib/game-card-props"

const { entries } = await getCatalog()

{entries.filter((entry) => entry.live).map((entry) => (
  <GameCard key={entry.slug} {...catalogCardProps(entry)} />
))}

<GameCard href="/a-game" name="A game" logo={logoUrl} background={backgroundUrl} players="3–6 players" duration="20–40 min" />
<GameCard href="/a-game" name="A game without art" players="3–6 players" duration="20–40 min" />
<GameCard href="/a-game" name="A game with a name too long to fit on one line" logo={logoUrl} background={backgroundUrl} players="3–6 players" duration="20–40 min" />`}>
      {live.map((entry) => (
        <GameCard key={entry.slug} {...catalogCardProps(entry)} />
      ))}
      <GameCard href="#game-card" name="A game with both pictures" logo={logo} background={background} players="3–6 players" duration="20–40 min" />
      <GameCard href="#game-card" name="A game without art" players="3–6 players" duration="20–40 min" />
      <GameCard href="#game-card" name="A game with a name too long to fit on one line" logo={logo} background={background} players="3–6 players" duration="20–40 min" />
    </Frame>
  )
}

async function GameCardAGameToCome() {
  const { logo, background } = await readCatalog()
  return (
    <Frame className="grid gap-4 sm:grid-cols-2" code={`import { catalogCardProps } from "@/lib/game-card-props"

{entries.filter((entry) => !entry.live).map((entry) => (
  <GameCard key={entry.slug} {...catalogCardProps(entry)} />
))}

<GameCard variant="soon" href="/game/a-game" name="A game" logo="/api/catalog/a-game/logo?v=1" background="/api/catalog/a-game/background?v=1" players="2–5 players" duration="30 min" />
<GameCard variant="soon" href="/game/a-game" name="A game without a picture" players="2–4 players" duration="20 min" />`}>
      <GameCard variant="soon" href="#game-card" name="A game to come" logo={logo} background={background} players="2–5 players" duration="30 min" />
      <GameCard variant="soon" href="#game-card" name="A game without a picture" players="2–4 players" duration="20 min" />
    </Frame>
  )
}

async function GameCardThePictureAlone() {
  const { logo, background } = await readCatalog()
  return (
    <Frame className="grid gap-4 sm:grid-cols-3" code={`<GameCardVisual logo={logoUrl} background={backgroundUrl} />
<GameCardVisual logo={logoUrl} />
<GameCardVisual />

// On the page of a game: larger, rounded like a card, loaded at once
<GameCardVisual logo={logoUrl} background={backgroundUrl} loading="eager" className="rounded-3xl ring-1 ring-foreground/10" />`}>
      <GameCardVisual logo={logo} background={background} className="rounded-3xl ring-1 ring-foreground/10" />
      <GameCardVisual logo={logo} className="rounded-3xl ring-1 ring-foreground/10" />
      <GameCardVisual className="rounded-3xl ring-1 ring-foreground/10" />
    </Frame>
  )
}

function AvatarSizesBadgeAndCount() {
  return (
    <Frame className={ROW} code={`<Avatar size="sm"><AvatarFallback>AL</AvatarFallback></Avatar>
<Avatar><AvatarFallback>SM</AvatarFallback></Avatar>
<Avatar size="lg"><AvatarFallback>RO</AvatarFallback></Avatar>
<Avatar size="xl"><AvatarFallback>XL</AvatarFallback></Avatar>

<Avatar>
  <AvatarFallback>JO</AvatarFallback>
  <AvatarBadge />
</Avatar>

<Avatar size="lg">
  <AvatarFallback>RO</AvatarFallback>
  <AvatarCount count={3} />
  <AvatarBadge />
</Avatar>`}>
      <Avatar size="sm">
        <AvatarFallback>AL</AvatarFallback>
      </Avatar>
      <Avatar>
        <AvatarFallback>SM</AvatarFallback>
      </Avatar>
      <Avatar size="lg">
        <AvatarFallback>RO</AvatarFallback>
      </Avatar>
      <Avatar size="xl">
        <AvatarFallback>XL</AvatarFallback>
      </Avatar>
      <Avatar>
        <AvatarFallback>JO</AvatarFallback>
        <AvatarBadge />
      </Avatar>
      <Avatar size="lg">
        <AvatarFallback>RO</AvatarFallback>
        <AvatarCount count={3} />
        <AvatarBadge />
      </Avatar>
    </Frame>
  )
}

function AlertDefaultAndDestructive() {
  return (
    <Frame className="flex flex-col gap-4" code={`<Alert>
  <HugeiconsIcon icon={InformationCircleIcon} strokeWidth={2} />
  <AlertTitle>The table is full</AlertTitle>
  <AlertDescription>Five players is the maximum for this game.</AlertDescription>
</Alert>

<Alert variant="destructive">
  <HugeiconsIcon icon={Alert02Icon} strokeWidth={2} />
  <AlertTitle>The table could not be saved</AlertTitle>
  <AlertDescription>Check your connection and try again.</AlertDescription>
</Alert>`}>
      <Alert>
        <HugeiconsIcon icon={InformationCircleIcon} strokeWidth={2} />
        <AlertTitle>The table is full</AlertTitle>
        <AlertDescription>Five players is the maximum for this game.</AlertDescription>
      </Alert>
      <Alert variant="destructive">
        <HugeiconsIcon icon={Alert02Icon} strokeWidth={2} />
        <AlertTitle>The table could not be saved</AlertTitle>
        <AlertDescription>Check your connection and try again.</AlertDescription>
      </Alert>
    </Frame>
  )
}

function ProgressBar() {
  return (
    <Frame className="flex flex-col gap-4" code={`<Progress value={35} />`}>
      {[0, 35, 70, 100].map((value) => (
        <div key={value} className="flex items-center gap-4">
          <Progress value={value} aria-label={`${value}%`} />
          <span className="w-10 shrink-0 text-right text-sm text-muted-foreground">{value}%</span>
        </div>
      ))}
    </Frame>
  )
}

function ProgressSpinner() {
  return (
    <Frame className={ROW} code={`<Spinner />
<Spinner className="size-6" />
<Spinner className="size-8" />
<Button disabled><Spinner data-icon="inline-start" />Saving</Button>`}>
      <Spinner />
      <Spinner className="size-6" />
      <Spinner className="size-8" />
      <Button disabled>
        <Spinner data-icon="inline-start" />
        Saving
      </Button>
    </Frame>
  )
}

function ProgressSkeleton() {
  return (
    <Frame code={`<Skeleton className="size-12 rounded-full" />
<Skeleton className="h-4 w-2/3" />
<Skeleton className="h-4 w-1/2" />`}>
      <div className="flex max-w-sm items-center gap-4">
        <Skeleton className="size-12 shrink-0 rounded-full" />
        <div className="flex flex-1 flex-col gap-2">
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      </div>
    </Frame>
  )
}

function SeparatorHorizontalAndVertical() {
  return (
    <Frame code={`<Separator />

<div className="flex h-5 items-center gap-4 text-sm">
  <span>Rules</span>
  <Separator orientation="vertical" />
  <span>Scores</span>
  <Separator orientation="vertical" />
  <span>Settings</span>
</div>`}>
      <div className="flex max-w-sm flex-col gap-4 text-sm">
        <div className="flex flex-col gap-1">
          <p>Friday night</p>
          <p className="text-muted-foreground">3 of 5 players</p>
        </div>
        <Separator />
        <div className="flex h-5 items-center gap-4">
          <span>Rules</span>
          <Separator orientation="vertical" />
          <span>Scores</span>
          <Separator orientation="vertical" />
          <span>Settings</span>
        </div>
      </div>
    </Frame>
  )
}

function EmptyIconMessageAndAction() {
  return (
    <Frame code={`<Empty className="border">
  <EmptyHeader>
    <EmptyMedia variant="icon"><HugeiconsIcon icon={FolderAddIcon} strokeWidth={2} /></EmptyMedia>
    <EmptyTitle>No tables yet</EmptyTitle>
    <EmptyDescription>Create a table and share its link with your friends.</EmptyDescription>
  </EmptyHeader>
  <EmptyContent><Button>Create a table</Button></EmptyContent>
</Empty>`}>
      <Empty className="border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <HugeiconsIcon icon={FolderAddIcon} strokeWidth={2} />
          </EmptyMedia>
          <EmptyTitle>No tables yet</EmptyTitle>
          <EmptyDescription>Create a table and share its link with your friends.</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button>Create a table</Button>
        </EmptyContent>
      </Empty>
    </Frame>
  )
}

function ItemSizes() {
  return (
    <Frame className="flex flex-col gap-4" code={`<Item variant="outline">
  <ItemMedia variant="icon"><HugeiconsIcon icon={Settings01Icon} strokeWidth={2} /></ItemMedia>
  <ItemContent>
    <ItemTitle>Default</ItemTitle>
    <ItemDescription>The comfortable row.</ItemDescription>
  </ItemContent>
</Item>

<Item variant="outline" size="sm">
  <ItemMedia variant="icon"><HugeiconsIcon icon={Settings01Icon} strokeWidth={2} /></ItemMedia>
  <ItemContent>
    <ItemTitle>Small</ItemTitle>
    <ItemDescription>A denser row.</ItemDescription>
  </ItemContent>
</Item>`}>
      <Item variant="outline">
        <ItemMedia variant="icon">
          <HugeiconsIcon icon={Settings01Icon} strokeWidth={2} />
        </ItemMedia>
        <ItemContent>
          <ItemTitle>Default</ItemTitle>
          <ItemDescription>The comfortable row.</ItemDescription>
        </ItemContent>
      </Item>
      <Item variant="outline" size="sm">
        <ItemMedia variant="icon">
          <HugeiconsIcon icon={Settings01Icon} strokeWidth={2} />
        </ItemMedia>
        <ItemContent>
          <ItemTitle>Small</ItemTitle>
          <ItemDescription>A denser row.</ItemDescription>
        </ItemContent>
      </Item>
    </Frame>
  )
}

function TableScoreboard() {
  return (
    <Frame className="p-2" code={`<Table>
  <TableHeader>
    <TableRow>
      <TableHead>Player</TableHead>
      <TableHead className="text-right">Score</TableHead>
    </TableRow>
  </TableHeader>
  <TableBody>
    <TableRow>
      <TableCell>Alex</TableCell>
      <TableCell className="text-right">128</TableCell>
    </TableRow>
  </TableBody>
</Table>`}>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-16">Rank</TableHead>
            <TableHead>Player</TableHead>
            <TableHead className="text-right">Rounds won</TableHead>
            <TableHead className="text-right">Score</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {SCORES.map((row) => (
            <TableRow key={row.player}>
              <TableCell>{row.rank}</TableCell>
              <TableCell>{row.player}</TableCell>
              <TableCell className="text-right">{row.rounds}</TableCell>
              <TableCell className="text-right">{row.score}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Frame>
  )
}

export const surfacesSpecimens: Specimens = {
  "card-default-and-small": CardDefaultAndSmall,
  "game-card-the-live-games-and-without-art": GameCardTheLiveGamesAndWithoutArt,
  "game-card-a-game-to-come": GameCardAGameToCome,
  "game-card-the-picture-alone": GameCardThePictureAlone,
  "avatar-sizes-badge-and-count": AvatarSizesBadgeAndCount,
  "alert-default-and-destructive": AlertDefaultAndDestructive,
  "progress-bar": ProgressBar,
  "progress-spinner": ProgressSpinner,
  "progress-skeleton": ProgressSkeleton,
  "separator-horizontal-and-vertical": SeparatorHorizontalAndVertical,
  "empty-icon-message-and-action": EmptyIconMessageAndAction,
  "item-sizes": ItemSizes,
  "table-scoreboard": TableScoreboard,
}
