# Colors

Every colour of a platform screen is one of these tokens. The names are shared with the game layer ([Layers and boundary](../01-guidelines/02-layers-and-boundary.md)), so a component never needs to know which layer it is in.

The palette has these colours and no other:

- the neutral ramp, Tailwind's `neutral` scale with no tint, of which every grey is a step;
- `--destructive` and `--success`, the signal colours: a loss or an error, and a win, worn as a dark tint with the colour itself for the text;
- `--presence-online|playing|inactive|dnd`, worn by a friend's presence dot only;
- `--brand-facebook`, `--brand-twitch` and `--brand-discord`, worn by their sign-in button only;
- `--piece-red|gold|navy|ivory|ink`, worn by the pieces of the home's title only;
- `--crest-*`, worn by the rank crests only.

## Surfaces and actions

`card-foreground`, `popover-foreground`, `secondary-foreground` and `accent-foreground` equal `foreground`; `primary-foreground` equals `background`. The pairs exist so a game skin can change one side of a pair without the other.

```specimen
colors-semantic
```

## Secondary text, lines and focus

Borders and field outlines are translucent white, so they follow whatever surface they sit on.

```specimen
colors-lines
```

## The neutral ramp

How the tokens above are built. A component never uses `bg-neutral-*` (a test rejects it): it uses the token, so a game skin can change what the token means.

The ramp has no tint at all and is a little darker than Tailwind's in its darkest steps, so that the page is a true black. `theme.test.ts` keeps it that way, and `PLATFORM_THEME_COLOR` (`@pbgo/ui/theme`) copies the page's black for the browser.

```specimen
colors-neutral-ramp
```

## The one grey

The platform has one grey for every container: `--card`, which `--popover` equals. It is not the black of the page (`--background`). A step lighter, `--card-bar`, is for what is read before the rest: the glass of the search bar, and a panel raised beside a list. What floats over the page keeps most of this grey and blurs what is behind it: see [Glass](06-glass.md).
