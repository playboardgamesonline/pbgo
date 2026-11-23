# Floor buttons

A floor button is for an action that has no object on the table, such as stopping or dealing: a choice between objects is made by pressing the objects ([Rules of the board](26-rules-of-the-board.md)). It is a button drawn flat on the table, not floating over it: a pad of a colour with a thin outline and its label, on the felt like a card or a plate. Stay is a floor button, and so is Deal; Hit is not, since it has an object, the draw pile ([Action labels](27-action-labels.md#over-a-pile)). Its colour is a tone of the game's theme, `primary` or `neutral`, never a colour a board types ([Tones](#tones)). A player is not chosen with one: that is a [hotspot](#choosing-a-player) over their cards. At rest the pad is a tint with an outline. Under the pointer, under the keyboard focus and while it is held, its border lifts off the table: the rim rises, a soft shadow shows under it and the fill brightens. A canvas takes no keyboard, so each pad that can be pressed also puts one real, hidden button in the page, which the Tab key reaches (`useStandIn`, which a `Card` that can be pressed uses too). The table's side is `packages/table/src/floor/`: `floor-button.tsx` draws it, `hotspot.tsx` is the invisible area that chooses a player, `lift.ts` holds what is pure (how far the rim has lifted, the colours at each stage) and `lift.test.ts` tests it.

Move the pointer over the buttons, or press Tab to walk the keyboard focus through them, and Enter or Space to press. Switch them off to see them lie flat and dim.

```specimen
scene-floor-buttons
```

## The parts of a floor button

| Part | What it is | Where it comes from |
| --- | --- | --- |
| Pad | A rounded rectangle lying on the table: a tint of the tone at rest, brighter and more opaque as the rim lifts | `tone`, `tint` |
| Rim | The outline of the pad. Flat and thin at rest, a raised wall with a darker side under the pointer or the focus, pressed down a little while it is held | `rim`, the lift |
| Shadow | A soft dark spot under the rim that shows as it rises | the lift |
| Label | The words, written flat on the pad with `TableText`, which rise with the rim so the wall does not bury them | `label`, in the game's words |
| Hit area | The whole pad, invisible, what the pointer reaches | `width`, `depth` |
| Keyboard stand-in | One visually hidden `<button>` per pad that can be pressed: it takes Tab, says its name and presses with Enter or Space | `ariaLabel` or `label` |

## On the table

A `FloorButton` is shared: `packages/table/src/floor/floor-button.tsx`. The props are `FloorButtonProps` (a zone, which is deprecated, takes `FloorZoneProps`):

| Prop | Role |
| --- | --- |
| `at` | `{ x, z, yaw? }`: where the pad's centre lies and the way it faces. A pad of a seat takes the yaw of the seat |
| `width`, `depth` | The pad's size in world units, `width` along its own x axis and `depth` along its own z axis. A button is as deep as the pile it sits beside |
| `tone` | `primary` (the default) for the action that goes on, `neutral` for the quieter ones: the tint, the outline and the rim all come from it, and the game's theme gives each its colour ([Tones](#tones)). A `#rrggbb` is still drawn as it is and anything else grey, which is deprecated: a board types no colour |
| `label` | What is written on the pad, in the game's words and the visitor's language: the action it does. Required: a pad with no label is a zone, which is deprecated |
| `labelHeight` | The size of the letters in world units (default 0.55). A label too long for the pad, a word in another language, is set smaller to fit it on one line (`fitLabel` in `lift.ts`) |
| `font` | Deprecated: the lettering is the table's (`useLettering`), the display font of the game |
| `weight` | Deprecated: the table's own (`LETTERING_WEIGHT`) |
| `ariaLabel` | What a screen reader says and what the keyboard focus lands on; `label` when not given. A zone, which has no label, must give one ("Pick the card") |
| `onPress` | A click, a tap, or Enter or Space on the focused pad calls it. Without it the pad is drawn and takes no press |
| `disabled` | The pad lies flat and dim, takes no pointer and is left out of the Tab order |
| `rim` | How high the rim rises, in world units (default `RIM_HEIGHT`, 0.2) |
| `hitY` | A zone only, deprecated: how high the invisible plane that takes the pointer lies (default 0.02) |
| `children` | A zone only, deprecated: the decal slot, see [Decals](#decals) |
| `tint` | A zone only, deprecated: how strongly the pad is tinted, as a share of the usual (default 1) |

- **Hover, focus and press** all lift the rim; a held press lowers it a little (`LIFT_LEVELS`, `liftTarget` in `lift.ts`). Keyboard focus shows the lift only for a focus the browser draws a ring on (`:focus-visible`), so a pointer press does not leave a pad lifted. A disabled pad never lifts.
- **Reduced motion.** The rim glides in about a sixth of a second (`stepLift`). A visitor who asks for less motion (`usePrefersReducedMotion`, as every block of the table) gets the lifted state at once, with no glide: the rim is up or it is down, never on its way.
- **Layers.** The pad lies over the mat and under the cards; the label is drawn over the pad and the rim. The hit area is a flat plane just above the table, so a card or a plate lying over a pad is pressed through only where the board lets it.
- **Spacing.** A board lays its pads out with one gap, the same between a pad and a pile, between two pads and between a pad and the next thing: `FLOOR.gap` in Flip 7's `layout.ts`. Check them with a pure test (the boxes, not a screenshot): `floorPlan` and its tests are the model.
- **Words.** Nothing is written in the block. The label and the accessible name come from the game's words ([Words and names](00-words-and-names.md)), so a pad whose word is missing reads `[missing: <key>]` on the table, as every text does.

## Tones

A button has one of two tones, and the game's theme gives each its colour: `primary` for the action that goes on (Deal, Play) and `neutral` for the quieter ones (Stay, Keep, Swap). By default `primary` is the accent of the game's theme and `neutral` its text colour, which the settings change in the gamemaster, so a button follows the colours of the game without a board typing one. A game that wants others says it once, in its `UI_THEME`:

```ts
button: { primary: "accent", neutral: "#b4c6d8" }
```

Each is a key of the theme (`accent`, `foreground`, `surface`…) or `#rrggbb` ([Game themes](../../design/04-in-game/03-game-themes.md)). `floorTones` gives the colour each tone stands for and `useFloorTones` reads it for the game shown. The lettering of a button is the table's, in the display font of the game (`useLettering`): a board gives no font and no weight.

## In Flip 7

| What | Where | Tone |
| --- | --- | --- |
| Stay, beside the draw pile, one pad across the strip between the two piles and as deep as them, on the viewer's turn. It lies dim when the viewer holds nothing to bank | `floorPlan().pad` | `neutral`: a pale cool grey `#b4c6d8` with a hint of the blue-green of the table |
| Deal, the same pad, for the dealer between two rounds | `floorPlan().pad` | `primary`: a luminous blue-green `#4fe0c0`, which reads on the teal table |
| Hit is not a button: it is the draw pile, whose top card is pressed, with the word "Hit" over it | `action` of its `Pile` | |
| The area of each seat that can get the action card the viewer holds: a `Hotspot` over the cards and the plate, which lights the cards as the pointer goes over it, and a pool of light where a player has no card yet, see [Choosing a player](#choosing-a-player) | `zones()`, `ZONE_PADDING`, `ZONE_MAX_WIDTH` | none: the cards are lit by the bloom of their state |

The tones are `UI_THEME.button` of the game, `{ primary: "#4fe0c0", neutral: "#b4c6d8" }`. The action card drawn lies face up at the left of the strip, beside the draw pile, in the state `selected` for the player who gives it, because Stay and the card never show at once. What the player has to do is the ticker's `prompt`, one sentence for each action card, and the table writes none. The game's words for them are `hit`, `stay`, `deal`, `targetFreeze`, `targetFlipThree`, `targetSecondChance` and `targetPlayer` (the accessible name of an area).

## Choosing a player

A choice between objects is made by pressing the objects ([Rules of the board](26-rules-of-the-board.md)), and a player is chosen by pressing their cards. The area that takes the press is a `Hotspot`, which draws nothing: no pad, no rim, no tint, no light under the plate. What shows is the cards, which are in the states of [Cards](04-cards.md#states).

Turn on "Choose a player" and move the pointer over a seat: its cards glow, brighter under the pointer and brightest while pressed. Turn on "Left holds no cards" to see a seat with none lit by a pool of light where its cards would lie.

```specimen
scene-seat
```

| Prop of a `Hotspot` | Role |
| --- | --- |
| `at`, `width`, `depth` | `{ x, z, yaw? }` and the size of the area in world units: the middle of the box of the player's cards and their plate on the table, the yaw of their seat, and the size of that box with a little room all round. The box is in the frame of the seat, so `at` is `pointInFrame(frame, centreOf(box))` |
| `ariaLabel` | What a screen reader says and what the keyboard focus lands on ("Give the turn to Alix"); the area has no label of its own |
| `onPress` | A click, a tap, or Enter or Space on the focused area calls it. Without it the area takes no press and no pointer |
| `onTouch` | Told what the visitor does to the area (`{ hovered, focused, pressed }`) every time it changes, and `NO_TOUCH` when the area goes: the game states the cards under it from it |
| `hitY` | How high the invisible plane that takes the pointer lies (default `HOTSPOT_HIT_Y`, 0.35, a card's height): above the cards, so the whole area answers, cards included |

- **The game says `interactive`, the table does the rest.** While a player can be chosen, the cards of that player are in the state `interactive`. The game keeps what the area says (`onTouch`) and gives its cards `effectiveState("interactive", touch)`: `hover` under the pointer or the keyboard focus, `pressed` while it is down. A card does not need a handler of its own: the cards lie under the area, which takes the pointer.
- **One area per player: their cards, with the plate inside.** The area holds the player's cards (the room of the biggest hand) and the plate that stands beyond them, on the side that faces the middle, in the frame of the seat, so that it is turned as the seat is, with a padding all round that stops short of the other seats, the piles and the buttons. A press anywhere in it, on a card, on the padding or on the name, chooses the player. The plate never reacts: the name and the avatar do not light up, tint or scale.
- **A seat with no card is chosen too.** A `LightPool` the size of a card, where the cards would lie, is lit in the same states, so an empty area and a full one read alike. It lies flat on the table, takes no pointer and breathes while it can be chosen.
- **The keyboard** reaches the area as it reaches a card that can be pressed: one visually hidden button for each, saying `ariaLabel` (`useStandIn`), and the focus counts as a touch. Reduced motion makes the states instant.
- **Colours** are the game's: `UI_THEME.card` gives each state's bloom its colour and strength, and the table has no colour of its own for a target. A board never types one.
- **Geometry.** Tested with the boxes, not a screenshot: no area overlaps another area, another seat's plate, a pile or the buttons, and an area holds its player's cards and plate (the `layout.test.ts` of Flip 7 and of the template are the models).

## Decals

Deprecated, with the zones. A pad can carry flat marks (a seat's emblem, a sketch, a glyph) that belong to the pad, not to the cards on it. The extension point is the `children` of a `FloorButton`: they are drawn in the pad's own frame (x along `width`, z along `depth`, y up, the origin at the pad's centre) at `DECAL_Y` (0.012), over the tint and under the label and the cards, and they stay on the table as the rim lifts. A decal that must not take the pointer has `raycast={() => null}`. The slot is implemented and is one line (`floor-button.tsx`); it has no automated test, since nothing renders a scene in the unit tests, and no game uses it yet.

## Limits

- The keyboard stand-in is a DOM button placed at the pad's centre. It is hidden from the eye but not from a screen reader, which reads one entry for each pad that can be pressed. A table with many pads at once (a zone for each seat) lists as many buttons.
- The drop shadow is a texture laid under the rim, not a real shadow: it does not follow the light and does not fall on other pads.
- The rim is an extruded outline whose height is scaled, so its wall is as thick as the outline: it reads as a lifted border, not as a block.
