# Scrollbars

A scrollbar draws its thumb alone, the part that is grabbed, over whatever is behind it. Its track has no fill and no hairline: a page, a card, a window, a menu or a panel of glass shows through it. The thumb keeps the size and the shape the system gives it.

One rule does it, in `platform.css`: `scrollbar-color` on `.platform` is the thumb token and a transparent track. The property is inherited, so it reaches every scroll area under the page's `<html>` and under the root of a portal (a menu, a select, a dialog, a sheet), which carries the `platform` class too. No component sets it.

```specimen
token-table
--scrollbar-thumb | | The thumb of every scrollbar: the text colour at an opacity, so that it takes the look of what is behind it.
```

## On every surface

A scroll area on each ground of the platform: the page, a card and glass. The system decides when a scrollbar shows, always or only while scrolling: scroll a box if none is drawn.

```specimen
scrollbar-surfaces
```

## Rules

- A component never paints a scrollbar: no `scrollbar-color`, no `::-webkit-scrollbar-track` or `::-webkit-scrollbar-thumb`. `platform.test.ts` rejects them, and keeps the rule above.
- A list that hides its scrollbar sets `[scrollbar-width:none]` on its own element, with `[&::-webkit-scrollbar]:hidden` beside it for the Safari versions that do not know it. A scrollbar that must be narrower sets `scrollbar-width: thin`, as the leaderboard does from `lg`. The thumb keeps its colour either way.
- The page keeps the place of its scrollbar (`scrollbar-gutter: stable` on `html.platform`), so that it does not move when a window opens: see [Scroll lock](../03-components/03-overlays/01-dialog.md#scroll-lock).
