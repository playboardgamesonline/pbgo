import { Baby01Icon, Clock01Icon, GridViewIcon, UserGroupIcon } from "@hugeicons/core-free-icons"
import { Avatar, AvatarFallback } from "@pbgo/ui/platform/avatar"
import { Button } from "@pbgo/ui/platform/button"
import { Logo } from "@pbgo/ui/platform/logo"
import { Navbar, NavbarBrand, NavbarEnd, NavbarStart, NavbarTab, NavbarTabs } from "@pbgo/ui/platform/navbar"
import { Popover, PopoverContent, PopoverHeader, PopoverTitle, PopoverTrigger } from "@pbgo/ui/platform/popover"
import {
  SearchBar,
  SearchBarClear,
  SearchBarField,
  SearchBarInput,
  SearchBarSegment,
  SearchBarSegments,
  SearchBarSubmit,
} from "@pbgo/ui/platform/search-bar"
import { ToggleGroup, ToggleGroupItem } from "@pbgo/ui/platform/toggle-group"
import { Demo, Section } from "../_components/layout"

export function Logos() {
  return (
    <Section
      id="logo"
      module="logo"
      intro="The mark of the platform, PB over GO, drawn as an inline SVG on `currentColor`: it takes the colour of the text around it and needs no file, since `apps/web/public` holds `favicon.ico` only. Its height is `h-8` and its width follows."
    >
      <Demo
        title="Sizes and colour"
        description="Size it with a height (`h-6`, `h-12`…) and colour it with a text colour. The navbar uses `h-6`, the size of its tabs' text. It is hidden from screen readers, so a link around it carries the name (`aria-label`); a logo that stands alone takes a `title`."
        className="flex flex-wrap items-end gap-8"
        code={`<Logo className="h-6" />
<Logo />
<Logo className="h-12" />
<Logo className="h-16 text-muted-foreground" />`}
      >
        <Logo className="h-6" />
        <Logo />
        <Logo className="h-12" />
        <Logo className="h-16 text-muted-foreground" />
      </Demo>
    </Section>
  )
}

/** The left container of the two navbars below: the brand, then the tabs. */
function Start() {
  return (
    <NavbarStart>
      <NavbarBrand href="#navbar" aria-label="Home">
        <Logo className="h-6" />
      </NavbarBrand>
      <NavbarTabs aria-label="Main">
        <NavbarTab href="#navbar" current>
          Games
        </NavbarTab>
        <NavbarTab href="#navbar">
          Tables
        </NavbarTab>
        <NavbarTab href="#navbar">
          Tournaments
        </NavbarTab>
        <NavbarTab href="#navbar">
          What&apos;s New
        </NavbarTab>
      </NavbarTabs>
    </NavbarStart>
  )
}

export function Navbars() {
  return (
    <Section
      id="navbar"
      module="navbar"
      intro="The top of a page, in two containers kept apart over a transparent bar: the brand and the tabs on the left (`NavbarStart`), the account on the right (`NavbarEnd`). Each container is a rounded glass island (a border, a blur, a light shadow) and nothing is drawn between them: the page shows through the bar and the pointer goes through it, so the backdrop of the page (the home's hero) shows behind both islands. The bar spans the window, not the width of the page, so the islands sit on its edges. The page pins the bar with `fixed inset-x-0 top-0 z-40` so that it stays in view while the page scrolls, leaves `pt-navbar` under it (or lets its backdrop run under it), and gives an anchor that lands below it `scroll-mt-navbar`. The tabs leave the first island under `md`, where the account needs the room."
    >
      <Demo
        title="Signed out"
        description="`NavbarTab` marks the page the visitor is in with `current`. A tab whose page does not exist yet can be `disabled`: text only, announced as a link that is off. The links are plain `<a>` (`@pbgo/ui` is framework-free): a page passes its router's link with `asChild`. Sign in is the ghost button and Sign up the primary one, both of size `lg`, the height of what an island holds. The specimens sit on `bg-card`, a little lighter than the page, as the islands sit over the top of the home's hero."
        className="overflow-hidden bg-card p-0"
        code={`<Navbar>
  <NavbarStart>
    <NavbarBrand href="/" aria-label="Home">
      <Logo className="h-6" />
    </NavbarBrand>
    <NavbarTabs aria-label="Main">
      <NavbarTab href="/" current>Games</NavbarTab>
      <NavbarTab href="/tables">Tables</NavbarTab>
      <NavbarTab href="/tournaments">Tournaments</NavbarTab>
      <NavbarTab href="/whats-new">What's New</NavbarTab>
    </NavbarTabs>
  </NavbarStart>
  <NavbarEnd>
    <Button variant="ghost" size="lg">Sign in</Button>
    <Button size="lg">Sign up</Button>
  </NavbarEnd>
</Navbar>

<Navbar className="fixed inset-x-0 top-0 z-40">…</Navbar>`}
      >
        <Navbar>
          <Start />
          <NavbarEnd>
            <Button variant="ghost" size="lg">
              Sign in
            </Button>
            <Button size="lg">Sign up</Button>
          </NavbarEnd>
        </Navbar>
      </Demo>

      <Demo
        title="Signed in"
        description="The account is an `Avatar` in place of the two buttons. At `size-10`, the height of what an island holds, the right container closes round it; what the avatar opens is the page's business."
        className="overflow-hidden bg-card p-0"
        code={`<NavbarEnd>
  <Avatar className="size-10">
    <AvatarFallback>AL</AvatarFallback>
  </Avatar>
</NavbarEnd>`}
      >
        <Navbar>
          <Start />
          <NavbarEnd>
            <Avatar className="size-10">
              <AvatarFallback>AL</AvatarFallback>
            </Avatar>
          </NavbarEnd>
        </Navbar>
      </Demo>
    </Section>
  )
}

