# Overlays

What appears over the page: dialogs, sheets, menus, popovers, tooltips, hover cards, toasts and the cookie banner.

## Dialog

Module: `@pbgo/ui/platform/dialog`

A modal that interrupts the page for one decision or one short form. It traps focus and closes on Escape and on a click outside.

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

A list of actions behind one button. Rows can carry an icon, a shortcut, a check or a radio; groups take a label and are split by separators; a row can open a sub-menu. Its panel is glass, like a popover's and a select's: see [Glass, and where the blur lives](#glass-and-where-the-blur-lives).

### Every kind of row

The checked state belongs to the caller: the component only draws it.

```specimen
dropdown-menu-every-kind-of-row
```

## Popover

Module: `@pbgo/ui/platform/popover`

A panel that opens on its trigger and holds a few controls, where a menu is too thin and a dialog too heavy. It closes on Escape and on a click outside and hands the focus back to its trigger. Like the menus it is glass: see [Glass, and where the blur lives](#glass-and-where-the-blur-lives) below.

### A header and chips

- `PopoverHeader` puts the title on the left and what acts on the whole panel, a ghost Clear button, on the right.
- The panel scrolls when the screen is too short for it; give `PopoverContent` another width with `className`.
- Name it with an `aria-label`, or with an `aria-labelledby` that points at its title.
- What the pick does, and whether the panel closes after it, belongs to the page (`open` and `onOpenChange`).

```specimen
popover-header-and-chips
```

### Glass, and where the blur lives

The panels of a [select](01-controls.md#select), a [dropdown menu](#dropdown-menu) and a popover are glass. Each wears the `glass` utility (see [Glass](../02-foundations.md#glass)) and carries its blur on the panel element itself, never on a `::before`: in Chromium a descendant with a blend mode, like the `Avatar` ring, makes the panel an isolated group, and a pseudo-element backdrop then blurs nothing.

## Scroll lock

A modal overlay (a menu, a select, a dialog, a sheet) locks the page's scroll, and `react-remove-scroll` would add a margin to the body that makes whatever is fixed, the navbar, jump. The page keeps the place of its scrollbar instead: `html.platform` has `scrollbar-gutter: stable`, and the lock's margin is taken off the body (`html.platform body[data-scroll-locked]`, in `platform.css`). `platform.test.ts` keeps both rules.

## Tooltip

Module: `@pbgo/ui/platform/tooltip`

A one-line hint on hover and focus, for an icon button or a truncated label. It never holds anything the user must read or click. `TooltipProvider` goes once above the tooltips.

### Sides, and on an icon button

```specimen
tooltip-sides-and-icon-button
```

## Hover card

Modules: `@pbgo/ui/platform/hover-card`, `@pbgo/ui/platform/user-card`

A card that opens under the pointer when it rests on its trigger, for what a sighted visitor may want to glance at without pressing anything. It is for the pointer alone: a touch has no hover and the keyboard does not reach the trigger, so whatever the card says is also said somewhere a press reaches. `HoverCardTrigger` takes the element the pointer rests on with `asChild`.

### A player's card

`UserCard` is what the picture of a player opens: their nickname and tag, a quiet line when there is something to say, their rank in the game and their record. A seat's picture opens it already (`SeatAvatar`).

```specimen
hover-card-a-players-card
```

## Toast

Module: `@pbgo/ui/platform/sonner`

A message that confirms something happened and fades by itself. Call `toast()` from anywhere; the `Toaster` is mounted once per layout (the gamemaster's; the games mount their own, `AppToaster`).

### Kinds

Keep a toast to a few words. `toast.promise` follows a request from loading to done.

```specimen
toast-kinds
```

## Cookie banner

Module: `@pbgo/ui/platform/cookie-banner`

The question about statistics and recordings: a wide card that floats at the bottom of the screen, centred, with a title, a sentence that ends with a link to the policy, and three buttons: Customize (`secondary`), Reject optional (`secondary`) and Accept all. The buttons are the same size and shape, so refusing is as easy to hit as accepting. On a wide screen the card is a bar (the words on the left, the buttons on the right); on a narrow one the words are over the buttons.

Customize swaps the content of the card for the choices, one row each with a switch: Necessary (on and out of reach), Analytics and Marketing. The word beside each switch (Required, On, Off) says where it stands. The card ends with Back and Save preferences, and Escape goes back. Accept all turns both switches on, Reject optional both off.

The words and the answers come from the caller: `@pbgo/analytics` keeps the stored answer. The banner carries the `platform` class itself, since it also sits over a game page.

### Room for the card

The card never sits over the page: `@pbgo/analytics` publishes its height as `--consent-h` on `<body>`, and a screen as tall as the viewport subtracts it (see [Room for the cookie banner](../01-guidelines.md#room-for-the-cookie-banner)).

### First visit

No close button: the banner stays until the visitor answers.

```specimen
cookie-banner-first-visit
```

### Customize

The same card opened on its choices.

```specimen
cookie-banner-customize
```

### Reopened from the Cookies link

A visitor who already answered can reopen it from the Cookie Policy page or a game's settings menu. The card then has a close button, closes on Escape and takes the focus; closing it keeps the answer.

```specimen
cookie-banner-reopened
```
