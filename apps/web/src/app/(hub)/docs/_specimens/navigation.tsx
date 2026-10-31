// The live specimens of the navigation page of the design docs (`docs/design`): one component for each piece the markdown shows, registered by name below. The words around them are the page's.

import type { Specimens } from "@pbgo/docs/markdown"
import { Avatar, AvatarFallback } from "@pbgo/ui/platform/avatar"
import { Button } from "@pbgo/ui/platform/button"
import { DISPLAY_FACES } from "@pbgo/ui/faces"
import { Logo } from "@pbgo/ui/platform/logo"
import { Navbar, NavbarBrand, NavbarEnd, NavbarSeparator, NavbarStart, NavbarTab, NavbarTabs } from "@pbgo/ui/platform/navbar"
import { SearchBar, SearchBarClear, SearchBarField, SearchBarInput, SearchBarSubmit } from "@pbgo/ui/platform/search-bar"
import { Perks, Stats } from "@pbgo/ui/platform/stats"
import { Suit } from "@pbgo/ui/platform/suits"
import { TitleCards, TitlePiece } from "@pbgo/ui/platform/title-piece"
import { Wordmark } from "@pbgo/ui/platform/wordmark"
import { FaceRow } from "./face-specimen"
import { FiltersSpecimen } from "./filters-specimen"
import { NavbarPlayground } from "./navbar-playground"
import { Frame } from "./text"

/** The left container of the two navbars below: the brand, then the tabs. On the home the brand is current, else the Games tab is. */
function Start({ home = false }: { home?: boolean }) {
  return (
    <NavbarStart>
      <NavbarBrand href="#navbar" aria-label="Home" current={home}>
        <Logo className="h-6" />
      </NavbarBrand>
      <NavbarTabs aria-label="Main">
        <NavbarTab href="#navbar" current={!home}>
          Games
        </NavbarTab>
        <NavbarTab href="#navbar">
          Tables
        </NavbarTab>
        <NavbarTab href="#navbar">
          Tournaments
        </NavbarTab>
        <NavbarSeparator />
        <NavbarTab href="#navbar">
          About
        </NavbarTab>
        <NavbarTab href="#navbar">
          Pricing
        </NavbarTab>
      </NavbarTabs>
    </NavbarStart>
  )
}

function LogoSizes() {
  return (
    <Frame className="flex flex-wrap items-end gap-8" code={`<Logo className="h-6" />
<Logo />
<Logo className="h-12" />
<Logo className="h-16 text-muted-foreground" />`}>
      <Logo className="h-6" />
      <Logo />
      <Logo className="h-12" />
      <Logo className="h-16 text-muted-foreground" />
    </Frame>
  )
}

function WordmarkFooter() {
  return (
    <Frame code={`<footer className="w-full pb-5">
  <div className="flex flex-wrap items-center justify-between gap-x-8 gap-y-3 p-5 text-sm text-muted-foreground">
    <p className="p-1">© 2026 Play Board Games Online · Built by …</p>
    <nav aria-label="Legal" className="flex flex-wrap items-center gap-x-3">…</nav>
  </div>
  <Wordmark />
  <p className="mx-5 mt-3 p-1 text-center fine-print">Unofficial, online adaptation of board games. …</p>
</footer>`}>
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 pb-5 text-sm text-muted-foreground">
        <p className="p-1">© 2026 Play Board Games Online · Built by oré</p>
        <p className="p-1">Privacy Policy · Cookie Policy · Terms of Use</p>
      </div>
      <Wordmark />
      <p className="mt-3 p-1 text-center fine-print">
        Unofficial, online adaptation of board games. All rights belong to their authors and the publisher.
      </p>
    </Frame>
  )
}

function WordmarkFaces() {
  return (
    <div className="divide-y rounded-3xl border p-6">
      {DISPLAY_FACES.map((face) => (
        <FaceRow key={face.utility} face={face.utility} letter={face.letter} fontsource={face.fontsource} />
      ))}
    </div>
  )
}

function NavbarSignedOut() {
  return (
    <Frame className="overflow-hidden bg-card p-0" code={`<Navbar>
  <NavbarStart>
    <NavbarBrand href="/" aria-label="Home" current>
      <Logo className="h-6" />
    </NavbarBrand>
    <NavbarTabs aria-label="Main">
      <NavbarTab href="/games">Games</NavbarTab>
      <NavbarTab href="/tables">Tables</NavbarTab>
      <NavbarTab href="/tournaments">Tournaments</NavbarTab>
      <NavbarSeparator />
      <NavbarTab href="/about">About</NavbarTab>
      <NavbarTab href="/pricing">Pricing</NavbarTab>
    </NavbarTabs>
  </NavbarStart>
  <NavbarEnd>
    <Button variant="ghost" size="lg">Sign in</Button>
    <Button size="lg">{"Let's play"}</Button>
  </NavbarEnd>
</Navbar>

<Navbar className="fixed inset-x-0 top-0 z-40">…</Navbar>`}>
      <Navbar>
        <Start home />
        <NavbarEnd>
          <Button variant="ghost" size="lg">
            Sign in
          </Button>
          <Button size="lg">{"Let's play"}</Button>
        </NavbarEnd>
      </Navbar>
    </Frame>
  )
}

