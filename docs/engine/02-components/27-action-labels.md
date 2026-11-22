# Action labels

An action label is the word that says what pressing an object does: "Draw" over the draw pile, "Take the discard" over the discard. It floats above the object, facing the camera, with a small arrow under it that points down at the object and bobs toward it. It is pressed like the object: a click on the word does what a click on the object does, the object lights when the word is under the pointer, and the word when the object is. It is not a button: a button is for an action that has no object ([Floor buttons](25-floor-buttons.md)). It is not a sentence either: what to do now is a sentence, and the ticker says it, in the `prompt` under whose turn it is ([Whose turn it is](03-seats.md#whose-turn-it-is)); a label names one action, in one word or two, at the object that does it. The table's side is `packages/table/src/floor/`: `action-label.tsx` draws it, `label-look.ts` holds what is pure (where its parts stand, its colours, how its arrow moves, its outline) and `label-look.test.ts` tests it.

Move the pointer over a word, or over its pile, and the other lights with it; press either. Switch the player off to see the words go and the piles lie as they are.

```specimen
scene-action-label
```

## The parts of an action label

| Part | What it is | Where it comes from |
| --- | --- | --- |
| Lettering | The word, painted white once with a soft shadow and tinted by its material, so a change of state never paints it again. A word longer than its room is set smaller, on one line | `label`, `room`, `labelHeight`, and the table's lettering (`useLettering`) |
| Arrow | A small triangle with rounded corners under the word, pointing at the object. At rest it bobs toward the object and back; as the label lifts it settles toward it, as if leaning on it | `arrowOutline`, `arrowOffset` |
| Hit area | An invisible box round the arrow and the word. It stops short of the object, which takes the pointer itself | `labelPlan` |
| Billboard | The whole label turns to face the camera, so it reads the same from every angle and a seat's frame never turns it | `Billboard` of drei |
| Colour | The colour of the `interactive` bloom of a card (`UI_THEME.card`), lightened so that it reads on the table; the `hover` one, lightened more, as the label lifts; a dim grey when disabled | the game's theme, `labelColour` |

## On the table

An `ActionLabel` is shared: `packages/table/src/floor/action-label.tsx`. Its props are `ActionLabelProps`:

| Prop | Role |
| --- | --- |
| `at` | `{ x, y?, z }`: where the label hangs from, the middle of the edge of the object that is farthest from the viewer, at the height of its top (`y`, the table's when not given). The label floats a gap above that point with its arrow pointing down at it, so from the camera it stands over the object and never over its face. `pileAboveAt` gives it for a pile |
| `label` | What pressing the object does, in the game's words and the visitor's language: one word or two ("Draw", "Take the discard"). Not a sentence |
| `onPress` | A click or a tap on the word does this: the same as pressing the object. Without it the label is drawn and takes no press |
| `disabled` | The label shows, dim and still, and takes no press: the object is there and cannot do it now. A board that cannot press the object gives no label at all |
| `touch` | What the visitor does to the object the label names (`{ hovered, focused, pressed }`): the label lights as the object does |
| `onTouch` | Told what the visitor does to the label, every time it changes, and `NO_TOUCH` when the label goes: the board states the object from it (`effectiveState`), so that the object lights as the label does |
| `labelHeight` | The size of the letters in world units (`LABEL_HEIGHT`, 0.55) |
| `room` | The most width the lettering takes (`LABEL_ROOM`, 3): the room between the label and the next thing it would touch, another label when two objects stand side by side. A longer word is set smaller to fit it, on one line, whatever the font and the language (`fitHeight`, from the width the word is painted at) |
| `rise` | How far the object rises when it is lifted under the pointer, in world units (default 0): the label rises as far with it, so that the object never covers it. `cardRise` gives it for a card |

- **Hover, press and the object.** The label lifts under the pointer and while the object is touched: it grows a little, brightens and its arrow settles toward the object. A press dips it back (`liftTarget`, `LIFT_LEVELS`, as a floor button's rim). The object is lit by what the label reports (`onTouch`) and the label by what the object reports (`touch`), so the pair behaves as one thing.
- **The keyboard** reaches the object, not the label. The object keeps the one hidden button in the page (`ariaLabel` of the card, [Cards](04-cards.md)), so a screen reader reads one entry for one action, and the label adds none. A canvas has no accessible text, so the word is for the eye, and the `ariaLabel` of the object says the same in the game's words.
- **Reduced motion.** A visitor who asks for less motion (`usePrefersReducedMotion`, as every block of the table) gets the label in its place at once, with no growing, no glide and no bob: the arrow is still, and settles toward the object when lifted.
- **Height.** The label hangs from the top of the object (`at.y`) and floats a gap above it: a pile of twenty cards stands as high as a hand, and a word lying on the table behind it would be hidden by it from a low camera, more so when the pile lifts. It rises as far as the object does (`rise`), so the arrow stays where it was against the card's far edge, and the card never covers it. It hangs from the far edge and not from the middle, so that from the camera it stands over the object and not over its face.
- **Layers.** The label is drawn over the table and the plates, and its hit area stops short of the object, so a card is never pressed through it.
- **Appearing.** The label grows into place when it is drawn, and a board draws it only while the object can be pressed: the word comes with the light on the object and goes with it.
- **Words.** Nothing is written in the block. The word and the accessible name come from the game's words ([Words and names](00-words-and-names.md)), so a label whose word is missing reads `[missing: <key>]` on the table, as every text does.

## Over a pile

A `Pile` takes the word as its `action`: `{ label, onPress, ariaLabel?, room? }`. The pile gives its top card the state `interactive`, the press and the name for the keyboard (`ariaLabel`, the label when not given), hangs the word from the far edge of the pile, at the height of its top card (`pileAboveAt`, which keeps clear of the pile whatever way its frame turns it), has it rise as far as the card does (`cardRise`) and lights the card and the word together. Give none when the pile cannot be pressed: no word is drawn, and the top card is the one the board gives it. The count of the pile stays under it, on the viewer's side, and the word is over its far edge, so the two never meet ([Decks and piles](06-decks-and-piles.md#pile)).

```tsx
<Pile frame={deck} count={view.deck.size} size={CARD_SIZE} back={faces.back} action={viewerChooses ? { label: words.draw, onPress: onDraw, ariaLabel: words.drawAria } : undefined} />
```

## Over any other object

An object that is not a `Pile`, such as the discard, a card of a `Zone` that the game names, takes an `ActionLabel` of its own, put where its arrow must point, and a board states the pair itself: the card is `interactive` while it can be pressed and the label is drawn with it. The board keeps what the visitor does to the word (`onTouch`) for the card's state, and what the pointer does to the card (`onHover` of the card) for the word (`touch`). It is the one place a board writes a state for a hover, because the word and the card are two things the table cannot tell are one:

```tsx
const [touch, setTouch] = useState<Touch>(NO_TOUCH)
const [over, setOver] = useState(false)
const slots = pile(1, { face: "up", scale })

<Zone
  frame={discard}
  layout={slots}
  size={CARD_SIZE}
  cards={[{ key: "discard", front: top, back: faces.back, state: canTake ? effectiveState("interactive", touch) : "base", onPress: onTake, ariaLabel: words.takeAria, onHover: setOver }]}
/>
{canTake && <ActionLabel at={pileAboveAt(discard, CARD_SIZE, scale, slots[0]?.position.y)} label={words.takeDiscard} onPress={onTake} touch={{ ...NO_TOUCH, hovered: over }} onTouch={setTouch} rise={cardRise(CARD_SIZE, scale)} />}
```

`pileAboveAt` is the point over any object that lies as a pile does, from its frame, its card size, its scale and the height of its top (the `position.y` of its top card's pose); a board whose object is another shape gives the point itself, the middle of its far edge. `cardRise` is how far a card of that size and scale rises under the pointer, from `CARD_STATE_SETTINGS.hoverLift`, so a debug panel that tunes the lift tunes the word with it.

## Rules a board follows

- One label for one object, saying what pressing that object does, in one word or two. Two objects side by side give each its own `room`, so their words never touch.
- A board draws the label only while the object can be pressed, and the object is then in the `interactive` state with its `onPress` and its `ariaLabel`. A label that is drawn over an object that cannot be pressed is `disabled`.
- A board writes no sentence on the table: what to do now is the `prompt` of the ticker. A label that grows into a sentence, or two lines of words, is a prompt that has gone to the wrong place.
- A board types no colour, no font and no size for a label: the colour is the card's theme, the lettering the table's, and the size the label's own.

## Limits

- The word is a lettering of the table on a plane that faces the camera: it is as sharp as the plates are, and it is never foreshortened, so it is the one text of the table that reads the same from a low camera and from a high one.
- The arrow points down. A label over an object in the frame of another seat is not turned with that seat: it faces the camera, so the word is read as the viewer reads it.
