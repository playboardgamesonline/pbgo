# Bets and choices

A bet is a number a player names, a choice is an option a player picks, and a bid is both at once: how many, of which face. The engine takes each in one place, `cleanNumber`, `cleanChoice` and `cleanChoices` of the kit, and keeps what they return in its state like any other value. There are two ways to ask for it on the board. The first is a field on the table, a `NumberField` or a `ChoiceField`, which opens the platform's window, where the player chooses and confirms: it is the platform's look, and it is what text needs, since a canvas takes no keyboard. The second is the game's own pieces: bid cards that are pressed, tokens, a `Stepper` and a `Slider`, drawn in the game's look and laid on the table, and with them the answer is shown on the table too, with a card face down at a seat for a bid that is secret. A window can hold several fields, which is how a bid is asked. The kit's side is `packages/engine-kit/src/answers.ts`, the table's `packages/table/src/field/`, `stepper/` and `slider/`, the windows' `packages/core/components/game/prompt.ts` and `prompt-host.tsx`.

Press the papers: a bet of tricks, a face, and a bid with two fields. The buttons under the scene open the same windows, which is the way to them with the keyboard.

```specimen
scene-bets
```

## In the engine

| Export | What it does | Errors |
| --- | --- | --- |
| `cleanNumber(input, rules)` | The number a player chose, checked against the rules: the least (`min`) and the most (`max`), the steps it goes by (`step`, counted from `min`), a whole number unless `integer` is turned off | `EngineError("INVALID_NUMBER")` for anything that is not a finite number, one outside the range or off the steps; `RangeError` for rules no number could meet |
| `cleanChoice(input, options)` | The option a player chose, which must be one of `options` | `EngineError("INVALID_CHOICE")` for anything else, a string where a number is wanted included |
| `cleanChoices(input, options, rules)` | Several options: a list with none twice, between the least and the most the rules allow, given back in the order of `options` whatever the order they were sent in | `EngineError("INVALID_CHOICE")` |

