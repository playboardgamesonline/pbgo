# Spacing and layout

Spacing is Tailwind's own scale (`p-4`, `gap-6`). The platform adds only what a whole page needs: the side gutter, the rhythm between sections, and two widths.

```specimen
token-table
--gutter | px-gutter | Side padding of a page; it widens at the larger breakpoints.
--section | py-section | Vertical space between the sections of a page (`pb-section` between two).
--container-page | max-w-page | Width of a page that keeps a limit on a wide screen. The hub's lists of games take the whole window instead.
--container-reading | max-w-reading | Width of running text, so a line stays readable.
```

## Gutter

The page content is inset by `px-gutter` on both sides, and the inset widens at the larger breakpoints.

```specimen
layout-gutter
```

## Widths

`max-w-page` caps a page, `max-w-reading` a block of text inside it.

```specimen
layout-widths
```