function NavbarSignedIn() {
  return (
    <Frame className="overflow-hidden bg-card p-0" code={`<NavbarEnd>
  <Avatar className="size-10">
    <AvatarFallback>AL</AvatarFallback>
  </Avatar>
</NavbarEnd>`}>
      <Navbar>
        <Start />
        <NavbarEnd>
          <Avatar className="size-10">
            <AvatarFallback>AL</AvatarFallback>
          </Avatar>
        </NavbarEnd>
      </Navbar>
    </Frame>
  )
}

function NavbarMoving() {
  return (
    <Frame className="overflow-hidden bg-card p-0" code={`const [current, setCurrent] = useState("home")

<Navbar>
  <NavbarStart>
    <NavbarBrand href="/" aria-label="Home" current={current === "home"}>
      <Logo className="h-6" />
    </NavbarBrand>
    <NavbarTabs aria-label="Main">
      <NavbarTab href="/games" current={current === "games"}>Games</NavbarTab>
      …
    </NavbarTabs>
  </NavbarStart>
</Navbar>`}>
      <NavbarPlayground />
    </Frame>
  )
}

function SearchBarStates() {
  return (
    <Frame className="flex flex-col gap-4" code={`<SearchBar aria-label="Search the games">
  <SearchBarField>
    <SearchBarSubmit aria-label="Search" />
    <SearchBarInput aria-label="Search a game" placeholder="Search a game" />
  </SearchBarField>
</SearchBar>

<SearchBar aria-label="Search the games">
  <SearchBarField>
    <SearchBarSubmit aria-label="Search" />
    <SearchBarInput aria-label="Search a game" defaultValue="Hanabi" />
    <SearchBarClear aria-label="Clear the search" />
  </SearchBarField>
</SearchBar>`}>
      <SearchBar method="dialog" aria-label="Search the games">
        <SearchBarField>
          <SearchBarSubmit aria-label="Search" />
          <SearchBarInput aria-label="Search a game" placeholder="Search a game" />
        </SearchBarField>
      </SearchBar>
      <SearchBar method="dialog" aria-label="Search the games">
        <SearchBarField>
          <SearchBarSubmit aria-label="Search" />
          <SearchBarInput aria-label="Search a game" defaultValue="Hanabi" />
          <SearchBarClear aria-label="Clear the search" />
        </SearchBarField>
      </SearchBar>
    </Frame>
  )
}

function SearchBarWithFilters() {
  return (
    <Frame className="flex flex-col gap-10" code={`<SearchBar aria-label="Search the games">
  <SearchBarField>
    <SearchBarSubmit aria-label="Search" />
    <SearchBarInput aria-label="Search a game" placeholder="Search a game" />
  </SearchBarField>
  <Popover>
    <PopoverTrigger asChild>
      <SearchBarSegment
        icon={GridViewIcon}
        label="Category"
        value={picked.length > 0 ? picked.join(", ") : "Any category"}
        idle={picked.length === 0}
        picks={picked.map((name) => ({ label: name, icon: iconOf(name) }))}
      />
    </PopoverTrigger>
    <PopoverContent aria-label="Categories" align="end" className="w-52 gap-0 p-0">
      <Combobox options={categories} value={picked} onValueChange={setPicked} aria-label="Categories" placeholder="Search categories..." empty="No category matches." />
    </PopoverContent>
  </Popover>
</SearchBar>
<SearchBarFilters aria-label="More filters">
  <SearchBarStepper
    icon={UserMultipleIcon}
    label="Players"
    value="4"
    valueLabel="4 players"
    decreaseLabel="Fewer players"
    increaseLabel="More players"
    onDecrease={fewer}
    onIncrease={more}
  />
  <SearchBarGroup label="Duration">
    <span className="flex items-center gap-2">
      <SearchBarIcon icon={HourglassIcon} />
      <SearchBarValue className="w-8">30′</SearchBarValue>
    </span>
    <Slider className="mx-1 w-16" min={0} max={11} value={[step]} onValueChange={slide} />
  </SearchBarGroup>
  <SearchBarGroup label="Complexity">
    <SearchBarIcon icon={Brain02Icon} />
    <Meter value={level} onValueChange={setLevel} levelLabel={(level) => \`Up to \${level} of 5\`} />
  </SearchBarGroup>
  <DropdownMenu>
    <DropdownMenuTrigger asChild>
      <SearchBarSegment icon={ChildIcon} label="Age" value="8+" boxed />
    </DropdownMenuTrigger>
    <DropdownMenuContent>…</DropdownMenuContent>
  </DropdownMenu>
</SearchBarFilters>`}>
      <FiltersSpecimen />
      <FiltersSpecimen picked />
    </Frame>
  )
}

