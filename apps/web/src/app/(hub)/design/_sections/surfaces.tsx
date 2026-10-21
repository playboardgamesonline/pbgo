import { HugeiconsIcon } from "@hugeicons/react"
import {
  Alert02Icon,
  Calendar03Icon,
  FolderAddIcon,
  InformationCircleIcon,
  MoreHorizontalIcon,
  Settings01Icon,
  UserGroupIcon,
} from "@hugeicons/core-free-icons"
import { gameCover } from "@pbgo/core/sanity/cover"
import { listedGames } from "@pbgo/games/registry"
import { Alert, AlertAction, AlertDescription, AlertTitle } from "@pbgo/ui/platform/alert"
import { Avatar, AvatarBadge, AvatarFallback, AvatarGroup, AvatarGroupCount } from "@pbgo/ui/platform/avatar"
import { Button } from "@pbgo/ui/platform/button"
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@pbgo/ui/platform/card"
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@pbgo/ui/platform/empty"
import { GameCard } from "@pbgo/ui/platform/game-card"
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemSeparator,
  ItemTitle,
} from "@pbgo/ui/platform/item"
import { Progress } from "@pbgo/ui/platform/progress"
import { Separator } from "@pbgo/ui/platform/separator"
import { Skeleton } from "@pbgo/ui/platform/skeleton"
import { Spinner } from "@pbgo/ui/platform/spinner"
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@pbgo/ui/platform/table"
import { gameCardProps } from "@/lib/game-card-props"
import { Demo, Section } from "../_components/layout"

const ROW = "flex flex-wrap items-center gap-3"

const SCORES: readonly { rank: number; player: string; rounds: number; score: number }[] = [
  { rank: 1, player: "Alex", rounds: 4, score: 128 },
  { rank: 2, player: "Sam", rounds: 3, score: 112 },
  { rank: 3, player: "Robin", rounds: 1, score: 97 },
  { rank: 4, player: "Jo", rounds: 0, score: 64 },
]

export function Cards() {
  return (
    <Section
      id="card"
      module="card"
      intro="The container of the platform: a `bg-card` surface with a hairline ring and `shadow-surface`, rounded to `rounded-4xl`. Header, content and footer share one `--card-spacing`; `size=&quot;sm&quot;` tightens it."
    >
      <Demo
        title="Default and small"
        description="`CardAction` sits at the top right of the header. The small card is the one of the hub's How it works row."
        className="grid gap-6 md:grid-cols-2"
        code={`<Card>
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
</Card>`}
      >
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
      </Demo>
    </Section>
  )
}

export async function GameCards() {
  // Cover art from each game's Sanity project, as the hub reads it
  const cards = await Promise.all(listedGames().map(async (game) => ({ game, cover: await gameCover(game) })))
  return (
    <Section
      id="game-card"
      module="game-card"
      intro="The hub's tile for a game: a big 4:3 visual, the name, the tagline and the practical facts. Game art is the only colour of the platform, so the card adds none: no scrim over the visual, no accent. Hover lifts the card (`shadow-float`) and zooms the visual."
    >
      <Demo
        title="From the registry, and without art"
        description="The first cards are the live games of the registry, as the hub renders them. The cover art is read from the game's Sanity project by `gameCover()`. `players` and `duration` arrive already formatted: `gameCardProps()` in `apps/web/src/lib/game-card-props.ts` does it, since the card does not know the visitor's language. Without a `visual`, it shows a neutral placeholder."
        className="grid gap-4 sm:grid-cols-2"
        code={`import { gameCover } from "@pbgo/core/sanity/cover"
import { listedGames } from "@pbgo/games/registry"
import { gameCardProps } from "@/lib/game-card-props"

const cards = await Promise.all(
  listedGames().map(async (game) => ({ game, cover: await gameCover(game) })),
)

{cards.map(({ game, cover }) => (
  <GameCard key={game.slug} {...gameCardProps(game, cover)} />
))}

<GameCard href="/a-game" name="A game" tagline="Short pitch." players="3–6 players" duration="20–40 min" />`}
      >
        {cards.map(({ game, cover }) => (
          <GameCard key={game.slug} {...gameCardProps(game, cover)} />
        ))}
        <GameCard
          href="#game-card"
          name="A game without cover art"
          tagline="The placeholder keeps the grid aligned until the art is ready."
          players="3–6 players"
          duration="20–40 min"
        />
      </Demo>
    </Section>
  )
}

