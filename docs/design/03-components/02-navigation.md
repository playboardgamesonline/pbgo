# Navigation and brand

The bars that take a visitor from page to page, and the mark of the brand, the logo. The pieces here are hand-written for the platform, not taken from shadcn.

## Logo

Module: `@pbgo/ui/platform/logo`

The mark of the platform, PB over GO, an inline SVG on `currentColor`: it takes the colour of the text around it and needs no file.

### Sizes and colour

Size it with a height and colour it with a text colour. It is hidden from screen readers, so a link around it carries the name (`aria-label`); a logo that stands alone takes a `title`.

```specimen
logo-sizes
```

## Navbar

Module: `@pbgo/ui/platform/navbar`

The top of a page: two glass islands over a transparent bar, the brand and the tabs on the left (`NavbarStart`), the account on the right (`NavbarEnd`). The page shows through the bar and the pointer goes through it.

### Parts of the navbar

| Part | What it is |
| --- | --- |
| `Navbar` | The bar: transparent |
| `NavbarStart` | The left island: the brand, then the tabs |
| `NavbarEnd` | The right island: the account |
| `NavbarBack` | The way back, in an island of its own at the left of the first one |
| `NavbarBrand` | The home's button around the `Logo` |
| `NavbarTabs` | The tabs, next to the brand in the same island |
| `NavbarTab` | One tab, a link. `current` marks the page the visitor is in |
| `NavbarSeparator` | A hairline between two groups of tabs |

### On the home, signed out

