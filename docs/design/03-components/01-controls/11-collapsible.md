# Collapsible

Module: `@pbgo/ui/platform/collapsible`

A block that unrolls: a trigger, and what it shows. It draws nothing of its own: the page gives the trigger its look, and `asChild` gives the trigger's behaviour (`aria-expanded`, `aria-controls`, `data-state`) to the element it draws. The block keeps its own state, or the page does (`open`, `onOpenChange`). What is closed is not in the page: a screen reader does not read it and the keyboard does not reach it.

## Open and closed

```specimen
collapsible-open-and-closed
```