export function Avatars() {
  return (
    <Section
      id="avatar"
      module="avatar"
      intro="A round marker for a player. It shows the picture when there is one (`AvatarImage`) and the initials otherwise (`AvatarFallback`)."
    >
      <Demo
        title="Sizes, badge and group"
        description="`AvatarBadge` marks a state such as online or host. `AvatarGroup` overlaps its avatars, so a group shows one initial each, and ends with `AvatarGroupCount`."
        className={ROW}
        code={`<Avatar size="sm"><AvatarFallback>AL</AvatarFallback></Avatar>
<Avatar><AvatarFallback>SM</AvatarFallback></Avatar>
<Avatar size="lg"><AvatarFallback>RO</AvatarFallback></Avatar>

<Avatar>
  <AvatarFallback>JO</AvatarFallback>
  <AvatarBadge />
</Avatar>

<AvatarGroup>
  <Avatar><AvatarFallback>A</AvatarFallback></Avatar>
  <Avatar><AvatarFallback>S</AvatarFallback></Avatar>
  <Avatar><AvatarFallback>R</AvatarFallback></Avatar>
  <AvatarGroupCount>+3</AvatarGroupCount>
</AvatarGroup>`}
      >
        <Avatar size="sm">
          <AvatarFallback>AL</AvatarFallback>
        </Avatar>
        <Avatar>
          <AvatarFallback>SM</AvatarFallback>
        </Avatar>
        <Avatar size="lg">
          <AvatarFallback>RO</AvatarFallback>
        </Avatar>
        <Avatar>
          <AvatarFallback>JO</AvatarFallback>
          <AvatarBadge />
        </Avatar>
        <AvatarGroup>
          <Avatar>
            <AvatarFallback>A</AvatarFallback>
          </Avatar>
          <Avatar>
            <AvatarFallback>S</AvatarFallback>
          </Avatar>
          <Avatar>
            <AvatarFallback>R</AvatarFallback>
          </Avatar>
          <AvatarGroupCount>+3</AvatarGroupCount>
        </AvatarGroup>
      </Demo>
    </Section>
  )
}

export function Alerts() {
  return (
    <Section
      id="alert"
      module="alert"
      intro="A message that stays on the page: a notice, a warning, a failed request. For a passing confirmation, use a toast."
    >
      <Demo
        title="Default, destructive and with an action"
        description="The icon is the first child and sits in its own column. `AlertAction` is pinned to the top right."
        className="flex flex-col gap-4"
        code={`<Alert>
  <HugeiconsIcon icon={InformationCircleIcon} strokeWidth={2} />
  <AlertTitle>The table is full</AlertTitle>
  <AlertDescription>Five players is the maximum for this game.</AlertDescription>
</Alert>

<Alert variant="destructive">
  <HugeiconsIcon icon={Alert02Icon} strokeWidth={2} />
  <AlertTitle>The table could not be saved</AlertTitle>
  <AlertDescription>Check your connection and try again.</AlertDescription>
  <AlertAction><Button variant="outline" size="xs">Retry</Button></AlertAction>
</Alert>`}
      >
        <Alert>
          <HugeiconsIcon icon={InformationCircleIcon} strokeWidth={2} />
          <AlertTitle>The table is full</AlertTitle>
          <AlertDescription>Five players is the maximum for this game.</AlertDescription>
        </Alert>
        <Alert variant="destructive">
          <HugeiconsIcon icon={Alert02Icon} strokeWidth={2} />
          <AlertTitle>The table could not be saved</AlertTitle>
          <AlertDescription>Check your connection and try again.</AlertDescription>
          <AlertAction>
            <Button variant="outline" size="xs">
              Retry
            </Button>
          </AlertAction>
        </Alert>
      </Demo>
    </Section>
  )
}

