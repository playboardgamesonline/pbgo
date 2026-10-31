# Overlays

What appears over the page: dialogs, sheets, menus, popovers, tooltips, toasts and the cookie banner.

## Dialog

Module: `@pbgo/ui/platform/dialog`

A modal that interrupts the page for one decision or one short form. It traps focus, closes on Escape and on a click outside, and carries the `platform` class itself since it renders in a portal.

### Confirmation and form

The title and description name the decision. Footer buttons go from least to most committing, the destructive one last. `DialogFooter` adds a Close button with `showCloseButton`.

```specimen
dialog-confirmation-and-form
```

## Sheet

Module: `@pbgo/ui/platform/sheet`

A panel that slides in from an edge: a menu on a phone, a settings drawer, a long form. Same behaviour as a dialog, but its panel travels, so it uses `duration-slow` (see [Motion](../02-foundations.md#motion)) where a dialog uses `duration-fast`.

### Four sides

```specimen
sheet-four-sides
```

## Dropdown menu

Module: `@pbgo/ui/platform/dropdown-menu`

A list of actions behind one button. Rows can carry an icon, a shortcut, a check or a radio; groups take a label and are split by separators; a row can open a sub-menu.

Its panel is glass, like a popover's and a select's: see [Glass, and where the blur lives](#glass-and-where-the-blur-lives).

### Every kind of row

The checked state belongs to the caller: the component only draws it.

```specimen
dropdown-menu-every-kind-of-row
```

## Popover

Module: `@pbgo/ui/platform/popover`

A panel that opens on its trigger and holds a few controls, where a menu is too thin and a dialog too heavy: each filter of the [search bar](02-navigation.md#search-bar) opens one.

It closes on Escape and on a click outside, hands the focus back to its trigger, and carries the `platform` class itself since it renders in a portal, above the fixed navbar. Like the menus it is glass: see [Glass, and where the blur lives](#glass-and-where-the-blur-lives) below.

### A header and chips

- `PopoverHeader` puts the title on the left and what acts on the whole panel, a ghost Clear button, on the right.
- The panel is `w-72` and scrolls when the screen is too short for it; give `PopoverContent` another width with `className`.
- Name it with an `aria-label`, or with an `aria-labelledby` that points at its title.
- What the pick does, and whether the panel closes after it, belongs to the page (`open` and `onOpenChange`).

```specimen
popover-header-and-chips
```

### Glass, and where the blur lives

The panels of a [select](01-controls.md#select), a [dropdown menu](#dropdown-menu) and a popover are glass: translucent, and blurring what is behind them. Each wears the `glass` utility (see [Glass](../02-foundations.md#glass)) and carries its blur on the panel element itself, which is the `backdrop-filter` of the utility, never on a `::before`.

The reason: in Chromium, a descendant with a blend mode makes the panel an isolated group, and a pseudo-element backdrop then blurs nothing, so the page shows through the list, sharp. The `Avatar` ring is such a descendant (`mix-blend-lighten`).

The game switcher of the gamemaster, a select with an `Avatar` in each of its rows, is the live check of this rule.

## Tooltip

Module: `@pbgo/ui/platform/tooltip`

A one-line hint on hover and focus, for an icon button or a truncated label. It never holds anything the user must read or click. `TooltipProvider` goes once above the tooltips.

### Sides, and on an icon button

```specimen
tooltip-sides-and-icon-button
```

## Toast

Module: `@pbgo/ui/platform/sonner`

A message that confirms something happened and fades by itself. Call `toast()` from anywhere.

The `Toaster` is mounted once per layout:

- the gamemaster layout mounts this one;
- the games mount their own style (`AppToaster` in `packages/core/components/toaster.tsx`);
- the specimen below mounts its own.

### Kinds

Keep a toast to a few words. `toast.promise` follows a request from loading to done.

```specimen
toast-kinds
```

## Cookie banner

Module: `@pbgo/ui/platform/cookie-banner`

The question about statistics and recordings: a wide card that floats at the bottom of the screen, centred (`max-w-4xl`), with a title and a sentence that ends with a link to the policy, and on the other side two big buttons, Reject optional (`ghost`) and Accept all.

The buttons are the same size and the same shape, side by side, so refusing is as easy to hit as accepting. The card follows the width of the screen:

- from `lg` it is a bar, and the buttons are 3.5rem high (`h-14`), centred on it;
- under `lg` the buttons are below the words, 3rem high (`h-12`);
- on a phone they share the width of the card.

The words and the answers come from the caller: `@pbgo/analytics` picks the language and keeps the stored answer. The banner carries the `platform` class itself, since it also sits over a game page.

### Room for the card

The card never sits over the page. Its caller measures the box around it, margin included, and makes the room: `@pbgo/analytics` publishes the height of that box as `--consent-h` on `<body>`, so the page ends above the card. A screen that fills the viewport subtracts the variable, `h-[calc(100dvh-var(--consent-h,0px))]`. The full rule is in [Room for the cookie banner](../01-guidelines.md#room-for-the-cookie-banner).

The specimens below put the banner on a stand-in page. They pin it with `absolute` and make the room on the stand-in page itself, where a real page pins it with `fixed` and makes it on `<body>`.

### First visit

No close button: the banner stays until the visitor answers. Try either button, and watch the button at the bottom of the stand-in page: it rises above the card and drops back when the card closes.

```specimen
cookie-banner-first-visit
```

### Reopened from the Cookies link

A visitor who already answered can change their mind from the cookies section of the legal notice, from the footer of a game's home page or from a game's settings menu. The card then has a close button at its top right corner, closes on Escape and takes the focus, and closing it keeps the answer. Press Cookies in the specimen to open it.

```specimen
cookie-banner-reopened
```
