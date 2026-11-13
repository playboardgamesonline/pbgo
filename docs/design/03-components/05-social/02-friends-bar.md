# Friends bar

Module: `@pbgo/ui/platform/friends-bar`

`FriendsBar` is the start of the dock's bar. First the friends who are connected (`connectedOf`: playing, then online, inactive and do not disturb), each as their picture with the [dot of their presence](03-the-dots-of-presence.md), three at the most and two on a screen narrower than 400px, then "+N" for the others, which opens the social panel; under the pointer a card says who the friend is and what they are doing, and a press does what the page decides (`onOpenFriend`). Then a chip for each game some friends are in, with the picture of the game (`GameIcon`) and how many friends are in it. It draws up to three, the most crowded first, and fewer on a narrow screen. A friend who is away, or in no game, is in none of them: they are in the friends tab of the social panel. With no friend connected and none in a game the bar is the button that invites one. It draws no container of its own: the dock is the one that holds it.

## On the navbar, with friends and with none

Hover or focus a chip to open the panel of its game; it opens at once and closes shortly after the pointer leaves, which lets the pointer cross the gap to it. On a touch screen a press opens it and another closes it.

```specimen
friends-bar
```

## The panel of a game

One card for all the chips, a `MovingCard` ([the card under the pointer](01-social-panel.md#the-card-under-the-pointer)), centred under the chip it follows. It lists the friends who wait in the lobby of the game (`Online`, those at one table together under a line that names it) and those who are `Playing`; a list with nobody in it is not drawn. The Join button of a friend who waits at a table that has room shows on hover or focus, and always on a touch screen.

```specimen
friends-bar-panel
```