export function Loading() {
  return (
    <Section
      id="progress"
      module="progress"
      intro="Three ways to say that something is on its way. A progress bar when the share is known, a spinner when it is not, a skeleton to hold the shape of content that is loading. Spinner and skeleton are `@pbgo/ui/platform/spinner` and `@pbgo/ui/platform/skeleton`."
    >
      <Demo
        title="Progress"
        description="`value` goes from 0 to 100."
        className="flex flex-col gap-4"
        code={`<Progress value={35} />`}
      >
        {[0, 35, 70, 100].map((value) => (
          <div key={value} className="flex items-center gap-4">
            <Progress value={value} aria-label={`${value}%`} />
            <span className="w-10 shrink-0 text-right text-sm text-muted-foreground">{value}%</span>
          </div>
        ))}
      </Demo>

      <Demo
        title="Spinner"
        description="It is an icon: size it with `size-*`. Inside a button, give it `data-icon` and the button pads for it."
        className={ROW}
        code={`<Spinner />
<Spinner className="size-6" />
<Spinner className="size-8" />
<Button disabled><Spinner data-icon="inline-start" />Saving</Button>`}
      >
        <Spinner />
        <Spinner className="size-6" />
        <Spinner className="size-8" />
        <Button disabled>
          <Spinner data-icon="inline-start" />
          Saving
        </Button>
      </Demo>

      <Demo
        title="Skeleton"
        description="A pulsing `bg-muted` block. Size and round it to match the content it stands for."
        code={`<Skeleton className="size-12 rounded-full" />
<Skeleton className="h-4 w-2/3" />
<Skeleton className="h-4 w-1/2" />`}
      >
        <div className="flex max-w-sm items-center gap-4">
          <Skeleton className="size-12 shrink-0 rounded-full" />
          <div className="flex flex-1 flex-col gap-2">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        </div>
      </Demo>
    </Section>
  )
}

export function Separators() {
  return (
    <Section
      id="separator"
      module="separator"
      intro="A hairline between two groups. It is decorative by default (hidden from assistive technology); pass `decorative={false}` when it really divides regions."
    >
      <Demo
        title="Horizontal and vertical"
        description="A vertical separator needs a parent with a height, here `h-5`."
        code={`<Separator />

<div className="flex h-5 items-center gap-4 text-sm">
  <span>Rules</span>
  <Separator orientation="vertical" />
  <span>Scores</span>
  <Separator orientation="vertical" />
  <span>Settings</span>
</div>`}
      >
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
      </Demo>
    </Section>
  )
}

export function Empties() {
  return (
    <Section
      id="empty"
      module="empty"
      intro="What a list or a page shows when it has nothing yet: say what is missing and offer the one way to fill it. It sets a dashed border style but no border width, so add `border` when it should be framed."
    >
      <Demo
        title="Icon, message and action"
        code={`<Empty className="border">
  <EmptyHeader>
    <EmptyMedia variant="icon"><HugeiconsIcon icon={FolderAddIcon} strokeWidth={2} /></EmptyMedia>
    <EmptyTitle>No tables yet</EmptyTitle>
    <EmptyDescription>Create a table and share its link with your friends.</EmptyDescription>
  </EmptyHeader>
  <EmptyContent><Button>Create a table</Button></EmptyContent>
</Empty>`}
      >
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
      </Demo>
    </Section>
  )
}

