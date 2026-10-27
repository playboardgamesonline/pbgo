import { Avatar, AvatarFallback } from "@pbgo/ui/platform/avatar"
import { Button } from "@pbgo/ui/platform/button"
import { Logo } from "@pbgo/ui/platform/logo"
import { Navbar, NavbarBrand, NavbarEnd, NavbarStart, NavbarTab, NavbarTabs } from "@pbgo/ui/platform/navbar"
import { SearchBar, SearchBarClear, SearchBarInput, SearchBarSubmit } from "@pbgo/ui/platform/search-bar"
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
        description="Size it with a height (`h-6`, `h-12`…) and colour it with a text colour. It is hidden from screen readers, so a link around it carries the name (`aria-label`); a logo that stands alone takes a `title`."
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

/** The left cluster of the two navbars below: the brand, then the tabs. */
function Start() {
  return (
    <NavbarStart>
      <NavbarBrand href="#navbar" aria-label="Home">
        <Logo />
      </NavbarBrand>
      <NavbarTabs aria-label="Main">
        <NavbarTab href="#navbar" current>
          Games
        </NavbarTab>
        <NavbarTab disabled title="Coming soon">
          Tournaments
        </NavbarTab>
        <NavbarTab disabled title="Coming soon">
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
      intro="The bar at the top of a page, in two clusters kept apart: the brand and the tabs on the left (`NavbarStart`), the account on the right (`NavbarEnd`). It draws the bar (`h-navbar`, a border, a glass background) and nothing else: the page pins it with `fixed inset-x-0 top-0 z-40` so that it stays in view while the page scrolls, leaves `pt-navbar` under it, and gives an anchor that lands below it `scroll-mt-navbar`. The tabs leave the bar under `md`, where the account needs the room."
    >
      <Demo
        title="Signed out"
        description="`NavbarTab` marks the page the visitor is in with `current`. A tab for a page that does not exist yet is `disabled`: text only, announced as a link that is off. The links are plain `<a>` (`@pbgo/ui` is framework-free): a page passes its router's link with `asChild`. Sign in is the ghost button and Sign up the primary one."
        className="overflow-hidden p-0"
        code={`<Navbar>
  <NavbarStart>
    <NavbarBrand href="/" aria-label="Home">
      <Logo />
    </NavbarBrand>
    <NavbarTabs aria-label="Main">
      <NavbarTab href="/#games" current>Games</NavbarTab>
      <NavbarTab disabled title="Coming soon">Tournaments</NavbarTab>
      <NavbarTab disabled title="Coming soon">What's New</NavbarTab>
    </NavbarTabs>
  </NavbarStart>
  <NavbarEnd>
    <Button variant="ghost">Sign in</Button>
    <Button>Sign up</Button>
  </NavbarEnd>
</Navbar>

<Navbar className="fixed inset-x-0 top-0 z-40">…</Navbar>`}
      >
        <Navbar>
          <Start />
          <NavbarEnd>
            <Button variant="ghost">Sign in</Button>
            <Button>Sign up</Button>
          </NavbarEnd>
        </Navbar>
      </Demo>

      <Demo
        title="Signed in"
        description="The account is an `Avatar` in place of the two buttons; what it opens is the page's business."
        className="overflow-hidden p-0"
        code={`<NavbarEnd>
  <Avatar>
    <AvatarFallback>AL</AvatarFallback>
  </Avatar>
</NavbarEnd>`}
      >
        <Navbar>
          <Start />
          <NavbarEnd>
            <Avatar>
              <AvatarFallback>AL</AvatarFallback>
            </Avatar>
          </NavbarEnd>
        </Navbar>
      </Demo>
    </Section>
  )
}

export function SearchBars() {
  return (
    <Section
      id="search-bar"
      module="search-bar"
      intro="The big search pill of a page: one field, a button that clears it once there is a text, and the round button that submits it. It only draws the pill. The page owns the text and what it finds, and the filters stay with the list they cut. The field is `text-base` on every screen: a smaller text makes iOS zoom the page in on focus."
    >
      <Demo
        title="Empty and filled"
        description="`SearchBarClear` shows only while there is a text, and the page puts the focus back in the field when it is used. The field and each button need an `aria-label`: the pill shows no label of its own. These forms do nothing when sent (`method=dialog`)."
        className="flex flex-col gap-4"
        code={`<SearchBar aria-label="Search the games">
  <SearchBarInput aria-label="Search a game" placeholder="Search a game" />
  <SearchBarSubmit aria-label="Search" />
</SearchBar>

<SearchBar aria-label="Search the games">
  <SearchBarInput aria-label="Search a game" defaultValue="Hanabi" />
  <SearchBarClear aria-label="Clear the search" />
  <SearchBarSubmit aria-label="Search" />
</SearchBar>`}
      >
        <SearchBar method="dialog" aria-label="Search the games">
          <SearchBarInput aria-label="Search a game" placeholder="Search a game" />
          <SearchBarSubmit aria-label="Search" />
        </SearchBar>
        <SearchBar method="dialog" aria-label="Search the games">
          <SearchBarInput aria-label="Search a game" defaultValue="Hanabi" />
          <SearchBarClear aria-label="Clear the search" />
          <SearchBarSubmit aria-label="Search" />
        </SearchBar>
      </Demo>

      <Demo
        title="Over a header"
        description="On the home the pill is laid over the lower edge of the centred header: a negative top margin of half its height (`-mt-7`) pulls it up into the header, which leaves room for that half under its text."
        className="overflow-hidden p-0"
        code={`<section className="border-b bg-card py-section text-center">…</section>
<div className="relative mx-auto -mt-7 max-w-3xl px-gutter">
  <SearchBar>…</SearchBar>
</div>`}
      >
        <div className="border-b bg-card px-6 pt-12 pb-16 text-center">
          <p className="font-heading text-2xl">Board games online, with friends.</p>
        </div>
        <div className="relative mx-auto -mt-7 mb-10 max-w-xl px-6">
          <SearchBar method="dialog" aria-label="Search the games">
            <SearchBarInput aria-label="Search a game" placeholder="Search a game" />
            <SearchBarSubmit aria-label="Search" />
          </SearchBar>
        </div>
      </Demo>
    </Section>
  )
}
