# Words and names

A board is a tree of components, and some of the words used for its parts are not components of the code. This page shows the tree, then maps each word to what the code has.

## What sits in what

```text
GameHud                          DOM, shared: ticker, announcements, game over
└── Scene                        the board, loaded on demand
    └── Table                    the canvas, with the pose memory
        ├── Surface              the endless table, always
        ├── CameraRig            puts the camera where the settings say, every frame
        ├── Lights               when asked for
        ├── SharePhoto           when a photo camera is given
        └── World                what lies on the table, the game's own
            ├── PlayerSeat       a Seat for each player, with its pieces
            │   ├── Aura         lit for the player whose turn it is
            │   ├── TableText    the nickname, with SeatAvatarMesh and TurnCrown
            │   ├── TableText    the points
            │   └── Zone         the cards held there, face down, a child of the Seat
            ├── Zone             the viewer's hand
            └── Zone             the middle of the table
                └── Card …       a front, a back, a glow, a shadow
```

`GameHud` is core's ([In-game UI](../../design/04-in-game/index.md)). `Scene` and `World` are the names the template gives the two halves of its `board/scene.tsx` ([Composing a board](../04-build-a-game/04-composing-a-board.md)).

## From a word to the code

The code has no component for some of the words used for the parts of a table. This maps them.

| Word | In the code | Shared or per game | Page |
| --- | --- | --- | --- |
| table | `Table`: the canvas, the camera, the lights and the pose memory, with an endless `surface` | Shared | [Table](01-table.md) |
| table surface | The `surface` prop of `Table`: a colour, and a picture that repeats | Shared | [Surface](01-table.md#surface) |
| mat | No component: the table has no edge, so a mat is a plane the game draws on it | Per game | [Surface](01-table.md#surface) |
| card | `Card` | Shared | [Card](04-cards.md#card) |
| deck, draw pile, discard pile | `Pile` for cards the game only counts; a `Zone` over `pile` for cards it names | Shared | [Pile](06-decks-and-piles.md#pile) |
| hand | A `Zone` over a `fan` layout in front of the viewer | Tools shared, layout per game | [Hand](07-zones.md#hand), [Zone](07-zones.md#zone) |
| cards in front of a player, cards on a field, the middle | A `Zone` framed on a seat or on the table, with the game's own layout | Tools shared, layout per game | [Where cards are](07-zones.md) |
| mission card, character card | No component and no kit type: the missions of Courtisans are setup data that the engine deals to each player, keeps in its state and shows to its owner in the view; a character card with a power of its own is not built | Per game | [Game data](../01-the-game/08-game-data.md), [Not built yet](../03-not-built-yet.md) |
| token, counter, die, game board, track | Nothing: a counter is a number of the state drawn as text, and no tool draws a token, a die or a board | Not built | [Not built yet](../03-not-built-yet.md) |
| score | A number of the view, written by the game as the `line` of a `Seat`, a `TableText` under the nickname | The line is shared, the number is the game's | [Score](09-score.md) |
| player zone | No component: a `Spot` from `seats`, used as the `frame` of a `Zone` and as the `spot` of a `Seat` whose children are what the player holds | Shared | [Seats](03-seats.md) |
| seat | A `Spot` from `seats`, and the `Seat` that draws the player who sits there | Shared | [Seats](03-seats.md) |
| name plate | The name and the avatar of a `Seat`: `TableText` with `SeatAvatarMesh` | Shared | [Text on the table](09-score.md#text-on-the-table), [Seats](03-seats.md#the-avatar) |
| aura | `Aura` | Shared | [Aura](../01-the-game/03-turns.md#aura) |
| crown, turn marker | `TurnCrown` | Shared | [Crown and the turn marker](../01-the-game/03-turns.md#crown-and-the-turn-marker) |
| turn transition | No component: the crown and the aura move, the hand becomes playable, the `turn` announcement plays | The scene is per game, the announcement is shared | [Turn change](../01-the-game/03-turns.md#turn-change) |
| opening, ending | No component: only the camera's entrance is shared | Per game | [Opening and ending](../01-the-game/06-victory.md#opening-and-ending) |
