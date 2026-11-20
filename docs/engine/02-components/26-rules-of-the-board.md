# Rules of the board

These rules hold for every board, whatever the game.

- A board is 3D, never 2D: no DOM or CSS board. A missing picture is a generated texture (`standIn`) or a plain material, and only the shared HUD is DOM.
- A game imports `@pbgo/table` from its lazy board chunk only, so the hub, a game's page on it included, loads no three.js ([Lazy loading](../04-build-a-game/04-composing-a-board.md#lazy-loading)).
- `@pbgo/table` imports no game. It depends on `@pbgo/core` (easing, share photo, motion preference), and core never imports it.
- A game's pictures and words stay in its Sanity project: the tools take textures, sizes and labels as arguments.
- Every material is unlit and not tone mapped, so a colour on the screen is the texture's own.
- The layout helpers read no setting: every number is an argument. A card reads `CARD_SETTINGS`, the camera reads the objects it is given, and the debug panel edits those objects ([Tuning](../04-build-a-game/07-tuning.md)).
- A card has one type for every game and the states of [Cards](04-cards.md#states): the game says whether a card can be chosen, is picked, is disabled or is out, and the table draws its bloom of light, its lift and its press. A board wires no hover, no lift and no glow for that, and keeps no hovered id.
- A card or a zone that can be pressed keeps a hidden button in the page, so the keyboard reaches it ([Floor buttons](25-floor-buttons.md)).
- A pile writes its own count under it, in the lettering of the plates. A board draws none.
- A choice between objects on the table (a pile, a card of a hand, a cell of a grid, a player's cards) is made by pressing the objects, which are in the `interactive` state, with one line of text above them that says what to do. A button is for an action that has no object, such as stopping or dealing.
- A scene is a function of the view: the same view gives the same poses on every client, and a pose never calls `Math.random` (`hashRandom` gives the small differences).
- The scene holds no rule and sends intents: a click calls a handler, and the board posts the action ([The life of an action](../01-the-game/01-how-a-game-runs.md#the-life-of-an-action)).
