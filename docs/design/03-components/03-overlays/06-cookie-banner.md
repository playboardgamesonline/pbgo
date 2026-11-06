# Cookie banner

Module: `@pbgo/ui/platform/cookie-banner`

The question about statistics and recordings: a wide card that floats at the bottom of the screen, centred, with a title, a sentence that ends with a link to the policy, and three buttons: Customize (`secondary`), Reject optional (`secondary`) and Accept all. The buttons are the same size and shape, so refusing is as easy to hit as accepting. On a wide screen the card is a bar (the words on the left, the buttons on the right); on a narrow one the words are over the buttons.

Customize swaps the content of the card for the choices, one row each with a switch: Necessary (on and out of reach), Analytics and Marketing. The word beside each switch (Required, On, Off) says where it stands. The card ends with Back and Save preferences, and Escape goes back. Accept all turns both switches on, Reject optional both off.

The words and the answers come from the caller: `@pbgo/analytics` keeps the stored answer. The banner carries the `platform` class itself, since it also sits over a game page.

## Room for the card

The card never sits over the page: `@pbgo/analytics` publishes its height as `--consent-h` on `<body>`, and a screen as tall as the viewport subtracts it (see [Room for the cookie banner](../../01-guidelines/04-in-game-rules.md#room-for-the-cookie-banner)).

## First visit

No close button: the banner stays until the visitor answers.

```specimen
cookie-banner-first-visit
```

## Customize

The same card opened on its choices.

```specimen
cookie-banner-customize
```

## Reopened from the Cookies link

A visitor who already answered can reopen it from the Cookie Policy page or a game's settings menu. The card then has a close button, closes on Escape and takes the focus; closing it keeps the answer.

```specimen
cookie-banner-reopened
```
