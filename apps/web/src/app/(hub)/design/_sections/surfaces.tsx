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
import { getCatalog } from "@pbgo/catalog/server"
import { Alert, AlertAction, AlertDescription, AlertTitle } from "@pbgo/ui/platform/alert"
import { Avatar, AvatarBadge, AvatarCount, AvatarFallback, AvatarGroup, AvatarGroupCount } from "@pbgo/ui/platform/avatar"
import { Button } from "@pbgo/ui/platform/button"
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@pbgo/ui/platform/card"
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@pbgo/ui/platform/empty"
import { GameCard, GameCardVisual } from "@pbgo/ui/platform/game-card"
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
import { Section as PageSection, SectionAction, SectionPreview } from "@pbgo/ui/platform/section"
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
import { catalogCardProps, gamePicture } from "@/lib/game-card-props"
import { BarListSpecimen, BarSpecimen, ChatSpecimen, FriendsSpecimen, DockSpecimen, PresenceLegend, SocialSpecimen } from "../_components/friends-specimen"
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
        description="`CardAction` sits at the top right of the header. The `sm` size is the compact card, for a short list of facts."
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
  // The cards of the live games, built as the hub builds every card: from the game's Notion row (`catalogCardProps`), the registry only
  // making them play cards. Without Notion (no key, or Notion down) they are plain cards from the registry, with no picture
  const { entries } = await getCatalog()
  const live = entries.filter((entry) => entry.live)
  // Pictures for the demo tiles that are not a game of the catalog: the first logo of the catalog stands in for a game's logo, and the
  // first background for its background (a game has to have one in its Notion row first)
  const pictures = entries.map((entry) => gamePicture(entry.game))
  const logo = pictures.find((picture) => picture.logo)?.logo
  const background = pictures.find((picture) => picture.background)?.background
  return (
    <Section
      id="game-card"
      module="game-card"
      intro="The hub's tile for a game: its logo, over its background picture when it has one, on a grey 4:3 frame, then the name, on one line and cut with an ellipsis when it does not fit, and the practical facts (players, duration), nothing else. Every tile is a link, to the page of the game (`/game/<slug>`). Game art is the only colour of the platform, so the card adds none: no accent. No layer is laid over the art either, no scrim or tint: the logo is drawn straight on the background. Hover lifts the card (`shadow-float`) and zooms the pictures. The `soon` variant draws a game to come, in the same list as the others, with a Coming soon badge."
    >
      <Demo
        title="The live games, and without art"
        description="The first cards are the live games of the catalog, as the hub renders them. Each one is the game's Notion row, its name, its logo and its background (from the catalog's picture route) and its facts; the registry only makes it a play card. A game whose row has no background yet shows its logo on the plain grey frame. `players` and `duration` arrive already formatted: `catalogCardProps()` in `apps/web/src/lib/game-card-props.ts` does it, since the card does not know the visitor's language. Without a `logo` and a `background` the frame stays plain grey, no placeholder."
        className="grid gap-4 sm:grid-cols-2"
        code={`import { getCatalog } from "@pbgo/catalog/server"
import { catalogCardProps } from "@/lib/game-card-props"

const { entries } = await getCatalog()

{entries.filter((entry) => entry.live).map((entry) => (
  <GameCard key={entry.slug} {...catalogCardProps(entry)} />
))}

<GameCard href="/a-game" name="A game" logo={logoUrl} background={backgroundUrl} players="3–6 players" duration="20–40 min" />
<GameCard href="/a-game" name="A game without art" players="3–6 players" duration="20–40 min" />
<GameCard href="/a-game" name="A game with a name too long to fit on one line" logo={logoUrl} background={backgroundUrl} players="3–6 players" duration="20–40 min" />`}
      >
        {live.map((entry) => (
          <GameCard key={entry.slug} {...catalogCardProps(entry)} />
        ))}
        <GameCard href="#game-card" name="A game with both pictures" logo={logo} background={background} players="3–6 players" duration="20–40 min" />
        <GameCard href="#game-card" name="A game without art" players="3–6 players" duration="20–40 min" />
        <GameCard href="#game-card" name="A game with a name too long to fit on one line" logo={logo} background={background} players="3–6 players" duration="20–40 min" />
      </Demo>

      <Demo
        title="A game to come"
        description="The `soon` variant is the tile of a game that is not playable yet. It sits in the same list as the live games, built the same way: the same grey frame, the logo (or icon) over the background, the same facts (players, duration), plus a small Coming soon badge at its top right. Both pictures come from the catalog's picture route. Like any other tile it links to the game's page, where the button is disabled. The hub builds it with `catalogCardProps()`, the function of the live games, from a game of the Notion Games database (`docs/catalog.md`); the first pictures of the catalog stand in here. Without a picture the frame stays plain grey, no placeholder."
        className="grid gap-4 sm:grid-cols-2"
        code={`import { catalogCardProps } from "@/lib/game-card-props"

{entries.filter((entry) => !entry.live).map((entry) => (
  <GameCard key={entry.slug} {...catalogCardProps(entry)} />
))}

<GameCard variant="soon" href="/game/a-game" name="A game" logo="/api/catalog/a-game/logo?v=1" background="/api/catalog/a-game/background?v=1" players="2–5 players" duration="30 min" />
<GameCard variant="soon" href="/game/a-game" name="A game without a picture" players="2–4 players" duration="20 min" />`}
      >
        <GameCard variant="soon" href="#game-card" name="A game to come" logo={logo} background={background} players="2–5 players" duration="30 min" />
        <GameCard variant="soon" href="#game-card" name="A game without a picture" players="2–4 players" duration="20 min" />
      </Demo>

      <Demo
        title="The picture alone"
        description="`GameCardVisual` is the picture of a card on its own: the logo over the background on the grey frame, with no layer between them. The page of a game on the hub draws it larger, in the place of its card, rounded like a card with a hairline ring, so that the card and the page cannot drift apart. Without a logo and a background it is a plain frame."
        className="grid gap-4 sm:grid-cols-3"
        code={`<GameCardVisual logo={logoUrl} background={backgroundUrl} />
<GameCardVisual logo={logoUrl} />
<GameCardVisual />

// On the page of a game: larger, rounded like a card, loaded at once
<GameCardVisual logo={logoUrl} background={backgroundUrl} loading="eager" className="rounded-3xl ring-1 ring-foreground/10" />`}
      >
        <GameCardVisual logo={logo} background={background} className="rounded-3xl ring-1 ring-foreground/10" />
        <GameCardVisual logo={logo} className="rounded-3xl ring-1 ring-foreground/10" />
        <GameCardVisual className="rounded-3xl ring-1 ring-foreground/10" />
      </Demo>
    </Section>
  )
}

