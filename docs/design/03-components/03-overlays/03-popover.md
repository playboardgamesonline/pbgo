# Popover

Module: `@pbgo/ui/platform/popover`

A panel that opens on its trigger and holds a few controls, where a menu is too thin and a dialog too heavy. It closes on Escape and on a click outside and hands the focus back to its trigger. Like the menus it is glass: see [Glass, and where the blur lives](#glass-and-where-the-blur-lives) below.

## A header and chips

- `PopoverHeader` puts the title on the left and what acts on the whole panel, a ghost Clear button, on the right.
- The panel scrolls when the screen is too short for it; give `PopoverContent` another width with `className`.
- Name it with an `aria-label`, or with an `aria-labelledby` that points at its title.
- What the pick does, and whether the panel closes after it, belongs to the page (`open` and `onOpenChange`).

```specimen
popover-header-and-chips
```

## Glass, and where the blur lives

The panels of a [select](../01-controls/05-select.md), a [dropdown menu](02-dropdown-menu.md) and a popover are glass. Each wears the `glass` utility (see [Glass](../../02-foundations/06-glass.md)) and carries its blur on the panel element itself, never on a `::before`: in Chromium a descendant with a blend mode, like the `Avatar` ring, makes the panel an isolated group, and a pseudo-element backdrop then blurs nothing.
