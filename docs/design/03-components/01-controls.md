# Controls

What a visitor presses, types in or picks: buttons, badges, fields, checkboxes and switches, selects, comboboxes, sliders, meters, tabs, toggle groups and collapsibles.

## Button

Module: `@pbgo/ui/platform/button`

Every action is a `Button`. The variant says how much an action weighs, the size how dense its surroundings are. It is rounded by the control step (smaller for the small sizes, see [Radius](../02-foundations.md#radius)) and set in one weight.

### Button variants

`default` is the one main action of a screen, `outline` and `secondary` the others. `ghost` lives in toolbars, `destructive` is for what cannot be undone, `link` sits inside a sentence.

```specimen
button-variants
```

### Sizes

Use `sm` and `xs` inside dense UI (tables, toolbars, the gamemaster), `lg` for a hero action and `xl` for the one or two buttons that a page is for.

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

## Badge

Module: `@pbgo/ui/platform/badge`

A short label: a status, a count, a category. Never an action; use a `Button` for that. `notification` is the count of what waits for someone (messages not read, requests to answer), solid red. `destructive` and `success` are the signal colours as a dark tint: a loss and a win.

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

Text entry is `Input` and `Textarea`. In a form, wrap each in a `Field` with its label, help and error. `InputGroup` adds an icon, a prefix or a button to the edge of an input. Inputs are `text-base` on a phone, so that iOS does not zoom in on focus.

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

Two sizes.

```specimen
switch-states
```

## Select

Module: `@pbgo/ui/platform/select`

A choice among a handful of options, in a popover that opens over the trigger. For two options prefer a `Switch`; for many, a search.

### Default and small

Groups take a `SelectLabel`; `SelectSeparator` splits them. The trigger comes in `default` and `sm`.

```specimen
select-default-and-small
```

## Combobox

Module: `@pbgo/ui/platform/combobox`

A list of options with a search field above it, for more options than chips can hold, such as the categories of the games. An option is a name and, optionally, an icon at the start of its row; the check of a pick is at the other end. Typing keeps the options that hold the text, whatever the case and the accents. Any number can be picked, so the list stays open.

It draws nothing around itself: put it in a [`Popover`](03-overlays.md#popover) with no padding of its own (`p-0`), which gives it its title, its Clear button and its place.

### In a popover

Open the panel and type to filter.

```specimen
combobox-in-a-popover
```

- The field has the focus the moment the panel opens, except on a screen that is touched, where the keyboard would hide the list.
- The arrow keys move along the list without leaving the field; Enter or a click picks or unpicks.
- The list has no scrollbar and scrolls all the same: a row cut by its bottom edge says there is more.

## Slider

Module: `@pbgo/ui/platform/slider`

A slider for a value or a range along a scale: one thumb, or two for a range, a track that fills between them and, for a few stops, a dot at each.

It is Radix's `Slider` with one change: the thumb has no size of its own, so its centre is exactly where the fill and the pointer put it, and the handle is drawn around that centre. The handles stick out of the track by half their width at each end, so leave that room around the slider (`mx-1`).

### One thumb

The fill runs from the start to the thumb.

```specimen
slider-one-thumb
```

- `ticks` draws a dot at each step, or at the values you list.
- A screen reader hears the number of the thumb; `valueText` says what it stands for, and `thumbLabels` what each thumb is.

### A range

Two thumbs light what is between them. `minStepsBetweenThumbs` keeps them from meeting.

```specimen
slider-a-range
```

### Disabled slider

`disabled` is Radix's. A slider has no "untouched" state: it always shows what it is set to.

```specimen
slider-disabled
```

## Meter

Module: `@pbgo/ui/platform/meter`

A scale of a few levels drawn as bars of the same height, filled from the first bar up to the level pressed. Each bar is a button (`aria-pressed` on the picked level, and a label saying what it stands for), so the keyboard and a screen reader get what a pointer gets. Pressing the picked level again clears it, unless the scale is not `clearable`.

### Levels

With a mouse, the bars up to the pointer light up faintly before the press. `levels` is the number of bars.

```specimen
meter-levels
```

### Never empty

`clearable={false}` keeps the picked level when it is pressed again, for a scale that always has one.

```specimen
meter-never-empty
```

## Tabs

Module: `@pbgo/ui/platform/tabs`

Switches between panels of the same page without leaving it. The list comes as a filled list (`default`) or as an underlined row (`line`), horizontal or vertical.

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

A set of chips to pick from, for a short list of choices that all stay in view. `single` keeps one chip picked, `multiple` any number. The arrow keys move between the chips, and the group is one stop of the Tab key.

### Single and multiple

A picked chip turns primary. In a `single` group a second click on the picked chip unpicks it, and the value then reads as an empty string. Name each group with an `aria-label`.

```specimen
toggle-group-single-and-multiple
```

### Disabled chips

A chip, or the whole group, can be `disabled`: it is dimmed and skipped by the keyboard.

```specimen
toggle-group-disabled
```

### Segmented

`variant="segmented"` puts the chips in one container, as the tabs of a tab list are, with a primary thumb that glides to the picked chip (`SPRING_TRAVEL`; it jumps when less motion is asked for). For a choice of a few words that a form is about, such as a speed. A chip that should be narrower, an icon alone, is `fit`; its name is then for a screen reader and the pointer (`aria-label`, `title`).

```specimen
toggle-group-segmented
```

## Collapsible

Module: `@pbgo/ui/platform/collapsible`

A block that unrolls: a trigger, and what it shows. It draws nothing of its own: the page gives the trigger its look, and `asChild` gives the trigger's behaviour (`aria-expanded`, `aria-controls`, `data-state`) to the element it draws. The block keeps its own state, or the page does (`open`, `onOpenChange`). What is closed is not in the page: a screen reader does not read it and the keyboard does not reach it.

### Open and closed

```specimen
collapsible-open-and-closed
```