export async function Sections() {
  // The cards of the demo are the hub's: the live games of the catalog, then games to come that borrow its first pictures
  const { entries } = await getCatalog()
  const live = entries.filter((entry) => entry.live)
  const pictures = entries.map((entry) => gamePicture(entry.game))
  const logo = pictures.find((picture) => picture.logo)?.logo
  const background = pictures.find((picture) => picture.background)?.background
  const soon = ["Cards of Kings", "Dice Harbor", "Last Lantern", "The Long Table", "Moss & Stone", "Salt Road"]
  return (
    <Section
      id="section"
      module="section"
      intro="A block of a hub page: what it shows, and the way to the page of its tab. The home is a stack of them (the popular games, the tables and tournaments in progress, what's new). A section has no visible title: what it shows says what it is, and a screen reader gets an `sr-only` heading. It is as wide as the window between its `px-gutter` margins (64px on a desktop), with no `max-w-page`, so the cards of a list fill a desktop screen and keeps `pb-section` below it, so a stack needs no spacing of its own. Name it with `aria-labelledby`, pointing at its heading, or with an `aria-label`."
    >
      <Demo
        title="A preview of a list"
        description="`SectionPreview` is for a list that has more to show than the section has room for: what it holds fades out at the bottom (a mask on the content alone, `mask-b-from-60%`, so it is opacity and no colour of the page) and its `action` sits over the fade, centred. `SectionAction` is a link drawn as a button, bigger than a control of a page (`h-12`, `text-base`): it is the one thing a visitor is asked to do there. It is the framework's link through `asChild`. The home cuts its grid to three rows at every width."
        code={`<Section aria-labelledby="popular-games">
  <h2 id="popular-games" className="sr-only">Popular games</h2>
  <SectionPreview
    action={
      <SectionAction asChild>
        <Link href="/games">See all games</Link>
      </SectionAction>
    }
  >
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {games.map((game) => <GameCard key={game.slug} {...game.props} />)}
    </div>
  </SectionPreview>
</Section>`}
      >
        <PageSection aria-label="Popular games" className="px-0 pb-0">
          <SectionPreview
            action={<SectionAction href="#section">See all games</SectionAction>}
          >
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {live.map((entry) => (
                <GameCard key={entry.slug} {...catalogCardProps(entry)} />
              ))}
              {soon.map((name) => (
                <GameCard key={name} variant="soon" href="#section" name={name} logo={logo} background={background} players="2–5 players" duration="30 min" />
              ))}
            </div>
          </SectionPreview>
        </PageSection>
      </Demo>

      <Demo
        title="Nothing to list yet"
        description="A section whose list does not exist yet shows an `Empty` that says what is to come, compact (`p-6`, not the `p-12` of a page with nothing else) since the home stacks three of them, and the same button under it, centred by the section (`items-center`). The tab's own page says the same. The rows of tables, or the cards of tournaments, will take the place of the empty state, in a `SectionPreview`, with the same fade and the same button as the games."
        code={`<Section aria-labelledby="tables-in-progress" className="items-center gap-6">
  <h2 id="tables-in-progress" className="sr-only">Tables in progress</h2>
  <Empty className="border p-6">
    <EmptyHeader>
      <EmptyTitle>No table to join yet</EmptyTitle>
      <EmptyDescription>Tables are private for now: …</EmptyDescription>
    </EmptyHeader>
  </Empty>
  <SectionAction asChild>
    <Link href="/tables">See all tables</Link>
  </SectionAction>
</Section>`}
      >
        <PageSection aria-label="Tables in progress" className="items-center gap-6 px-0 pb-0">
          <Empty className="border p-6">
            <EmptyHeader>
              <EmptyTitle>No table to join yet</EmptyTitle>
              <EmptyDescription>
                Tables are private for now: open one from a game and share its link. The tables open to everyone will be listed here.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
          <SectionAction href="#section">See all tables</SectionAction>
        </PageSection>
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
        description="`xl` (64px) is the picture of a profile, at the top of the menu of the account. `AvatarBadge` marks a state such as online or host, at the bottom right. `AvatarCount` puts what waits for the person (messages not read, requests to answer) on the top right corner, outlined in the colour of the page, and draws nothing for 0. `AvatarGroup` overlaps its avatars, so a group shows one initial each, and ends with `AvatarGroupCount`."
        className={ROW}
        code={`<Avatar size="sm"><AvatarFallback>AL</AvatarFallback></Avatar>
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

export function FriendsPanels() {
  return (
    <Section
      id="friends-panel"
      module="friends-panel"
      intro="The friends of a signed-in visitor, as a panel for a page: a header with the count of those online and the button to add a friend, a search field, the list game by game (each game that some friends are in is headed by its picture, its name and how many of them are in it, a button that folds its friends away and unfolds them, with a chevron under the pointer and whenever it is folded, with all of them under it, those who wait in its lobby and those who play it in one list, the players first; then, by status, the friends who are in no game: online, inactive, do not disturb, away; an empty group is not drawn) and a footer button to invite a friend who has no account yet. It is drawn from the friends it is given (`Friend`: nickname, tag, picture, status and what they are doing) and decides nothing about them: where they come from (PLT-23) and what a button does are the page's, and a button whose handler is missing is not drawn. A status is a shape, a colour and a word, never the colour alone: the dot on the corner of the picture is a blue disc with a play knocked out of it for a friend in a game, a green disc for one who is online, an orange-yellow moon for one who is inactive, a red disc with a bar knocked out of it for one who does not want to be disturbed and a thick grey ring for one who is away; only the dot is coloured, the line under their name is quiet text, and the section says it too."
    >
      <Demo
        title="The four dots"
        description="`PresenceDot` sits on the corner of a picture and takes the picture's size: a green disc for a friend who is online (active), a blue disc with a play knocked out of it, down to the colour of the page, for one who is in a game, an orange-yellow moon for one who is inactive, a red disc with a bar knocked out of it for one who does not want to be disturbed, and a thick grey ring for one who is away (its outline is a quarter of the dot: 2px of 8, 3px of 10 and of 12). The dots are small (8px on a small picture, 10px, 12px on a large one), in the bottom right corner of the picture, and cut out of it by a ring of the colour of the page, 3px (2px on a small picture). Only the dot is coloured: the line under a name is quiet text."
        code={`<Avatar>
  <AvatarImage src={url} alt="" />
  <AvatarFallback>M</AvatarFallback>
  <PresenceDot status="playing" />
</Avatar>`}
      >
        <PresenceLegend />
      </Demo>
      <Demo
        title="With friends, and with none"
        description="The panel is `h-full` and scrolls its list, so a page gives it a height and a width: here a box of `h-[34rem]`. It is the list of the page of a visitor's friends; the short way to the same friends, on every page, is the navbar's island below. The buttons of a friend (Join for one in a game, Invite for one who is online) show when the row is hovered or focused, and always on a touch screen. Type in the search field to filter the list."
        className="grid gap-6 sm:grid-cols-2"
        code={`<FriendsPanel
  friends={friends}
  gameIcon={(slug) => iconOf(slug)}
  onAddFriend={…}
  onInvite={(friend) => …}
  onJoin={(friend) => …}
  onShareLink={copyLink}
/>`}
      >
        <FriendsSpecimen />
        <FriendsSpecimen empty />
      </Demo>
    </Section>
  )
}

export function FriendsBars() {
  return (
    <Section
      id="friends-bar"
      module="friends-bar"
      intro="The friends of a signed-in visitor, the way the Riot Client shows its social visibility: a small bar on the navbar, which is the start of the dock's bar, before the account's picture and the button of the social panel (it draws no container of its own), with a pill for each game some of them are in (the picture of the game and how many of them are in it), up to three, the most crowded first. Under the pointer a pill takes the fill of the navbar's current item and a line under it, and a narrow panel opens centred under that pill with that game's friends in two lists, `Online` (those who wait in its lobby, and those at one table together under it: `Table K7Q · 2/4`) then `Playing`, each with the picture and the dot of their presence, their name and what they are doing. A friend who is away, or on the hub and in no game, is in none of them: they are in the list of the page of the friends. With no friend in a game the bar is the button that invites one. Like the panel, a status is the dot on the picture (a blue disc with a play knocked out for a friend who is playing, a green disc online, an orange-yellow moon inactive, a red disc with a bar do not disturb) and, under the name, a line of quiet text (only the dot is coloured), and always a word too. Like the panel it is drawn from the friends it is given and decides nothing about them. The panel is a `Popover` anchored on the bar: it opens under the pointer (a short delay on the way out lets the pointer cross the gap to it), with the keyboard (a pill that has the focus) and, on a touch screen, when a pill is pressed, which closes it when pressed again; a narrow screen has room for fewer pills. While the dock is open the bar is folded away (the dock gives it no room, no pointer and no focus), and the profile takes its place."
    >
      <Demo
        title="On the navbar, with friends and with none"
        description="The bar draws no container, so it stands in an island here (on the hub it is the top of the dock, in the next section). Hover a pill, or focus it with the keyboard, to open the panel of its game, and move to another pill to change it. The second bar is a visitor with no friend in a game: the button that invites one, which shows a tick for a moment once the link is copied. The Join button of a friend who waits at a table that has room shows when the row is hovered or focused, and always on a touch screen."
        className="grid gap-6 sm:grid-cols-2"
        code={`<NavbarIsland>
  <FriendsBar
    friends={friends}
    gameIcon={(slug) => iconOf(slug)}
    onJoin={(friend) => …}
    onShareLink={copyLink}
  />
</NavbarIsland>`}
      >
        <BarSpecimen />
        <BarSpecimen empty />
      </Demo>
      <Demo
        title="The panel of a game"
        description="What the panel says, on its own: `Online` first, the friends at one table together under it, then `Playing`. A list with nobody in it is not drawn. The panel is a `PopoverContent`, `w-72`, with no scrollbar, and as high as the window leaves it."
        code={`<FriendsBarList entry={entry} onJoin={(friend) => …} />`}
      >
        <BarListSpecimen />
      </Demo>
    </Section>
  )
}

export function SocialPanels() {
  return (
    <Section
      id="social-panel"
      module="social-panel"
      intro="The social panel of a signed-in visitor, the way the Riot Client has it: a column on the right of the page that is the same container as the bar of the games and the account's picture: the dock (`SocialDock`) is a bar while it is closed and a real side panel while it is open, one glass surface that grows and shrinks between the two, the panel fading in under the bar, which becomes its header: the games fold away, the visitor's picture glides to the start of the bar and says who they are beside it (their name and their status: `SocialDockIdentity`), and the button stays where it was. A button of the bar opens and closes it (`SocialPanelToggle`: `PanelRightOpenIcon` while it is closed and `PanelRightCloseIcon` while it is open, the two crossfading). What waits for the visitor (messages not read, requests to answer) is the count on the corner of their picture (`AvatarCount`), not on that button. Under the bar are three tabs, each an icon, the tile behind the current one gliding to the one that is pressed and the pane of the tab coming in from the side the tab is on while the other leaves: the friends game by game, with what they are doing (the list of the friends' panel, with its search), the conversations with them (the picture and the dot of the friend, their name, the last message, how long ago and how many are not read), and the way to add a friend, with the requests that wait for an answer (accept or decline one that came in, cancel one that went out). In the conversations, what is new is white (the last message and how long ago) and what was read is grey. A tab that has something for the visitor carries a count, and so does the visitor's picture on the navbar. It is drawn from what it is given and decides nothing: a button whose handler is missing is not drawn, and the field that adds a friend is off. Under the pointer a friend has a card (`FriendCard`), to the left of the panel; the menu of the profile opens there too. A press on a friend or on a conversation opens the chat with them (`ChatWindow`), a card that floats at the bottom of the page next to the panel. The dock has its place in the navbar, as wide as the bar and 3.5rem high, and grows out of it, over the page (on the hub, `SiteSocial` of `apps/web`); the chat window is placed by the page and slides in from the bottom (`PanelPresence`)."
    >
      <Demo
        title="The three tabs, with friends and with none"
        description="The panel is as high as the page gives it and scrolls what a tab holds, without a scrollbar. Press a tab to change it. A visitor with no friend, message or request has an empty state in each tab, and the buttons that need them to exist are the page's to give. The field that adds a friend sends with its button or Enter."
        className="grid gap-6 sm:grid-cols-2"
        code={`<SocialPanel
  header={…}
  friends={friends}
  gameIcon={(slug) => iconOf(slug)}
  conversations={conversations}
  requests={requests}
  onOpenChat={(friend) => …}
  onSendRequest={(who) => …}
  onAnswerRequest={(request, answer) => …}
  onShareLink={copyLink}
/>`}
      >
        <SocialSpecimen />
        <SocialSpecimen tab="messages" />
        <SocialSpecimen tab="add" />
        <SocialSpecimen empty />
      </Demo>
      <Demo
        title="One container, two states"
        description="Press the button of the bar: the container grows from a bar into a side panel (its width, its height and its corners, `rounded-2xl` to `rounded-4xl`, over `DURATION.slow` with `EASE_STANDARD`) and the bar becomes its header: the games fold away (their width, then their opacity), the picture glides to the start while the name and the status unfold beside it, the button stays at the end and swaps its icon, and the panel fades in under it once there is room for it. Press it again and all of it goes back. Press a tab: the tile glides to it, and its pane comes in from that side. With less motion asked for, it changes at once."
        code={`<SocialDock
  open={open}
  games={
    <>
      <FriendsBar friends={friends} … />
      <Separator orientation="vertical" />
    </>
  }
  profile={
    <AccountMenu …>
      <button>
        <Avatar …><AvatarCount count={waiting} />…</Avatar>
        <SocialDockIdentity>
          <span>{nickname}</span>
          <span>Online</span>
        </SocialDockIdentity>
      </button>
    </AccountMenu>
  }
  toggle={<SocialPanelToggle open={open} onClick={() => setOpen(!open)} />}
>
  <SocialPanel bare tab={tab} onTabChange={setTab} friends={friends} … />
</SocialDock>`}
      >
        <DockSpecimen />
      </Demo>
      <Demo
        title="The chat window"
        description="The friend at the top (their picture, the dot of their presence, their name and what they are doing), the `···` button that opens the menu of what can be done with them (join them or invite them, remove them, block them: an entry whose handler is missing is not drawn, and without any the button is not) and the button that closes it, the messages as bubbles (the visitor's on the right, filled; the friend's on the left, quiet) with the last one in view, and the field, which takes the focus when the chat opens and sends with Enter or its button. Try it: what is written is added here and goes nowhere."
        code={`<ChatWindow
  friend={friend}
  messages={messages}
  onSend={(text) => …}
  onClose={…}
  onJoin={…}
  onRemove={…}
  onBlock={…}
  className="fixed bottom-6 right-[25rem] h-96 w-80"
/>`}
      >
        <ChatSpecimen />
      </Demo>
    </Section>
  )
}
