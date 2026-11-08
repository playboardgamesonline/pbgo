# Search bar

Module: `@pbgo/ui/platform/search-bar`

The big search bar of a page: one glass bar with the magnifier at its start (the button that sends the search), the field, a button that clears the text and, at its end, a filter that opens a panel (the category). The other filters stand under it in a row of their own (`SearchBarGroup`): a stepper for a number, a slider for a limit, bars for a level, or a button that opens a menu. It only draws the bar and the row; the page owns the text, the picks and what they find.

## Parts of the search bar

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

## Empty and filled

The field and each button need an `aria-label`: the bar shows no label of its own. `SearchBarClear` empties the field and puts the focus back in it.

```specimen
search-bar-states
```

## With filters

The category is at the end of the bar and the other filters stand under it. These filters filter nothing: they only step, slide, fill, open and search.

```specimen
search-bar-filters
```

## The bar

- It is `rounded-3xl border glass`; what is in it is `rounded-xl` and the magnifier's button `rounded-lg`, the bar's radius less its padding.
- Its glass is a step lighter than the other containers (`--card-bar`), so that it is read first (see [Glass](../../02-foundations/06-glass.md)).
- The magnifier is the button that sends the search (`SearchBarSubmit`, a ghost button); Enter in the field sends it too.

## The field

- The field is small and dim like a placeholder: what is typed has the colour of the placeholder (`text-muted-foreground`).
- The bar draws no ring or border around itself when the field has the focus: the caret says where the text goes.

## The category

At the end of the bar, a `SearchBarSegment`: an icon and what is picked, dimmed while nothing is (`idle`), in a button without a frame. Wrap it in a `PopoverTrigger asChild`, which gives it `aria-expanded`, which paints it while the panel is open. No label is drawn (a screen reader hears the `label`). The segment is always drawn: with no category yet its panel says so.

Its panel is a [Popover](../03-overlays/03-popover.md) that holds a [Combobox](../01-controls/06-combobox.md) (`@pbgo/ui/platform/combobox`): a list with a search field above it. Each option has its icon at the start of its row and the check of a pick at the other end. The panel has no padding of its own (`p-0`) and opens to the end of the bar.

## The picks

With nothing picked, the segment leaves out its value on a narrow bar, so that the field keeps its room. With `picks` (things that each have a name and an icon, the categories) the segment draws them as grey tags in place of its own icon and value, then how many more there are (`+2`). A tag is lighter under the pointer and while the panel is open; the segment behind it is never filled. On a narrow bar the tags are icons alone, and fewer.

## The filters under the bar

The other filters stand under the bar in `SearchBarFilters`, centred on a line of their own that wraps when the room runs out. Name the row with an `aria-label`. Each filter is in a `SearchBarGroup`, which is only a place: no background, no outline, no shadow. Only the age, a button that opens a menu, goes grey under the pointer.

| Filter | Control | Icon |
| --- | --- | --- |
| Players | `SearchBarStepper` | `UserMultipleIcon` |
| Duration | `Slider` with one thumb | `HourglassIcon` |
| Complexity | `Meter` | `Brain02Icon` |
| Age | `SearchBarSegment` that is `boxed` | `ChildIcon` |

The icons are the ones the game's card and page use, and `GridViewIcon` is the category's. Each filter starts on its own end of no limit (`@pbgo/catalog/filter`), so nothing is cut until a visitor picks.

- Players: a minus button, the number with its icon, a plus button. No label. It says "Any" until a first press picks a number.
- Duration: the hourglass (`SearchBarIcon`), the limit written after it (`SearchBarValue`, with no unit word since the hourglass says it), then a one-thumb [`Slider`](../01-controls/07-slider.md) with no dots, only the fill.
- Complexity: the icon and a [`Meter`](../01-controls/08-meter.md) with nothing written beside it. It is not `clearable`: there is always a level, all of them filled where it starts.
- Age: a `boxed` `SearchBarSegment` that opens a [`DropdownMenu`](../03-overlays/02-dropdown-menu.md) as wide as the button. It always has one age picked, "All ages" where it starts.

Nothing in the row is filled in or outlined to say what is picked: a filter shows what it is set to. A stepper's value is plain text and never empty ("Any" while nothing is picked); the first press picks a table of four, each press then moves it one place along its options (`stepOption`), the plus button stops at the last, and the minus button goes back to "Any" from the first.
