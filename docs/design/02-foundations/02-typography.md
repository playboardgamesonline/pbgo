# Typography

Geist Sans, a variable font, in one weight. Line-heights and letter-spacing are slightly tight. Sizes are Tailwind's `text-*`; the platform changes their line-heights, not their sizes.

## Scale

Each sample is measured on this page.

```specimen
type-scale
```

## One weight

Everything is semibold. `font-normal`, `font-medium`, `font-semibold` and `font-bold` all resolve to it, so a platform component never writes a `font-*` weight class.

```specimen
type-weights
```

Three things set a weight of their own: the finest print (`fine-print`, `font-regular`), the title of the home and a person's name at the head of a profile (`display-title`, `font-strong`), and the display faces of the logo's lettering (`display-*` in `platform.css`, the one weight each font is loaded in).

## Geist

The typeface, in the platform's weight and spacing.

```specimen
type-geist
```

## Tokens

The variables that set the type, with the value each has on this page.

```specimen
token-table
--font-body | font-sans | Text. Geist on the platform; a game skin sets its own.
--font-title | font-heading | Headings and card titles. The body font on the platform.
--tracking-body | | Letter-spacing of the page, set on `.platform`.
--tracking-tight | tracking-tight | Letter-spacing of `h1` to `h4`.
--text-display | text-display | The size of the home's title. It sets no line-height: `display-title` does.
--text-page-title | text-page-title | The size of the title of a page that lists something. It sets no line-height: `page-title` does.
--font-weight-strong | font-strong | The one weight heavier than the platform's.
--tracking-display | | Letter-spacing of the large titles, tighter than `--tracking-tight`.
```

## Monospace

`font-mono` is for code and token names only, as on this page. Add `tracking-normal` next to it: the platform's negative letter-spacing cramps a monospace.

```specimen
type-monospace
```
