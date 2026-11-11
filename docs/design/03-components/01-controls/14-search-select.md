# Search select

Module: `@pbgo/ui/platform/search-select`

A choice among many options, with a search field: a [select](05-select.md) whose list is too long to scroll, such as the countries. It looks like a select and opens a [popover](../03-overlays/03-popover.md) that holds a [combobox](06-combobox.md) as a single choice.

```specimen
search-select
```

- Typing keeps the options that hold the text, whatever the case and the accents. A pick closes the panel.
- `clearLabel` adds a button at the top of the panel that takes the choice away; without it the choice stays once made.
- An option is a `value`, the `label` that is shown and compared, and, if it wants one, an icon or a cover.
- The panel is modal, so its list scrolls with the wheel inside a [dialog](../03-overlays/01-dialog.md) too.