- Call them in `apply`, on the field of the action, and keep what they return. A missing field is `INVALID_ACTION`; a value that does not pass is `INVALID_NUMBER` or `INVALID_CHOICE`, shared codes that the platform words for the player ([The shared codes](../01-the-game/05-actions.md#the-shared-codes)).
- The rules are typed: `NumberRules` (`min`, `max`, `step` and `integer`, every field optional) and `ChoicesRules` (`min` and `max`, how many options may be chosen at once); an option is a `ChoiceValue`, a string or a number.
- The rules of the window and the rules of the engine are the same: the window is given the `min`, `max` and `step` that `cleanNumber` checks with, and the options that `cleanChoice` checks against, and it checks them again when the player confirms, so that the engine refuses nothing the window accepted. Only the engine's answer counts.
- A bet whose rules depend on the state (a bid that must beat the last one, a bet of 0 up to the tricks of the round) has them worked out from the state, in the engine for the check and in the view for the window: the view gives the board the `min`, the `max` and the options it asks with, never a guess of its own.
- A bid is two fields of one action: `cleanNumber` for how many and `cleanChoice` for which face, then the game's own rule that it beats the last bid, with its own code.
- A bet that everybody makes at once and reveals together is a `Submissions<number>` ([Simultaneous steps](../01-the-game/03-turns.md#simultaneous-steps)): the view says who bet, never what, until the step is resolved.
- A choice among cards is the click of the card on the table ([Clicks and hover](../01-the-game/05-actions.md#clicks-and-hover)); the window is for a choice that has no object on the table to press: a colour, a face, yes or no, how many. A game that wants even those in its own look gives them an object: a token for each face, a `Stepper` for how many ([With the game's own pieces](#with-the-games-own-pieces)).

From `packages/engine-kit/src/answers.test.ts`:

```ts
cleanNumber(15, { min: 5, max: 50, step: 5 })     // 15
cleanNumber(16, { min: 5, max: 50, step: 5 })     // throws INVALID_NUMBER
cleanChoice("green", ["red", "green", "blue"])    // "green"
cleanChoices(["c", "a"], ["a", "b", "c", "d"])    // ["a", "c"]
```

## Fields that open a window

A `NumberField` and a `ChoiceField` are shared, in `packages/table/src/field/`. Each is a `Paper` that shows what was chosen; pressing it opens the window. The props they have in common are those of a [text field](11-text-field.md#on-the-table) (`at`, `width`, `height`, `font`, the colours, `disabled`, `confirm`, `cancel`, `placeholder`): `NumberFieldProps` and `ChoiceFieldProps` are the props of a `Paper` (`PaperProps`) but its `text` and its `onPress`, which a field fills in, and then:

| Component | Prop | Role |
| --- | --- | --- |
| `NumberField` | `value` | The number, or null while none was chosen. The board owns it |
| | `onChange` | Called with the number the player confirmed. Without it the field only shows its number |
| | `label`, `hint` | The title of the window and a line under it, in the game's words |
| | `min`, `max`, `step` | The range and the steps: the rules of `cleanNumber` |
| | `format` | How the number is written on the paper: its unit, a word (default the number itself) |
| `ChoiceField` | `value` | The option chosen, or null while none was |
| | `options` | The options, each with its `value`, its `label` in the game's words, and optionally a `description`, an `image` and `disabled` |
| | `onChange` | Called with the option the player confirmed |
| | `label`, `hint` | The title of the window and a line under it |
| | `instant` | Pressing an option confirms it, with no button after: yes or no |

A `Paper` (props: `PaperProps`) is the piece of paper on its own, in `paper.tsx`: its `text`, its `placeholder`, and an `onPress` that does what the board wants. It is how a board opens a window of its own (a bid, with `ask`), and also a button on the table: a label that can be pressed. Without `onPress` it only shows its text.

```tsx
<NumberField value={bet} onChange={(n) => post({ type: "bet", tricks: n })} label={texts.betLabel} min={0} max={view.round} placeholder={texts.betPlaceholder} at={{ x: 0, z: 2.4 }} />
<ChoiceField value={face} options={faces} onChange={(face) => post({ type: "face", face })} label={texts.faceLabel} at={{ x: 3, z: 2.4 }} />
```

## With the game's own pieces

A window is in the platform's look, flat and the same for every game. A game whose table has a look of its own, a banquet, a pirate ship, asks for a bet with what lies on that table: the player presses a card, takes a token, drags a knob, and the answer stays where everybody can see it. Nothing is new in the engine, which checks the answer as it checks any other, and nothing is new to the player, who presses things on a table.

### A bid made with cards

Everybody bids at once, in secret, and the bids are shown together: a simultaneous step. The viewer has a row of bid cards across the middle of the table, one for each bid they may make. Press one and it goes to your seat, face up for you to read; press another and it takes its place, since you may change your mind until the last player has bid. The others' bids lie face down at their seats as soon as they are made, and turn over together when the last has. The cards that were not chosen leave.

```specimen
scene-bid
```

The engine keeps the bids in a `Submissions<number>` and the view says who has bid, never what, until everybody has ([Simultaneous steps](../01-the-game/03-turns.md#simultaneous-steps)). That is all the board needs, and it draws three things from it:

- **The row.** A card for each bid the viewer may make, from none to one for each card of their hand, laid out with `onTable` and lifted under the pointer. The `bid` action is posted by the click, as any action is, and the engine refuses the bid that is not legal.
- **The viewer's bid.** The card they chose, face up at their seat on the line to the middle of the table, turned as the seat is. It keeps the `id` it had in the row, so that it flies from the row to the seat and flies back when the viewer chooses another ([Poses and motion](05-poses-and-motion.md)).
- **The others' bids.** A card for each player who has bid (`hasBid`), face down at their seat, with a stand-in numeral that nobody can read: the view has not told it. When the view gives the bids, the card is turned face up with the real one, which is a change of the `face` of its pose.

```tsx
// The row of the viewer (`rowShown`: while the players bid, and for a moment after), then the bids at the seats
{view.me && rowShown && Array.from({ length: view.me.hand.length + 1 }, (_, k) => (
  <Card key={k} id={`bid-${k}`} target={view.me.bid === k ? bidPose(mySeat, true) : bidRowPose(k, count)} from={DECK_POSE} front={bidFace(k)} back={bidBack()} size={CARD_SIZE} onClick={() => post({ type: "bid", amount: k })} />
))}
{view.players.filter((player) => player.id !== meId && player.hasBid).map((player) => (
  <Card key={player.id} id={`bid-of-${player.id}`} target={bidPose(seatOf(player), player.bid !== null)} front={bidFace(player.bid ?? 0)} back={bidBack()} size={CARD_SIZE} />
))}
```

This is the bid of the template (`template/src/components/board/bids.tsx`), which has the whole of it: the cards of the game's own look, the cards that go when the bids are in, and a test that the row, the bids and the clock never lie on one another at a table of two to six players. The same cards and the same moves serve a vote, a pick of a card that is revealed together, a secret choice of any kind: a card face down is an answer that is given and not yet known.

The click is the pointer's way, and a pointer is not everybody's. A bid that is only asked on the table cannot be reached with the keyboard or a screen reader, so the board keeps a way beside it: the buttons of the window, `askNumber` or `askChoice`, drawn out of sight until they are reached with the Tab key (the template does it with its `BidPanel`), and the specimen's own controls.

### Numbers and choices on the table

Three ways to ask for what is not a card. A `Stepper` for a count, a row of tokens for a choice among a few, a `Slider` for a number in a wide range. Press the arrows and hold them, press a token, drag the knob or press the rail.

```specimen
scene-numbers
```

#### Stepper

A number between two arrows. The left one takes a step down, the right one a step up, and held down they repeat, faster and faster, which is how a number far away is reached. The arrows are flat pieces and take the game's `color`; the digits are a `Counter`, which counts to each new number. An arrow at the end of the range is dimmed and does nothing.

The props are `StepperProps`:

| Prop | Role |
| --- | --- |
| `value` | The number the board holds. The stepper keeps none of its own |
| `onChange` | Called with the next number, once for a press and again and again while the arrow is held. Without it the stepper only shows its number |
| `min`, `max`, `step` | The range and the steps, from 0 to 99 by 1 unless given: the rules of `cleanNumber` |
| `at` | The middle of the number, and the way it faces; the arrows stand to its left and right |
| `size` | The height of the digits, 1 by default; the arrows follow |
| `format` | How the number is written: its unit, a word. The arrows stand far enough apart for the widest number the range allows |
| `color`, `style` | The colour of the arrows, and how the digits are dressed |
| `change` | Shows what changed above the number, "+1" (off by default: a stepper changes by one) |
| `disabled` | Nobody can press the arrows now, and they are dimmed |

The arithmetic of the arrows is pure and exported: `rangeOf` fills in a `NumberRange` (`min`, `max`, `step`) and keeps it sane, `stepped(value, direction, range)` gives the number a press leads to, and `repeatAfter(index, ...)` the seconds a held arrow waits before its next repeat.

#### A row of tokens

A choice among a few things is a row of what the game draws for each of them, pressed. It takes no component of its own: a `Piece` for each option, with a picture on its top (`faces`), laid out with the layout helpers, and the one that is chosen is lifted and ringed (`lift`, `halo`). A card does the same with its `glow` and its pose. The board keeps the choice, and posts the action when the player presses.

```tsx
{faces.map((face) => (
  <Piece key={face} model="hex" faces={{ top: numeral(face) }} at={{ x: 0.6 + face * 1.15, z: -1.4 }} lift={chosen === face ? 0.2 : 0} halo={chosen === face ? ring : null} onClick={() => choose(face)} />
))}
```

#### Slider

A knob on a rail, which the player drags along it, or takes to a place by pressing the rail. The rail is marked from the least number to the most, the part up to the knob is filled, and the knob wears the number. It is how a number in a wide range is chosen, where the arrows of a stepper would take too long.

The props are `SliderProps`:

| Prop | Role |
| --- | --- |
| `value` | The number the board holds. The slider keeps none of its own |
| `onChange` | Called with the next number while the knob is dragged and when the rail is pressed, each time it changes. Without it the slider only shows its number |
| `onCommit` | Called once with the number the player settled on, when the knob is let go and when the rail is pressed: the moment for a board that asks the server only when the player has chosen |
| `min`, `max`, `step` | The range and the steps, from 0 to 99 by 1 unless given: the rules of `cleanNumber` |
| `at`, `length` | The middle of the rail and the way it runs, and how far the knob goes from the least to the most (6 by default) |
| `size` | The width of the knob, 1 by default; the rail and the letters follow |
| `format` | How the number is written on the knob and at the ends of the rail |
| `marks` | The most marks along the rail, 11 by default: a mark for each number when there are few, a handful spread evenly when there are many |
| `color`, `rail`, `fill`, `ink` | The colour of the knob, of the rail, of the part that is filled, and of the marks and the letters |
| `disabled` | Nobody can move the knob now, and it is dimmed |

- The knob follows the `value` of the board and the board follows the knob: the knob does not move until the board has taken the number. Escape gives the drag up and puts the number back where it was when the knob was taken.
- Both components are kept to the `min`, `max` and `step` that `cleanNumber` checks with, and the numbers they give are on the steps, counted from the least: a stepper or a slider never gives a number that the engine would refuse for its range. The engine is still the one to decide, and refuses what is not right.
- A game that asks the server on every change posts a stream of actions while a knob is dragged or an arrow is held. Keep the number in the board while the player is choosing, and post it when they settle: `onCommit` for the slider, a confirm for the stepper (a `Paper` that says "Bet", pressed).

The arithmetic of the rail is pure and exported too: `valueAt(fraction, range)` is the number a place along the rail means, `fractionOf(value, range)` is where a number is, from 0 to 1, `marksOf(range, most)` the numbers that get a mark, and `alongRail(point, middle, yaw)` how far along the rail a point of the table is. A game that draws a rail of its own uses them.

The way with the keyboard is the same as for a bid: the specimen has the platform's own controls under the scene, and a board gives the window, `askNumber`, beside the pieces.

### Settings

`STEPPER_SETTINGS` is read on every frame by every stepper: how long a held arrow waits before it repeats, how often, how much faster each repeat is, and how far an arrow rises under the pointer and sinks when it is pressed. `SLIDER_SETTINGS` has how far the knob rises under the pointer and when it is held, and how thick the rail is. The debug panel has a Stepper and a Slider folder for them ([Tuning](../04-build-a-game/07-tuning.md)).

## The windows

The windows of the platform are functions that give back a promise, from `@pbgo/core/components/game/prompt`: the board awaits what the player confirmed, or `null` when they close the window, and posts it as the game's action.

| Function | Asks for | Gives back |
| --- | --- | --- |
| `askText(prompt)` | A text, checked by `cleanText` ([Text field](11-text-field.md#the-window)) | The text, or null |
| `askNumber(prompt)` | A number in a range, on steps, with a stepper | The number, or null |
| `askChoice(prompt)` | One option among `options`; with `instant`, pressing an option confirms it | The option's value, or null |
| `askChoices(prompt)` | Several options, between the least and the most `many` says | The values in the order of the options, or null |
| `ask(prompt)` | Several fields at once, each with an `id`, a `kind` (`text`, `number`, `choice`) and its rules | The answers by `id`, or null |

- Every window has a `title` and a `description` that say what is asked, and two buttons whose words (`confirm`, `cancel`) the game gives in the player's language, English unless given. All of them are the game's words, from the view, the skin or Sanity, never a literal in the scene.
- A number is chosen with a stepper and the field beside it, which takes the arrow keys and the keyboard of the device; it is kept to the range and the steps, and what is not right is said under the field with the platform's wording of `INVALID_NUMBER`.
- Options that are a few words sit side by side; options with a line under them or a picture (`description`, `image`) are rows. An option that is `disabled` is there and cannot be chosen. A choice of several shows how many are chosen of how many may be.
- The window checks what the player confirmed with the same functions of the kit and the same rules, and gives back the cleaned answers. A window that is not right stays open and says which field is not.
- One window is open at a time: asking for another closes the first as cancelled. `PromptHost` draws the window, `GameHud` mounts it once. A button of the page can call any of these functions too, which is the way to a field with the keyboard and with a screen reader.

```ts
const bid = await ask({
  title: texts.bidTitle,
  fields: [
    { id: "count", kind: "number", label: texts.howMany, min: view.minCount, max: view.maxCount },
    { id: "face", kind: "choice", label: texts.whichFace, options: faces },
  ],
})
if (bid) post({ type: "bid", count: bid.count, face: bid.face })
```

### Not built

- A dial for a very wide range, and a long list of options that is searched.
- A window that shows what is picked on, a die or a card, instead of a label: the pick is made on the table, by clicking the die or the card, or by dragging it onto a zone ([Dragging](19-dragging.md)), or with the pieces of [the next section](#with-the-games-own-pieces).
- A window in the game's own look: the windows are the platform's, and a game that wants its own look asks on the table.
- A rule that a bid beats the last one, a bet that must differ from the others, a limit that depends on the state: each is the game's, in its engine.