export function Items() {
  return (
    <Section
      id="item"
      module="item"
      intro="One row of a list: a media, a title and a description, and actions on the right. Use it for settings, tables to join and menus of a page; reach for a card when the content is a block of its own."
    >
      <Demo
        title="Variants"
        description="`default` has no frame, `outline` a hairline, `muted` a soft fill."
        className="flex flex-col gap-4"
        code={`<ItemGroup>
  <Item variant="outline">
    <ItemMedia variant="icon"><HugeiconsIcon icon={Calendar03Icon} strokeWidth={2} /></ItemMedia>
    <ItemContent>
      <ItemTitle>Friday night</ItemTitle>
      <ItemDescription>3 of 5 players · waiting to start</ItemDescription>
    </ItemContent>
    <ItemActions><Button variant="outline" size="sm">Join</Button></ItemActions>
  </Item>
</ItemGroup>`}
      >
        <ItemGroup>
          {(["default", "outline", "muted"] as const).map((variant) => (
            <Item key={variant} variant={variant}>
              <ItemMedia variant="icon">
                <HugeiconsIcon icon={Calendar03Icon} strokeWidth={2} />
              </ItemMedia>
              <ItemContent>
                <ItemTitle className="capitalize">{variant}</ItemTitle>
                <ItemDescription>3 of 5 players · waiting to start</ItemDescription>
              </ItemContent>
              <ItemActions>
                <Button variant="outline" size="sm">
                  Join
                </Button>
              </ItemActions>
            </Item>
          ))}
        </ItemGroup>
      </Demo>

      <Demo
        title="Sizes and separators"
        description="`default`, `sm` and `xs` trade padding for density. `ItemSeparator` splits rows inside a group."
        code={`<ItemGroup>
  <Item>
    <ItemMedia variant="icon"><HugeiconsIcon icon={Settings01Icon} strokeWidth={2} /></ItemMedia>
    <ItemContent>
      <ItemTitle>Default</ItemTitle>
      <ItemDescription>The comfortable row.</ItemDescription>
    </ItemContent>
  </Item>
  <ItemSeparator />
  <Item size="sm">
    <ItemMedia variant="icon"><HugeiconsIcon icon={Settings01Icon} strokeWidth={2} /></ItemMedia>
    <ItemContent>
      <ItemTitle>Small</ItemTitle>
      <ItemDescription>A denser row.</ItemDescription>
    </ItemContent>
  </Item>
  <ItemSeparator />
  <Item size="xs">
    <ItemMedia variant="icon"><HugeiconsIcon icon={Settings01Icon} strokeWidth={2} /></ItemMedia>
    <ItemContent>
      <ItemTitle>Extra small</ItemTitle>
    </ItemContent>
  </Item>
</ItemGroup>`}
      >
        <ItemGroup>
          <Item>
            <ItemMedia variant="icon">
              <HugeiconsIcon icon={Settings01Icon} strokeWidth={2} />
            </ItemMedia>
            <ItemContent>
              <ItemTitle>Default</ItemTitle>
              <ItemDescription>The comfortable row.</ItemDescription>
            </ItemContent>
          </Item>
          <ItemSeparator />
          <Item size="sm">
            <ItemMedia variant="icon">
              <HugeiconsIcon icon={Settings01Icon} strokeWidth={2} />
            </ItemMedia>
            <ItemContent>
              <ItemTitle>Small</ItemTitle>
              <ItemDescription>A denser row.</ItemDescription>
            </ItemContent>
          </Item>
          <ItemSeparator />
          <Item size="xs">
            <ItemMedia variant="icon">
              <HugeiconsIcon icon={Settings01Icon} strokeWidth={2} />
            </ItemMedia>
            <ItemContent>
              <ItemTitle>Extra small</ItemTitle>
            </ItemContent>
          </Item>
        </ItemGroup>
      </Demo>
    </Section>
  )
}

export function Tables() {
  return (
    <Section
      id="table"
      module="table"
      intro="Tabular data with a header row, hairline rows and an optional footer. It scrolls sideways inside its container instead of widening the page."
    >
      <Demo
        title="Scoreboard"
        description="Align numbers to the right. The caption sits under the table; the footer carries the total."
        className="p-2"
        code={`<Table>
  <TableCaption>Final scores</TableCaption>
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
  <TableFooter>
    <TableRow>
      <TableCell>Total</TableCell>
      <TableCell className="text-right">128</TableCell>
    </TableRow>
  </TableFooter>
</Table>`}
      >
        <Table>
          <TableCaption>Final scores of the evening</TableCaption>
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
          <TableFooter>
            <TableRow>
              <TableCell colSpan={3}>Total</TableCell>
              <TableCell className="text-right">{SCORES.reduce((sum, row) => sum + row.score, 0)}</TableCell>
            </TableRow>
          </TableFooter>
        </Table>
      </Demo>
    </Section>
  )
}