function SearchBarHero() {
  return (
    <Frame className="overflow-hidden p-0" code={`<section className="pt-navbar">
  <div className="mx-auto flex max-w-page flex-col items-center px-gutter pt-20 pb-12 text-center sm:pt-28">
    <h1 className="display-title">
      <span className="block text-display">Play your favorite</span> <span className="block text-display">board games online</span>
    </h1>
    <Stats className="mt-8" items={…} />
    <Perks className="mt-6" items={…} />
    <div className="mt-16 w-full max-w-3xl sm:max-w-hero-bar">
      <SearchBar>…</SearchBar>
      <SearchBarFilters>…</SearchBarFilters>
    </div>
  </div>
</section>`}>
      <div className="flex flex-col items-center px-6 pt-12 pb-10 text-center">
        <p className="display-title">
          <span className="block text-4xl">Play your favorite</span> <span className="block text-4xl">board games online</span>
        </p>
        <Stats className="mt-6" items={[{ value: "128", label: "players online", live: true }, { value: "12,480", label: "members" }, { value: "71", label: "games" }]} />
        <Perks className="mt-4" items={["Free to play", "No sign-up needed"]} />
        <div className="mt-8 w-full max-w-xl">
          <SearchBar method="dialog" aria-label="Search games, tables and tournaments">
            <SearchBarField>
              <SearchBarSubmit aria-label="Search" />
              <SearchBarInput aria-label="Search games, tables and tournaments" placeholder="Search games, tables & tournaments..." />
            </SearchBarField>
          </SearchBar>
        </div>
      </div>
    </Frame>
  )
}

function SearchBarListHead() {
  return (
    <Frame className="overflow-hidden p-0" code={`<ListPageHeader title="Tables">
  <ListSearch label="Search tables" placeholder="Search tables..." />
</ListPageHeader>

<ListPageHeader title="Games">
  <HeroSearch label="Search games" placeholder="Search games..." />
</ListPageHeader>`}>
      <div className="flex flex-col items-center gap-8 px-6 pt-12 pb-10 text-center">
        <p className="page-title">Tables</p>
        <div className="w-full max-w-xl">
          <SearchBar method="dialog" aria-label="Search tables">
            <SearchBarField>
              <SearchBarSubmit aria-label="Search" />
              <SearchBarInput aria-label="Search tables" placeholder="Search tables..." />
            </SearchBarField>
          </SearchBar>
        </div>
      </div>
    </Frame>
  )
}

function TitlePieces() {
  return (
    <Frame className="flex flex-col items-center gap-6 py-10" code={`<h1 className="display-title">
  <span className="block text-display">Play y<TitlePiece kind="coin">o</TitlePiece>ur fav<TitlePiece kind="suits">o</TitlePiece>rite</span>
  <span className="block text-display">b<TitlePiece kind="die">o</TitlePiece>ard games <TitleCards />online</span>
</h1>`}>
      <p className="display-title text-center text-5xl">
        <span className="block">
          Play y<TitlePiece kind="coin">o</TitlePiece>ur fav<TitlePiece kind="suits">o</TitlePiece>rite
        </span>
        <span className="block">
          b<TitlePiece kind="die">o</TitlePiece>ard games <TitleCards className="inline-block" />online
        </span>
      </p>
      <div className="flex items-center gap-4 text-foreground">
        <Suit suit="heart" className="size-8 fill-piece-red" />
        <Suit suit="diamond" className="size-8 fill-piece-red" />
        <Suit suit="spade" className="size-8 fill-foreground" />
        <Suit suit="club" className="size-8 fill-foreground" />
      </div>
    </Frame>
  )
}

function StatsUnderATitle() {
  return (
    <Frame className="flex flex-col items-center gap-4 py-10 text-center" code={`<Stats items={[{ value: "128", label: "players online", live: true }, { value: "12,480", label: "members" }, { value: "71", label: "games" }]} />
<Perks items={["Free to play", "No sign-up needed"]} />`}>
      <Stats
        items={[
          { value: "128", label: "players online", live: true },
          { value: "12,480", label: "members" },
          { value: "71", label: "games" },
        ]}
      />
      <Perks items={["Free to play", "No sign-up needed"]} />
    </Frame>
  )
}

export const navigationSpecimens: Specimens = {
  "logo-sizes": LogoSizes,
  "wordmark-footer": WordmarkFooter,
  "wordmark-faces": WordmarkFaces,
  "navbar-signed-out": NavbarSignedOut,
  "navbar-signed-in": NavbarSignedIn,
  "navbar-moving": NavbarMoving,
  "search-bar-states": SearchBarStates,
  "search-bar-filters": SearchBarWithFilters,
  "search-bar-hero": SearchBarHero,
  "search-bar-list-head": SearchBarListHead,
  "title-pieces": TitlePieces,
  "stats-under-a-title": StatsUnderATitle,
}
