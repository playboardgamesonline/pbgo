# Counters

A counter is a number of the state that goes up and down: the life of a player, the coins of a reserve, the clue tokens that are left, the victory points. The engine keeps the number, changes it between two ends and says what changed; the board draws it with a `Counter`, which counts up or down to each new value instead of jumping and floats what changed beside it. A counter is only a number, so a game draws it as digits, written on a piece, or as a stack of coins, and the same number can be all three at once. The table's side is `packages/table/src/counter/`, the engine's is `counters.ts` of the kit.

Gain, lose or win big, and move the number: the three drawings follow it.

```specimen
scene-counter
```

## The parts of a counter

| Part | What it is | Where it comes from |
| --- | --- | --- |
| Number | The value: a whole number between the ends the game gives | The state, changed with `changeCounter` |
| Ends | The least and the most it may be: none, one or both | The rules of the game, given to `changeCounter` |
| Words | How the number is written: "12", "12 / 20", "$12", in the visitor's language | `format` of the `Counter`, from the game's texts |
| Look | The dress of the letters, how big they are, what they lie on | `style`, `height`, `y`, and a `Piece` under the number |
| Change | What the last change was, "+3" | The counter works it out from the values it is given |

## In the engine

The state holds the number and nothing else: no text, no sign, no derived value ([Lean state](../01-the-game/09-state.md#lean-state)). `changeCounter` changes it between the ends of the rules and says what happened:

| Export | What it does | Errors |
| --- | --- | --- |
| `CounterRules` | `{ min?, max? }`, both optional: a reserve of coins has a least and no most | |
| `changeCounter(rules, value, delta)` | The counter changed by `delta` and held between the ends. A `Change`: `from`, `to`, `applied` (what really changed, with its sign) and `stopped` (`"min"` or `"max"`, the end that cut the change short, else `null`) | `RangeError` for ends that no number is between, a value or a change that is not a finite number, and a counter that is outside its ends |

```ts
// A player takes damage: the life stops at zero, and the log says how much was really taken
const hit = changeCounter({ min: 0, max: START_LIFE }, ctx.s.life[seat], -damage)
ctx.s.life[seat] = hit.to
ctx.events.push({ type: "damaged", seat, taken: -hit.applied, out: hit.stopped === "min" })
```

- `applied` is what the log should say. Damage of 5 on a life of 3 takes 3, and the "−3" that the board floats beside the number is the 3 that were really taken.
- Reaching an end exactly is not being cut short: 5 taken from 5 leaves 0 and `stopped` is `null`.
- A change that a player asks for goes through `cleanNumber` first ([Bets and choices](12-bets-and-choices.md)). `changeCounter` throws for what only a bug can send it, and a counter that is not between its ends is such a bug.
- A zero is a zero: the answer never holds a `-0`, which JSON would not keep apart from a `0` in the state.
- A counter and a track are one thing seen two ways, a number between two ends. A counter that is also a position, such as victory points along a score track, is a [track](15-tracks.md) with a marker on it.

## On the table

A `Counter` is shared: `packages/table/src/counter/counter.tsx`. The props are `CounterProps`:

| Prop | Role |
| --- | --- |
| `value` | The number the state says. The counter shows it at once when it first appears, then counts up or down to each new one |
| `at` | `{ x, z, yaw? }`: where the number lies, its middle, and the way it faces |
| `y` | How high above the table it lies, just over the surface by default: the height of what it lies on, to write a number on a piece |
| `height` | The size of the letters in world units (default 0.9) |
| `style` | How the letters are dressed, a `TextStyle` of [text on the table](09-score.md#text-on-the-table): the colour, an outline, a glow |
| `format` | How a number is written: `(value) => string`. The words and symbols are the game's own, in the visitor's language. Default: the number, with a true minus sign |
| `seconds` | The most seconds a change takes to count (default `COUNTER_SETTINGS.seconds`) |
| `change` | Shows what changed above the number, "+3" or "−2", which floats up and fades (default true). Changes that come one on the other are added up |
| `gain`, `loss` | The colour of a gain and of a loss when the change is shown |
| `onTick` | Called each time the number shown changes on the way, with it: a tick of sound |
| `onSettle` | Called when the number shown is the one the engine gave |
| `onClick`, `onHover` | Make the number a click target ([Clicks and hover](../01-the-game/05-actions.md#clicks-and-hover)) |

```tsx
<Counter value={view.life[seat]} at={lifeSpot(seat)} height={0.8} format={(life) => `${life} / ${START_LIFE}`} gain={green} loss={red} onTick={() => play("tick")} />
<Piece model="hex" size={2.2} at={tileSpot} color={gold} />
<Counter value={view.points} at={tileSpot} y={tileHeight} style={{ color: ink }} />
<Stack id="coins" count={view.coins} model="disc" color={gold} at={reserveSpot} />
```

### How a counter counts

- The first value is shown at once. Each new one is counted to from the number that is shown, so a change that comes while the counter is still counting goes on from where it is.
- Whole numbers are shown one by one, quickly at first and ever slower, the way a wheel stops. A change of a few counts is quick; a long one takes `seconds`, and shows at most `maxSteps` numbers on the way, so a jump of a hundred is not a hundred numbers.
- The number swells a little each time it changes and settles when the numbers stop.
- What changed floats up beside the number and fades, green for a gain and red for a loss. A change that comes while the last one is still floating is added to it. `change={false}` shows no change.
- A number that is not whole is shown at once, and a visitor who asks for less motion sees each new number at once, with no swelling and no change floating ([Motion](../../design/02-foundations/07-motion.md)).
- The letters are painted with `TableText`, so the counter is lit, turned and covered as the rest of the table is, and it takes the font of the table.

### Settings

`COUNTER_SETTINGS` is read on every frame by every counter: how long a change takes, how many numbers it shows, how much the number swells and how a change floats. The debug panel has a Counter folder for it ([Tuning](../04-build-a-game/07-tuning.md)).

### Not built

- A counter that the player changes by pressing a plus and a minus: the number is the state's, and a player asks the engine for a change with a [number field](12-bets-and-choices.md) or with buttons a game draws on [Paper](12-bets-and-choices.md#fields-that-open-a-window).
- A dial with a needle, a gauge or a bar that fills: a number on a [track](15-tracks.md) with a marker does the same, and a needle that swings is not drawn.
- Digits that roll like the wheels of an odometer.
- A counter that counts to a number that is not whole: it shows it at once.
