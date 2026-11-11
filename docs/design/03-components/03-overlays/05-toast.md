# Toast

Module: `@pbgo/ui/platform/sonner`, `@pbgo/ui/platform/person-toast`

A message over the page, in a corner, that says something happened. Call `toast.success()` or `toast.error()` from anywhere; the `Toaster` is mounted once in each layout (the hub's and the gamemaster's; a game mounts its own, in its own look).

## Kinds

A confirmation, a piece of news, a warning, an error or a wait: the icon of its kind in a tile, the message, and a second line or a button when it needs one. It goes by itself; a wait stays until a confirmation or an error replaces it (`toast.loading`, then the same `id`).

```specimen
toast-kinds
```

- Keep the message to a few words; what the member can do about it is a button, not a longer message.
- The second line gives a reason, never the message again.
- A warning or an error stays longer than a confirmation, and a second line adds time: the duration leaves the time to read, and a `duration` of the caller wins.

## Fixed

A toast that must not be missed is `fixed`: it stays until it is closed, with the cross at its top right corner.

```specimen
toast-fixed
```

- `fixed` always draws the cross: a toast that stays and cannot be closed does not exist.
- A fixed toast is for what waits for an answer or cannot be undone by waiting, never for a confirmation.
- Never write `duration: Infinity` or `closeButton` by hand: `fixed` sets both.

## About a person

The toasts about a person draw their own card: the picture, the name with its tag, what is said, and the buttons. Raise one with `toast.custom`, which gives it the width of the toaster and the duration of a message.

### A friend request that was sent

Cancel takes the request back. The toast goes by itself, after the time that leaves the button within reach.

```specimen
toast-friend-request-sent
```

### A friend request that came in

Accept with the check, Decline with the cross, each in one press.

```specimen
toast-friend-request-received
```

### An invitation to a game

The one toast about a person that stays: it is fixed, and its cross dismisses it without an answer. The page gives the person, the game and what each button does.

```specimen
toast-game-invitation
```

## Rules

- A toast is a floating surface: the glass, the roundest step of the corners and the float shadow, so it follows the member's choice of less transparency.
- What sits in a toast, the tile of its icon and its buttons, takes the toast's corner less its padding.
- A toast that goes by itself waits while the pointer is over it and while the tab is hidden.
- A button of a toast answers once: it is off while the answer is awaited, the toast closes when the answer went through, and a refused answer keeps it.
- What a button does is the page's, and the page says what became of it in a toast of its own.
- No toast takes the focus: the pointer reaches it, and so does the keyboard, with the hotkey of the toaster, which also keeps the toasts from going while they are used.
- A toast that asks for an answer is a group named by who it is about and what it says, never a status.
- Less motion stops the toasts from moving: they come and go at once.
- The toasts stand in a column and all of them are in view, up to three at a time, above the room the page keeps for the cookie banner.
- The names in a toast are masked in a recording.
