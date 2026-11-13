# Floor buttons

A floor button is a button drawn flat on the table, not floating over it: a pad of a colour with a thin outline, on the felt like a card or a plate. Hit and Stay are floor buttons, and so are the big zones a player presses to choose whose seat gets a card. At rest the pad is a tint with an outline. Under the pointer, under the keyboard focus and while it is held, its border lifts off the table: the rim rises, a soft shadow shows under it and the fill brightens. A canvas takes no keyboard, so each pad that can be pressed also puts one real, hidden button in the page, which the Tab key reaches. The table's side is `packages/table/src/floor/`: `floor-button.tsx` draws it, `lift.ts` holds what is pure (how far the rim has lifted, the colours at each stage) and `lift.test.ts` tests it.

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

A `FloorButton` is shared: `packages/table/src/floor/floor-button.tsx`. The props are `FloorButtonProps`:

| Prop | Role |
| --- | --- |
| `at` | `{ x, z, yaw? }`: where the pad's centre lies and the way it faces. A pad of a seat takes the yaw of the seat |
| `width`, `depth` | The pad's size in world units, `width` along its own x axis and `depth` along its own z axis. A button is as deep as the pile it sits beside; a zone covers a whole sector of the table |
| `tone` | The colour, `#rrggbb`: the tint, the outline and the rim all come from it. From the game's settings or its palette, never a literal in a board. Anything else than `#rrggbb` is drawn grey |
| `label` | What is written on the pad, in the game's words and the visitor's language. Leave it out for a zone with nothing written on it |
| `labelHeight` | The size of the letters in world units (default 0.55). A label too long for the pad, a word in another language, is set smaller to fit it on one line (`fitLabel` in `lift.ts`) |
| `font` | The CSS font of the lettering, `TABLE_FONT` by default |
| `ariaLabel` | What a screen reader says and what the keyboard focus lands on; `label` when not given. A zone with no label must give one ("Give it to Alix") |
| `onPress` | A click, a tap, or Enter or Space on the focused pad calls it. Without it the pad is drawn and takes no press |
| `disabled` | The pad lies flat and dim, takes no pointer and is left out of the Tab order |
| `rim` | How high the rim rises, in world units (default `RIM_HEIGHT`, 0.2) |
| `tint` | How strongly the pad is tinted, as a share of the usual (default 1). A big zone that lies under cards takes about 0.3 so that it colours the table without hiding it |

- **Hover, focus and press** all lift the rim; a held press lowers it a little (`LIFT_LEVELS`, `liftTarget` in `lift.ts`). Keyboard focus shows the lift only for a focus the browser draws a ring on (`:focus-visible`), so a pointer press does not leave a pad lifted. A disabled pad never lifts.
- **Reduced motion.** The rim glides in about a sixth of a second (`stepLift`). A visitor who asks for less motion (`usePrefersReducedMotion`, as every block of the table) gets the lifted state at once, with no glide: the rim is up or it is down, never on its way.
- **Layers.** The pad lies over the mat and under the cards; the label is drawn over the pad and the rim. The hit area is a flat plane just above the table, so a card or a plate lying over a pad is pressed through only where the board lets it.
- **Spacing.** A board lays its pads out with one gap, the same between a pad and a pile, between two pads and between a pad and the next thing: `FLOOR.gap` in Flip 7's `layout.ts`. Check them with a pure test (the boxes, not a screenshot): `floorPlan` and its tests are the model.
- **Words.** Nothing is written in the block. The label and the accessible name come from the game's words ([Words and names](00-words-and-names.md)), so a pad whose word is missing reads `[missing: <key>]` on the table, as every text does.

## In Flip 7

| What | Where | Tone |
| --- | --- | --- |
| Hit, then Stay, side by side to the right of the draw pile, as deep as it, on the viewer's turn. Stay lies dim when the viewer holds nothing to bank | `floorPlan()`: `hit`, `stay` | teal `#19a89a`, and a grey `#7d9899` with a hint of the same teal, so the pair belongs together |
| Deal, one pad across the room of the two, for the dealer between two rounds | `floorPlan().deal` | the teal |
| The zone of each seat that can get the action card the viewer holds: the line, the plate and a margin, as big as the room beside its neighbours allows (`zones`, never overlapping each other or the piles) | `zones()`, `ZONE_MARGIN`, `ZONE_MAX_WIDTH` | the teal, `tint` 0.3 |

The action card drawn lies face up in the place of Hit, and its sentence is written flat beside it (`fitPrompt` breaks it into lines that fit the room), because Hit and Stay and the card never show at once. The game's words for them are `hit`, `stay`, `deal`, `targetFreeze`, `targetFlipThree`, `targetSecondChance` and `targetPlayer` (the accessible name of a zone).

## Limits

- The keyboard stand-in is a DOM button placed at the pad's centre. It is hidden from the eye but not from a screen reader, which reads one entry for each pad that can be pressed. A table with many pads at once (a zone for each seat) lists as many buttons.
- The drop shadow is a texture laid under the rim, not a real shadow: it does not follow the light and does not fall on other pads.
- The rim is an extruded outline whose height is scaled, so its wall is as thick as the outline: it reads as a lifted border, not as a block.
