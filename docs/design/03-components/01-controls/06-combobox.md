# Combobox

Module: `@pbgo/ui/platform/combobox`

A list of options with a search field above it, for more options than chips can hold, such as the categories of the games. An option is a name and, optionally, an icon at the start of its row; the check of a pick is at the other end. Typing keeps the options that hold the text, whatever the case and the accents. Any number can be picked, so the list stays open.

It draws nothing around itself: put it in a [`Popover`](../03-overlays/03-popover.md) with no padding of its own (`p-0`), which gives it its title, its Clear button and its place.

## In a popover

Open the panel and type to filter.

```specimen
combobox-in-a-popover
```

- An option can have a `label` apart from its `value` (a slug and its title) and a small `cover`; `max` limits the picks (1 makes a single choice). [Search select](14-search-select.md) and [multi select](15-multi-select.md) are made of it.
- The field has the focus the moment the panel opens, except on a screen that is touched, where the keyboard would hide the list.
- The arrow keys move along the list without leaving the field; Enter or a click picks or unpicks.
- The list has no scrollbar and scrolls all the same: a row cut by its bottom edge says there is more.
