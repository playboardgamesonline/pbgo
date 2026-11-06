// The live specimens of the navigation pages of the design docs (`docs/design`): one component for each piece the markdown shows, registered by name below. The words around them are the page's.

import type { Specimens } from "@pbgo/docs/markdown"
import { Avatar, AvatarFallback } from "@pbgo/ui/platform/avatar"
import { Button } from "@pbgo/ui/platform/button"
import { Logo } from "@pbgo/ui/platform/logo"
import { Navbar, NavbarBrand, NavbarEnd, NavbarSeparator, NavbarStart, NavbarTab, NavbarTabs } from "@pbgo/ui/platform/navbar"
import { SearchBar, SearchBarClear, SearchBarField, SearchBarInput, SearchBarSubmit } from "@pbgo/ui/platform/search-bar"
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

export const navigationSpecimens: Specimens = {
  "logo-sizes": LogoSizes,
  "navbar-signed-out": NavbarSignedOut,
  "navbar-signed-in": NavbarSignedIn,
  "navbar-moving": NavbarMoving,
  "search-bar-states": SearchBarStates,
  "search-bar-filters": SearchBarWithFilters,
}
