# Dialog

Module: `@pbgo/ui/platform/dialog`

A modal that interrupts the page for one piece of content. It traps focus and closes on Escape and on a click outside. The title and the description name it.

```specimen
dialog-default
```

## Scroll lock

A modal overlay (a menu, a select, a dialog) locks the page's scroll, and `react-remove-scroll` would add a margin to the body that makes whatever is fixed, the navbar, jump. The page keeps the place of its scrollbar instead: `html.platform` has `scrollbar-gutter: stable`, and the lock's margin is taken off the body (`html.platform body[data-scroll-locked]`, in `platform.css`). `platform.test.ts` keeps both rules.
