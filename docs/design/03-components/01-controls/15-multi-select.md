# Multi select

Module: `@pbgo/ui/platform/multi-select`

A limited multiple choice. What is picked stands in a row of chips, each with its small cover and a button that puts it back; a counter says how many are picked of how many can be; a button opens a panel with a search field to pick more.

```specimen
multi-select
```

- `max` is the limit. The pick that reaches it closes the panel, and the button is off: there is no one more.
- The chips keep the order in which the options were picked.
- The panel is a [combobox](06-combobox.md) with `max`, in a modal [popover](../03-overlays/03-popover.md).
