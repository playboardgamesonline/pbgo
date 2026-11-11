# Radius

One family of corners, and one step for each role. One base, `--radius`, and every step of the scale (`rounded-*`) is a multiple of it, so a game skin that sets `--radius` rescales every corner at once. Each box below is measured on this page.

```specimen
radius-scale
```

```specimen
token-table
--radius | | The base of the scale, on `.platform`. A game sets its own on `:root`.
--corner-smoothing | | The curve of every rounded corner (`corner-shape: superellipse()`), on `.platform`.
```

## Which radius

A box takes the step of its role, whatever its size.

| Role | Utility | Used by |
| --- | --- | --- |
| Surface | `rounded-4xl` | A box that holds other boxes: menu, popover, select, dialog, panels (friends, social, chat), card, game card, banner, cookie banner, login card, an empty state |
| Bar | `rounded-3xl` | The home's search bar |
| Row | `rounded-2xl` | A row of a list and a list of rows (a table), an island, an alert, a menu item |
| Control | `rounded-xl` | Button, field (input, text area, select trigger, input group), tab bar, a tab of the social panel, a chat bubble |
| Small control | `rounded-lg` | Small button, toggle, a tab in a tab bar, the buttons and tabs inside a navbar island |
| Chip | `rounded-md` | Extra small button, key cap |
| Tag | `rounded-sm` | Badge, checkbox |
| Tile | `rounded-tile` | The square picture of a game in a row, a cover, a favourite: one shape at any size |
| Inside | `rounded-nested` | A box in a padded container: the container's corner less its padding |
| Circle | `rounded-full` | The picture of a person (`Avatar`) and its dot; the track and the thumb of a switch, a slider and a progress bar; the cross that takes a game out of a search |

- A surface is the roundest box: nothing is rounder than `rounded-4xl`. A bar is `rounded-3xl`, since at `rounded-4xl` it would be a capsule.
- A list is as round as its rows: a table, or a stack of rows, takes the row step and never the surface's.
- A tile is `rounded-tile` and never a step of the scale: a share of its side, so a small tile is not rounder than a large one.
- Only the picture of a person is a circle, besides the shapes that are one by nature (last row). A game, its icon and its card are rounded like anything else.
- Nothing is a capsule: no corner reaches half the height of its box. The one exception is the highlight of a menu row, which shows under the pointer only and keeps `rounded-2xl`.
- Never write an arbitrary radius (`rounded-[10px]`): `platform.test.ts` rejects it, keeps `rounded-full` for the circles and checks that every corner is smoothed.

## Nested corners

A box in a padded container takes the container's corner less the padding, never more: outer = inner + padding. With the same corner on both, the gap between the two widens at the corner.

- The container says its corner and its padding once, in a `nest-*` class that names the step and the padding: it sets both and publishes the pair (`nest-4xl/6`: the corner of `rounded-4xl` and the padding of `p-6`).
- A box in it takes `rounded-nested`, which reads the pair. Its corner is never picked by eye, and follows the container when the container changes.
- Where the sides have different paddings, give the smaller to `nest-*` and set the others after it (`nest-2xl/3.5 px-4`).
- Never put `rounded-*` or `p-*` next to a `nest-*`: it sets both.
- One level. A box that is a padded container in its turn says its own pair.
- Outside a `nest-*`, `rounded-nested` has nothing to read and the corner stays square, in plain sight.

```specimen
radius-nesting
```

## Tiles

A square tile has the same shape at any size, whatever it sits in. A tile in a padded container still keeps to the nested rule: it is never rounder than the container's corner less the padding.

```specimen
radius-tile
```

## Corner smoothing

Every corner is a superellipse, as iOS draws its continuous corners (`corner-shape: superellipse(var(--corner-smoothing))` in Chromium; elsewhere the plain arc stays). Each box below has the same `rounded-3xl`; only the exponent changes. A `rounded-full` always keeps its arc.

```specimen
corner-smoothing
```
