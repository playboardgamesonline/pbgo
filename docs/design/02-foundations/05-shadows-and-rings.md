# Shadows and rings

On black a shadow barely shows, so most depth comes from surface steps (`background`, `card`, `secondary`). Three shadows exist for the three heights of a surface: `shadow-surface`, `shadow-float` and `shadow-overlay`.

## Shadows

```specimen
depth-shadows
```

## Rings

A section of a page has no outline: a card, a block of figures or a panel of a list is a fill (`bg-card`) one step above the page, and that step alone sets it apart. A hairline ring (`ring-1 ring-foreground/10`) is for what has to be seen against what is behind it: what floats over the page (a popover, a menu, a dialog) and what lights up when it is pressed or is a picture (a game card). The focus ring is `ring` plus a `border-ring` edge; components add it on `focus-visible`.

```specimen
depth-rings
```

## Scrim

`bg-scrim` dims the page behind a dialog. Game art is never dimmed with it.

```specimen
depth-scrim
```
