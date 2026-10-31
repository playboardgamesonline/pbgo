# Controls

What a visitor presses, types in or picks: buttons, badges, fields, checkboxes and switches, selects, comboboxes, sliders, meters, tabs and toggle groups.

## Button

Module: `@pbgo/ui/platform/button`

Every action is a `Button`. The variant says how much an action weighs, the size how dense its surroundings are. Rounded by the control step (`rounded-xl`, smaller for the small sizes, see [Radius](../02-foundations.md#radius)), `text-sm` (`text-xs` for `xs`), one weight.

### Button variants

`default` is the one main action of a screen, `outline` and `secondary` the others. `ghost` lives in toolbars, `destructive` is for what cannot be undone, `link` sits inside a sentence.

```specimen
button-variants
```

### Sizes

`default` is `h-9`. Use `sm` and `xs` inside dense UI (tables, toolbars, the gamemaster), `lg` for a hero action.

```specimen
button-sizes
```

### Icon buttons

Square, one per size. Give each an `aria-label`: there is no text to name it.

```specimen
button-icon-buttons
```

### With an icon

Mark the icon `data-icon="inline-start"` or `inline-end`: the button trims the padding on that side.

```specimen
button-with-an-icon
```

### States, and as a link

A disabled button fades and ignores the pointer. `asChild` gives the button look to the element you pass, here an anchor.

```specimen
button-states-and-as-a-link
```

## Provider button

Module: `@pbgo/ui/platform/provider-button`

The sign-in's buttons, `ProviderButton`: one per provider, side by side in a grid of equal columns (the login card has four, `grid-cols-4 gap-3`), with nothing on them but the provider's small mark (`BrandMark`, 20px, `size-5`). A tile is `h-10`, `rounded-xl` and fills its cell, so it is wider than it is tall (about two to one in the sign-in's row of four). Each is named `Continue with <name>` for a screen reader (`aria-label`) and in a tooltip (`title`).

### A row of four

The order of the sign-in: Facebook, Google, Apple, Discord (`PROVIDERS` of `@pbgo/accounts`). Hover one to see its tooltip; the tile of a brand dims a little under the pointer.

```specimen
provider-button-a-row-of-four
```

### Pending, and off

While a sign-in is on its way, its mark gives way to a spinner (`pending`) and the others are off (`disabled`, half faded, deaf to the pointer): the spinner takes the colour of the tile's text, so it reads on a white tile as on a blue one.

```specimen
provider-button-pending-and-off
```

### Tile colours

Each tile is its brand's where the brand has a colour to give: a token each. Google's and Apple's use the page's own ([Colors](../02-foundations.md#colors)).

| Provider | Tile | Token |
| --- | --- | --- |
| Facebook | the brand's blue, `#1877f2` | `brand-facebook` (`--brand-facebook`) |
| Google | white, with the four colours of its mark | `foreground` |
| Apple | black, outlined since the page is dark | `background` |
| Discord | the brand's blurple, `#5865f2` | `brand-discord` (`--brand-discord`) |

`brand-facebook` and `brand-discord` are the brands' own colours and the only two the platform takes from a brand. Each comes with its utility (`bg-brand-*`).

### Marks

The marks are the brands' own and are never redrawn. `BrandMark`, in `@pbgo/ui/brands`, draws Simple Icons' (CC0) for Facebook, Apple and Discord and, for Google, the four colours of the G that its own sign-in script ships. That file is the one place of the design system where a colour literal is allowed, since the colours of a brand are the brand's.

### Adding a provider

A new provider adds its mark (`@pbgo/ui/brands`), its tile (`@pbgo/ui/platform/provider-button`) and its name (`PROVIDERS` and `PROVIDER_NAMES` of `@pbgo/accounts`). `platform.test.ts` of `@pbgo/ui` checks that each has a mark and a tile.

## Badge

Module: `@pbgo/ui/platform/badge`

A short label: a status, a count, a category. Never an action; for that, use a `Button`. The count of what waits for someone, messages not read and requests to answer, is `notification`: solid red, as Discord's.

### Badge variants

```specimen
badge-variants
```

### With an icon, and as a link

```specimen
badge-with-an-icon-and-as-a-link
```

## Input and fields

Module: `@pbgo/ui/platform/field`, `@pbgo/ui/platform/input`, `@pbgo/ui/platform/textarea`, `@pbgo/ui/platform/input-group`

Text entry is `Input` and `Textarea`. In a form, wrap each in a `Field` with its label, help and error. `InputGroup` adds an icon, a prefix or a button to the edge of an input.

### Input and textarea

Pass `aria-invalid` for the error state: the field turns red and its ring follows.

```specimen
input-and-textarea
```

### Field

`Field` stacks a label, a control, a description and an error, and `FieldGroup` spaces several of them. Set `data-invalid` on the field so its text turns red too.

```specimen
input-field
```

### Input group

The addon sits inside the same rounded frame as the input, so focus and error states cover both.

```specimen
input-group-addons
```

## Checkbox and switch

Module: `@pbgo/ui/platform/checkbox`, `@pbgo/ui/platform/switch`, `@pbgo/ui/platform/label`

A `Checkbox` is one box in a list of options, a `Switch` is a setting that applies at once. Both pair with a `Label`.

### Checkbox

```specimen
checkbox-states
```

### Switch

Two sizes. The thumb is `foreground` when off and `primary-foreground` when on.

```specimen
switch-states
```

## Select

Module: `@pbgo/ui/platform/select`

A choice among a handful of options, in a popover that opens over the trigger. For two options, prefer a `Switch`; for a dozen or more, a search.

### Default and small

Groups take a `SelectLabel`; `SelectSeparator` splits them. The trigger comes in `default` and `sm`.

```specimen
select-default-and-small
```

## Combobox

Module: `@pbgo/ui/platform/combobox`

A list of options with a search field above it, for a panel that has more options than chips can hold: the categories of the games. An option is a name and, if it wants one, an icon at the start of its row; the check of a pick is at the other end.

The rows are rounded like the rows of a menu and 4px from each edge of the panel, and the field has no ring. Typing keeps the options that hold the text, whatever the case and the accents. Any number can be picked, so the list stays open.

It draws nothing around itself: put it in a [`Popover`](03-overlays.md#popover) with no padding of its own (`p-0`), which gives it its title, its Clear button and its place. See [Search bar](02-navigation.md#search-bar) for how the bar uses it.

### In a popover

Open the panel and type `des` or `strat`: the accents do not matter.

```specimen
combobox-in-a-popover
```

- The field has the focus the moment the panel opens, except on a screen that is touched, where the keyboard would hide the list.
- The arrow keys move along the list without leaving the field, Home and End go to its ends, Enter picks or unpicks the option they are on, and so does a click.
- The list has no scrollbar and scrolls all the same: a row cut by its bottom edge says there is more.
- The panel is `w-52`, its header is not padded as much as a panel's (`pt-2 pr-2 pb-1 pl-4`) and the field has a margin of 8px of its own.
- The field is `text-base` on a phone, like every input, so iOS does not zoom in on it.

## Slider

Module: `@pbgo/ui/platform/slider`

A slider for a value or a range along a scale: one thumb, or two for a range, a track that fills between them (from the start with one thumb) and, for a scale of a few stops, a dot on the track at each. It is `touch-none`: a finger drags a thumb instead of scrolling the page.

It is Radix's `Slider` with one change. Radix keeps a thumb inside the slider by shifting it by half its width, which it has to measure, so a thumb drawn at its full size sits somewhere else on the server than in the browser. Here the thumb itself has no size, its centre is exactly where the fill, the dots and the pointer put it, and the handle, a white vertical capsule 8px wide and 20px high, is drawn around that centre.

The handles stick out of the track by half their width at each end, so leave that room around the slider (a margin of `mx-1`). See [Search bar](02-navigation.md#search-bar) for how the bar uses it.

### One thumb

The fill runs from the start to the thumb.

```specimen
slider-one-thumb
```

- `ticks` draws a dot at each step, for a scale of a few stops, where the thumb jumps from one to the next. It can list the values worth a dot instead of marking every step.
- A screen reader hears the number of the thumb; `valueText` says what it stands for, and `thumbLabels` what each thumb is.
- The hub's duration filter is a one-thumb slider on twelve steps: up to 5 minutes, then 10, 15 and so on to 55, and `1h+`, the last step, which is no limit; it has no dots, the track and its fill are enough.

### A range

Two thumbs light what is between them. `minStepsBetweenThumbs` keeps them from meeting.

```specimen
slider-a-range
```

### Disabled slider

`disabled` is Radix's: half opacity, no pointer, no focus. There is no state for a slider that has not been touched: it always shows what it is set to, and a limit that is no limit puts the thumb at the end, with the fill covering the whole track.

```specimen
slider-disabled
```

## Meter

Module: `@pbgo/ui/platform/meter`

A scale of a few levels drawn as bars of the same height that you fill from the first bar up to a level by pressing that bar. The hub uses it for how complex a game is, from light to heavy: the weight BoardGameGeek gives it, from 1 to 5, rounded. See [Search bar](02-navigation.md#search-bar) for how the bar uses it.

Each bar is a button (the level that is picked is `aria-pressed`, and each says in its label what it stands for), so the keyboard and a screen reader get what a pointer gets. Pressing the picked level again clears it, unless the scale is not `clearable`: then it always has a level.

### Levels

With a mouse, the bars up to the pointer light up faintly before the press, so the fill can be seen coming. The bars are all 16px high (`h-4`), and `levels` is the number of bars (five by default).

```specimen
meter-levels
```

### Never empty

`clearable={false}` keeps the level that is picked when it is pressed again, for a scale that always has one: the hub's complexity starts on 3 and never goes below 1.

```specimen
meter-never-empty
```

## Tabs

Module: `@pbgo/ui/platform/tabs`

Switches between panels of the same page without leaving it. The list comes as a filled pill (`default`) or as an underlined row (`line`), horizontal or vertical.

### Default

```specimen
tabs-default
```

### Line

```specimen
tabs-line
```

### Vertical

```specimen
tabs-vertical
```

## Toggle group

Module: `@pbgo/ui/platform/toggle-group`

A set of chips to pick from, for a short list of choices that all stay in view: the Monthly or Annually selector of the pricing page is one (see [Plan card](04-surfaces.md#plan-card)). `single` keeps one chip picked, `multiple` any number. The arrow keys move between the chips, and the whole group is one stop of the Tab key.

### Single and multiple

A chip that is picked turns primary. In a `single` group a second click on the picked chip unpicks it, and the value then reads as an empty string: the page takes that for no pick. Name each group with an `aria-label`, since its chips are only numbers or short words.

```specimen
toggle-group-single-and-multiple
```

### Disabled chips

A chip, or the whole group, can be `disabled`: it is dimmed and skipped by the keyboard.

```specimen
toggle-group-disabled
```
