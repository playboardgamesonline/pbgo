import { Baby01Icon, Clock01Icon, GridViewIcon, UserGroupIcon } from "@hugeicons/core-free-icons"
import { Avatar, AvatarFallback } from "@pbgo/ui/platform/avatar"
import { Button } from "@pbgo/ui/platform/button"
import { DISPLAY_FACES } from "@pbgo/ui/faces"
import { FaceCycle } from "@pbgo/ui/platform/face-cycle"
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
import { Separator } from "@pbgo/ui/platform/separator"
import { ToggleGroup, ToggleGroupItem } from "@pbgo/ui/platform/toggle-group"
import { Wordmark } from "@pbgo/ui/platform/wordmark"
import { FaceRow } from "../_components/face-specimen"
import { NavbarPlayground } from "../_components/navbar-playground"
import { Block, Bullets, Demo, Section } from "../_components/layout"

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

export function Wordmarks() {
  return (
    <Section
      id="wordmark"
      module="wordmark"
      intro="The name of the brand as four big letters, PBGO, as wide as the room it is given: the backdrop of the footer. The letters are set in the faces the logo is drawn in, the P blackletter, the B handwritten, the G pixel and the O script (the display faces, see Face cycle), so it is the logo's own lettering and not Geist. It is low contrast (`fill-secondary`, one step above the page), so it is a drawing behind the page's text and not a title, and it is decorative (`aria-hidden`): the brand is named by the logo and the page's own text. It is SVG text scaled by its viewBox, so it is always the width of its container, and `textLength` pins that width whatever font answers: the letters are spaced out to fill it, never stretched, so nothing moves when the fonts arrive. The ink of the letters is flush with the container's edges, which is why it lines up with the line under it."
    >
      <Demo
        title="In the footer"
        description="The footer of the hub's pages: the wordmark, a `Separator`, then the copyright and who built the site on the left, the legal pages on the right, and what the site is not, centred and a little lighter, under them. The wordmark takes the width of its parent and its height follows, so it keeps its proportions from a phone to a desktop."
        code={`<footer className="mx-auto w-full max-w-page px-gutter pb-10">
  <Wordmark />
  <Separator className="mt-6 mb-6" />
  <p className="text-sm text-muted-foreground">© 2026 Play Board Games Online · Built by …</p>
</footer>`}
      >
        <Wordmark />
        <Separator className="mt-6 mb-6" />
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 text-sm text-muted-foreground">
          <p>© 2026 Play Board Games Online · Built by oré</p>
          <p>Privacy Policy · Cookie Policy · Terms of Use</p>
        </div>
        <p className="mt-8 text-center text-sm text-foreground/80">
          Unofficial, online adaptation of board games. All rights belong to their authors and the publisher.
        </p>
      </Demo>
    </Section>
  )
}

