# Game select

Module: `@pbgo/ui/platform/game-select`

The panel that picks the games of the signed-in home's play zone: a search field and the list of the games. It has no field of its own: it is opened by the tile that adds a game, the last of the row of the tiles of the games that are in. It picks several games at once (`max` over one: the panel stays open between picks, so that several can be added) or one (`max` of one: a pick replaces the one before and closes the panel).

```specimen
game-select
```

- The games that are picked are drawn by the page as tiles (`PickedGame`): the picture, its name centred under it, in a search for the rank the member's rank under the name with the small emblem of its tier at the left of it, a cross that takes the game out and, with settings, a press on the picture that opens them. The tile that adds a game (`AddGameTile`) is a dark, translucent frame with a plus in it and its label centred under it, as big as the others, and it opens the panel. Whatever takes the props and the ref of a button can open it.
- Once `max` games are in, the ones that are not are off, and `fullNote` says to take one out.
- A game that cannot be picked now is an option with `unavailable`. It stays in the list, off, with the reason in the line under its name and a warning at its end, so that nobody wonders where the game went. Its tile is off too, with the same warning, whose hover says the reason; the page says it in small text above its main button as well, since a touch has no hover.
- The panel is a [combobox](06-combobox.md) in a modal [popover](../03-overlays/03-popover.md). A panel of a search and a list takes the row step of the [radius](../../02-foundations/03-radius.md) and its rows the step inside it, not the surface's.