/** The options of the specimens below. */
const FILTERS = {
  category: { icon: GridViewIcon, label: "Category", chips: ["Bluffing", "Cards", "Co-op", "Party", "Strategy"] },
  players: { icon: UserGroupIcon, label: "Players", chips: ["1", "2", "3", "4", "5", "6", "7", "8+"] },
  duration: { icon: Clock01Icon, label: "Duration", chips: ["15 min", "30 min", "45 min"] },
  age: { icon: Baby01Icon, label: "Age", chips: ["6", "8", "10", "12", "14"] },
} as const

/** One filter of the bar, as the home builds it: a segment that opens a panel of chips. `picked` is what is chosen, nothing for an idle segment. */
function FilterSegment({ filter, value, picked = [] }: { filter: keyof typeof FILTERS; value: string; picked?: string[] }) {
  const { icon, label, chips } = FILTERS[filter]
  const multiple = filter === "category"
  return (
    <Popover>
      <PopoverTrigger asChild>
        <SearchBarSegment icon={icon} label={label} value={value} idle={picked.length === 0} />
      </PopoverTrigger>
      <PopoverContent aria-label={label}>
        <PopoverHeader>
          <PopoverTitle>{label}</PopoverTitle>
          <Button type="button" variant="ghost" size="sm" disabled={picked.length === 0}>
            Clear
          </Button>
        </PopoverHeader>
        {multiple ? (
          <ToggleGroup type="multiple" defaultValue={picked} aria-label={label}>
            {chips.map((chip) => (
              <ToggleGroupItem key={chip} value={chip}>
                {chip}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        ) : (
          <ToggleGroup type="single" defaultValue={picked[0]} aria-label={label}>
            {chips.map((chip) => (
              <ToggleGroupItem key={chip} value={chip}>
                {chip}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        )}
      </PopoverContent>
    </Popover>
  )
}

export function SearchBars() {
  return (
    <Section
      id="search-bar"
      module="search-bar"
      intro="The big search pill of a page: a field, a button that clears it once there is a text, and the round button that submits it. Filters can sit in the same bar as segments, each one an icon, a small label and what is picked, opening a `Popover` of chips. It only draws the bar. The page owns the text, the picks and what they find. The field is `text-base` on every screen: a smaller text makes iOS zoom the page in on focus."
    >
      <Demo
        title="Empty and filled"
        description="`SearchBarField` holds the input and, once there is a text, `SearchBarClear`, which the page uses to empty the field and put the focus back in it. The field and each button need an `aria-label`: the pill shows no label of its own. These forms do nothing when sent (`method=dialog`)."
        className="flex flex-col gap-4"
        code={`<SearchBar aria-label="Search the games">
  <SearchBarField>
    <SearchBarInput aria-label="Search a game" placeholder="Search a game" />
  </SearchBarField>
  <SearchBarSubmit aria-label="Search" />
</SearchBar>

<SearchBar aria-label="Search the games">
  <SearchBarField>
    <SearchBarInput aria-label="Search a game" defaultValue="Hanabi" />
    <SearchBarClear aria-label="Clear the search" />
  </SearchBarField>
  <SearchBarSubmit aria-label="Search" />
</SearchBar>`}
      >
        <SearchBar method="dialog" aria-label="Search the games">
          <SearchBarField>
            <SearchBarInput aria-label="Search a game" placeholder="Search a game" />
          </SearchBarField>
          <SearchBarSubmit aria-label="Search" />
        </SearchBar>
        <SearchBar method="dialog" aria-label="Search the games">
          <SearchBarField>
            <SearchBarInput aria-label="Search a game" defaultValue="Hanabi" />
            <SearchBarClear aria-label="Clear the search" />
          </SearchBarField>
          <SearchBarSubmit aria-label="Search" />
        </SearchBar>
      </Demo>

      <Demo
        title="With filters"
        description="`SearchBarSegments` goes between the field and the button, with no more than four `SearchBarSegment`. A segment shows what it filters by and what is picked, dimmed while nothing is (`idle`). Wrap it in a `PopoverTrigger asChild`: that gives it `aria-expanded`, which paints it while its panel is open. The bar is one pill when the room it has is 56rem wide or more, as in the home's hero, and a card below that, the field and the button on top and the segments under them, as in this column. The segments are `type=button`, so only the field and the round button send the form."
        className="flex flex-col gap-4"
        code={`<SearchBar aria-label="Search the games">
  <SearchBarField>
    <SearchBarInput aria-label="Search a game" placeholder="Search a game" />
  </SearchBarField>
  <SearchBarSegments aria-label="Filter the games">
    <Popover>
      <PopoverTrigger asChild>
        <SearchBarSegment icon={UserGroupIcon} label="Players" value="4 players" />
      </PopoverTrigger>
      <PopoverContent aria-label="Players">…</PopoverContent>
    </Popover>
    <Popover>
      <PopoverTrigger asChild>
        <SearchBarSegment icon={Baby01Icon} label="Age" value="Any age" idle />
      </PopoverTrigger>
      <PopoverContent aria-label="Age">…</PopoverContent>
    </Popover>
  </SearchBarSegments>
  <SearchBarSubmit aria-label="Search" />
</SearchBar>`}
      >
        <SearchBar method="dialog" aria-label="Search the games">
          <SearchBarField>
            <SearchBarInput aria-label="Search a game" placeholder="Search a game" />
          </SearchBarField>
          <SearchBarSegments aria-label="Filter the games">
            <FilterSegment filter="category" value="Any category" />
            <FilterSegment filter="players" value="Any players" />
            <FilterSegment filter="duration" value="Any duration" />
            <FilterSegment filter="age" value="Any age" />
          </SearchBarSegments>
          <SearchBarSubmit aria-label="Search" />
        </SearchBar>
        <SearchBar method="dialog" aria-label="Search the games">
          <SearchBarField>
            <SearchBarInput aria-label="Search a game" defaultValue="Flip" />
            <SearchBarClear aria-label="Clear the search" />
          </SearchBarField>
          <SearchBarSegments aria-label="Filter the games">
            <FilterSegment filter="category" value="Cards +1" picked={["Cards", "Party"]} />
            <FilterSegment filter="players" value="4 players" picked={["4"]} />
            <FilterSegment filter="duration" value="Up to 30 min" picked={["30 min"]} />
            <FilterSegment filter="age" value="8 years old" picked={["8"]} />
          </SearchBarSegments>
          <SearchBarSubmit aria-label="Search" />
        </SearchBar>
      </Demo>

      <Demo
        title="Under a title"
        description="On the home the pill sits under the title, in the hero. Nothing is drawn behind it, no band and no border: only the backdrop of the page, a neutral that is lighter at the top and fades into the black the content sits on."
        className="overflow-hidden p-0"
        code={`<section className="bg-linear-to-b from-secondary via-card to-background pt-navbar">
  <div className="mx-auto flex max-w-page flex-col items-center gap-10 px-gutter pt-section pb-12 text-center">
    <h1 className="font-heading text-4xl sm:text-6xl lg:text-8xl">…</h1>
    <div className="w-full max-w-3xl">
      <SearchBar>…</SearchBar>
    </div>
  </div>
</section>`}
      >
        <div className="flex flex-col items-center gap-8 bg-linear-to-b from-secondary via-card to-background px-6 pt-12 pb-10 text-center">
          <p className="font-heading text-3xl">Play board games with friends & rivals</p>
          <div className="w-full max-w-xl">
            <SearchBar method="dialog" aria-label="Search the games">
              <SearchBarField>
                <SearchBarInput aria-label="Search a game" placeholder="Search a game" />
              </SearchBarField>
              <SearchBarSubmit aria-label="Search" />
            </SearchBar>
          </div>
        </div>
      </Demo>
    </Section>
  )
}