export function FaceCycles() {
  return (
    <Section
      id="face-cycle"
      module="face-cycle"
      intro="A word of a title set in one of the platform's four display faces, which changes to the next every few seconds: the board games of the home's title, all in capitals, the rest in Geist. The faces are the typefaces the logo's four letters are drawn in, so the brand's own lettering is what turns. It is for a word of a title, from `text-3xl` up, and for nothing else: the capitals of the blackletter and of the script are the hardest to read, and none of the faces is sized for small text."
    >
      <Demo
        title="The title of the home"
        description="The word fades out and the next fades in (`DURATION.slow`, `EASE_STANDARD`), and the rest of its line glides to its new place when the word changes width, since a centred line moves when one of its words does. Wait six seconds, or look at the faces below. The text before and after the word is plain text in the page's face: `before` is `Play`, the word is the child. The home's title is `text-display`, as big as the room it has; this specimen is smaller to fit the column."
        className="bg-linear-to-b from-secondary via-card to-background py-12 text-center"
        code={`<h1 className="font-heading text-display uppercase">
  <FaceCycle before="Play" className="block">board games</FaceCycle>{" "}
  <span className="block">with friends & rivals</span>
</h1>`}
      >
        <p className="font-heading text-4xl leading-tight uppercase sm:text-6xl">
          <FaceCycle before="Play" className="block">
            board games
          </FaceCycle>{" "}
          <span className="block">with friends & rivals</span>
        </p>
      </Demo>

      <Block
        title="The four faces"
        description="Each is a utility of `platform.css` that sets the family, the weight and the size of one typeface, in the order the word goes through them; each font is a Fontsource package imported by the app, in the one weight it is set at. What the browser computed for the sample is printed beside it. The size is a scale of the parent's that gives the face the cap height of Geist's capitals, so a word in a face does not stand taller than the words around it."
      >
        <div className="divide-y rounded-3xl border p-6">
          {DISPLAY_FACES.map((face) => (
            <FaceRow key={face.utility} face={face.utility} letter={face.letter} fontsource={face.fontsource} />
          ))}
        </div>
      </Block>

      <Bullets
        items={[
          "The word is one text in the page, written as it is, whichever face it is in: `before`, the word and `after` read as one sentence for a screen reader and a search engine, and the capitals are CSS (`uppercase` on the title).",
          "A visitor who asks for less motion (`prefers-reduced-motion`) gets no rotation and no glide: the word stays in its first face, the most legible one.",
          "The word has `line-height: 0`, so the lines of the title keep the height of the element's own whichever face it is in, and nothing moves when a font file arrives.",
          "Each face sets its own weight: the platform's 600 on a face that has none would be a fake bold. That is the one place the platform has more than one weight.",
          "A face is swapped in `styles/platform.css` (its utility), in `faces.ts` (its place in the order) and in the app's `globals.css` (its import). Nothing else names a font. The footer's `Wordmark` is set in the same four faces.",
        ]}
      />
    </Section>
  )
}

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
      intro="The top of a page, in two containers kept apart over a transparent bar: the brand and the tabs on the left (`NavbarStart`), the account on the right (`NavbarEnd`). Each container is a glass island (a border, a blur, a light shadow), a rounded square (`rounded-2xl`, not a pill) whose content is one step less round (`rounded-lg`, the island's radius less its padding), and nothing is drawn between them: the page shows through the bar and the pointer goes through it, so the backdrop of the page (the home's hero) shows behind both islands. The bar spans the window, not the width of the page, so the islands sit on its edges. The bar is pinned with `fixed inset-x-0 top-0 z-40` so that it stays in view while the page scrolls; the page leaves `pt-navbar` under it (or lets its backdrop run under it) and gives an anchor that lands below it `scroll-mt-navbar`. The hub's layout mounts the bar once and it reads the address to know what is current, so it stays mounted from one page to the next and the fill behind the current item can glide. The tabs leave the first island under `md`, where the account needs the room."
    >
      <Demo
        title="On the home, signed out"
        description="The logo is the home's button, a square: on the home it is `current`, and no tab is. `current` puts the bar's fill (`bg-muted`) behind the item, the same one for the logo and for a tab, in the same white. On any other page the logo is as quiet as a tab. `NavbarTab` marks the page the visitor is in with `current`. A tab whose page does not exist yet can be `disabled`: text only, announced as a link that is off. The links are plain `<a>` (`@pbgo/ui` is framework-free): a page passes its router's link with `asChild`. Sign in is the ghost button and Sign up the primary one, both of size `lg`, the height of what an island holds, and `rounded-lg` inside the island (`NavbarEnd` does it, a button is a pill elsewhere). The specimens sit on `bg-card`, a little lighter than the page, as the islands sit over the top of the home's hero."
        className="overflow-hidden bg-card p-0"
        code={`<Navbar>
  <NavbarStart>
    <NavbarBrand href="/" aria-label="Home" current>
      <Logo className="h-6" />
    </NavbarBrand>
    <NavbarTabs aria-label="Main">
      <NavbarTab href="/games">Games</NavbarTab>
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
          <Start home />
          <NavbarEnd>
            <Button variant="ghost" size="lg">
              Sign in
            </Button>
            <Button size="lg">Sign up</Button>
          </NavbarEnd>
        </Navbar>
      </Demo>

      <Demo
        title="On a tab's page, signed in"
        description="On the page of a tab, here Games, the tab has the muted fill and the logo is quiet. The account is an `Avatar` in place of the two buttons: at `size-10`, the height of what an island holds, it stays round inside the square container; what it opens is the page's business."
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

      <Demo
        title="Moving between the items"
        description="The current item has the bar's fill behind it, and that fill is one element for the whole bar (`layoutId` of `motion/react`): when the current item changes it glides to the next with a spring (`SPRING_TRAVEL` of `@pbgo/ui/motion`, about a quarter of a second, no overshoot worth seeing) instead of jumping. Click the logo and the tabs. A visitor who asks for less motion gets the jump (`reducedMotion=user` of the `MotionConfig` that `Navbar` mounts). Each bar scopes its own fill, so the specimens above and this one do not trade it."
        className="overflow-hidden bg-card p-0"
        code={`const [current, setCurrent] = useState("home")

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
</Navbar>`}
      >
        <NavbarPlayground />
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
        description="`SearchBarSegments` goes between the field and the button in the markup, with no more than four `SearchBarSegment`. A segment shows what it filters by and what is picked, dimmed while nothing is (`idle`). Wrap it in a `PopoverTrigger asChild`: that gives it `aria-expanded`, which paints it while its panel is open. With segments the bar has two floors at any width: the field and the round button on top, a line, then the filters, in a row when the room is 42rem wide or more (as in the home's hero) and in a 2 × 2 grid under that (as in this column). The segments are `type=button`, so only the field and the round button send the form."
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
        description="On the home the bar is laid over the bottom of the title, in the hero: its top edge sits on the baseline of the last line, so the letters stand on it. `relative` paints it over the text, and a negative top margin pulls it up by the 0.265em that the line keeps under its baseline, (`-mt-title-overlap`, a token that follows the size of the home's title, `text-display`, wherever it is; the specimen below is smaller, with `-mt-2.5` at `text-4xl`). Nothing is drawn behind it, no band and no border: only the backdrop of the page, a neutral that is lighter at the top and fades into the black the content sits on."
        className="overflow-hidden p-0"
        code={`<section className="bg-linear-to-b from-secondary via-card to-background pt-navbar">
  <div className="mx-auto flex max-w-page flex-col items-center px-gutter pt-section pb-12 text-center">
    <h1 className="font-heading text-display uppercase">…</h1>
    <div className="relative -mt-title-overlap w-full max-w-4xl">
      <SearchBar>…</SearchBar>
    </div>
  </div>
</section>`}
      >
        <div className="flex flex-col items-center bg-linear-to-b from-secondary via-card to-background px-6 pt-12 pb-10 text-center">
          <p className="font-heading text-4xl leading-tight uppercase">
            <span className="block">Play board games</span> <span className="block">with friends & rivals</span>
          </p>
          <div className="relative -mt-2.5 w-full max-w-xl">
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