On the home the logo is `current` and no tab is. `current` puts the bar's fill (`bg-muted`) behind the item, the same for the logo and for a tab; on any other page the logo is as quiet as a tab. Sign in is the ghost button and `Let's play` the primary one, both `lg`.

```specimen
navbar-signed-out
```

### On a tab's page, signed in

On the page of a tab, here Games, the tab has the fill and the logo is quiet. The account is an [`Avatar`](04-surfaces.md#avatar) in place of the two buttons; what it opens is the page's business.

```specimen
navbar-signed-in
```

### Moving between the items

The fill behind the current item is one element for the whole bar (`layoutId` of `motion/react`): when the current item changes it glides to the next with `SPRING_TRAVEL` instead of jumping. It can only glide if the bar stays mounted from one page to the next, which is why the hub's layout mounts it once. `Navbar` mounts a `MotionConfig reducedMotion=user` (less motion gets the jump) and a `LayoutGroup` of its own, so two bars on one page do not trade the fill.

```specimen
navbar-moving
```

### The islands

- Each container is a glass island (`border glass shadow-surface`), a rounded square and not a capsule. It takes the pointer back from the bar.
- What an island holds is one step less round, the island's radius less its padding, so the corners stay concentric. `NavbarEnd` makes its buttons that radius too, so the page does not have to remember it.
- The bar spans the window, not `max-w-page`, so the islands sit on its edges.

### Placing the bar

The bar is `fixed` at the top so it stays in view. The page leaves `pt-navbar` under it, or lets the backdrop of its first screen run under the islands. An anchor that lands below it has `scroll-mt-navbar`.

### Tabs and groups

- The tabs leave the first island on a narrow screen, where the account needs the room: only the logo is left.
- `NavbarSeparator` splits the tabs for playing from the ones about the site, which leave the bar sooner, where there is no room for them next to the dock of a signed-in visitor.
- The links are plain `<a>` (`@pbgo/ui` is framework-free): a page passes its router's link with `asChild`.

## Search bar

Module: `@pbgo/ui/platform/search-bar`

The big search bar of a page: one glass bar with the magnifier at its start (the button that sends the search), the field, a button that clears the text and, at its end, a filter that opens a panel (the category). The other filters stand under it in a row of their own (`SearchBarGroup`): a stepper for a number, a slider for a limit, bars for a level, or a button that opens a menu. It only draws the bar and the row; the page owns the text, the picks and what they find.

### Parts of the search bar

| Part | What it draws |
| --- | --- |
| `SearchBar` | The glass bar |
| `SearchBarField` | The text: the magnifier, the input and its clear button |
| `SearchBarSubmit` | The magnifier |
| `SearchBarInput` | The input |
| `SearchBarClear` | The button that empties the field |
| `SearchBarSegment` | An icon and what is picked, in a button that opens a panel or a menu: at the end of the bar, or `boxed` under it |
| `SearchBarFilters` | The row of the other filters, under the bar |
| `SearchBarGroup` | The place of one filter in the row |
| `SearchBarStepper` | A filter that is a number |
| `SearchBarIcon`, `SearchBarValue` | The icon that says what a filter is, and the value written beside it |

### Empty and filled

The field and each button need an `aria-label`: the bar shows no label of its own. `SearchBarClear` empties the field and puts the focus back in it.

```specimen
search-bar-states
```

### With filters

The category is at the end of the bar and the other filters stand under it. These filters filter nothing: they only step, slide, fill, open and search.

```specimen
search-bar-filters
```

### The bar

- It is `rounded-3xl border glass`; what is in it is `rounded-xl` and the magnifier's button `rounded-lg`, the bar's radius less its padding.
- Its glass is a step lighter than the other containers (`--card-bar`), so that it is read first (see [Glass](../02-foundations.md#glass)).
- The magnifier is the button that sends the search (`SearchBarSubmit`, a ghost button); Enter in the field sends it too.

### The field

- The field is small and dim like a placeholder: what is typed has the colour of the placeholder (`text-muted-foreground`).
- The bar draws no ring or border around itself when the field has the focus: the caret says where the text goes.

### The category

At the end of the bar, a `SearchBarSegment`: an icon and what is picked, dimmed while nothing is (`idle`), in a button without a frame. Wrap it in a `PopoverTrigger asChild`, which gives it `aria-expanded`, which paints it while the panel is open. No label is drawn (a screen reader hears the `label`). The segment is always drawn: with no category yet its panel says so.

Its panel is a [Popover](03-overlays.md#popover) that holds a [Combobox](01-controls.md#combobox) (`@pbgo/ui/platform/combobox`): a list with a search field above it. Each option has its icon at the start of its row and the check of a pick at the other end. The panel has no padding of its own (`p-0`) and opens to the end of the bar.

### The picks

With nothing picked, the segment leaves out its value on a narrow bar, so that the field keeps its room. With `picks` (things that each have a name and an icon, the categories) the segment draws them as grey tags in place of its own icon and value, then how many more there are (`+2`). A tag is lighter under the pointer and while the panel is open; the segment behind it is never filled. On a narrow bar the tags are icons alone, and fewer.

### The filters under the bar

The other filters stand under the bar in `SearchBarFilters`, centred on a line of their own that wraps when the room runs out. Name the row with an `aria-label`. Each filter is in a `SearchBarGroup`, which is only a place: no background, no outline, no shadow. Only the age, a button that opens a menu, goes grey under the pointer.

| Filter | Control | Icon |
| --- | --- | --- |
| Players | `SearchBarStepper` | `UserMultipleIcon` |
| Duration | `Slider` with one thumb | `HourglassIcon` |
| Complexity | `Meter` | `Brain02Icon` |
| Age | `SearchBarSegment` that is `boxed` | `ChildIcon` |

The icons are the ones the game's card and page use, and `GridViewIcon` is the category's. The starting values are those of `@pbgo/catalog/filter`.

- Players: a minus button, the number with its icon, a plus button. No label.
- Duration: the hourglass (`SearchBarIcon`), the limit written after it (`SearchBarValue`, with no unit word since the hourglass says it), then a one-thumb [`Slider`](01-controls.md#slider) with no dots, only the fill.
- Complexity: the icon and a [`Meter`](01-controls.md#meter) with nothing written beside it. It is not `clearable`: there is always a level.
- Age: a `boxed` `SearchBarSegment` that opens a [`DropdownMenu`](03-overlays.md#dropdown-menu) as wide as the button. It always has one age picked.

The filters are always at work, so nothing in the row is filled in or outlined to say what is picked: a filter shows what it is set to. A stepper's number is plain text and never empty; each press moves it one place along its options (`stepOption`), and the buttons stop at the first and the last.
