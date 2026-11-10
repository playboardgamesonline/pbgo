# Radius

One family of corners: the taller the box, the rounder its corner, up to `rounded-4xl` for a surface. One base, `--radius`, and every step of the scale (`rounded-*`) is a multiple of it, so a game skin that sets `--radius` rescales every corner at once. Each box below is measured on this page.

```specimen
radius-scale
```

```specimen
token-table
--radius | | The base of the scale, on `.platform`. A game sets its own on `:root`.
--corner-smoothing | | The curve of every rounded corner (`corner-shape: superellipse()`), on `.platform`.
```

## Which radius

Pick the step by the height of the box: the taller it is, the rounder its corner, and never half its height, so that nothing is a capsule.

| Role | Utility | Used by |
| --- | --- | --- |
| Surface | `rounded-4xl` | Menu, popover, select, dialog, panels (friends, social, chat), card, game card and its picture, cookie banner, login card, an empty state |
| Bar | `rounded-3xl` | The home's search bar |
| Large control, island | `rounded-2xl` | Navbar island, tab bar of the social panel, a row of a list, a menu item, an alert |
| Control | `rounded-xl` | Button, field (input, text area, select trigger, input group), tab bar, a tab of the social panel, a chat bubble |
| Small control | `rounded-lg` | Small button, toggle, a tab in a tab bar, the buttons and tabs inside a navbar island |
| Chip | `rounded-md` | Extra small button, key cap, a small game icon |
| Tag | `rounded-sm` | Badge, checkbox |
| Circle | `rounded-full` | The picture of a person (`Avatar`) and its dot; the track and the thumb of a switch, a slider and a progress bar; the cross that takes a game out of a search |

- `rounded-4xl` is the largest step and nothing is rounder. A bar, the home's search bar, is `rounded-3xl`, since at `rounded-4xl` it would be a capsule.
- The one exception to "never half" is the highlight of a menu row, which shows under the pointer only and keeps `rounded-2xl`.
- Only the picture of a person is a circle, besides the shapes that are one by nature (last row). A game, its icon and its card are rounded like anything else.
- What sits in a padded container takes the container's radius less its padding, as near as a step allows: the buttons in a navbar island are `rounded-lg`, the category button in the search bar `rounded-xl`.
- Never write an arbitrary radius (`rounded-[10px]`): `platform.test.ts` rejects it, keeps `rounded-full` for the circles and checks that every corner is smoothed.

## Corner smoothing

Every corner is a superellipse, as iOS draws its continuous corners (`corner-shape: superellipse(var(--corner-smoothing))` in Chromium; elsewhere the plain arc stays). Each box below has the same `rounded-3xl`; only the exponent changes. A `rounded-full` always keeps its arc.

```specimen
corner-smoothing
```
