# Text field

A text field is a place on the table that holds a few words and opens a window where the player writes them: a clue, a word, a title, a bet in words. The engine takes the text in one place, `cleanText`, which cleans it and checks its size, and keeps it in its state like any other value; the board lays a `TextField` on the table, and pressing it opens the platform's window (`askText`), where the player writes, checks and confirms. The kit's side is `packages/engine-kit/src/writing.ts`, the table's `packages/table/src/text-field/`, the window's `packages/core/components/game/prompt.ts` and `prompt-host.tsx`.

Press the left field, write a clue and confirm: the field shows it, and the right field shows what the others read. The button under the scene opens the same window, which is the way to it with the keyboard.

```specimen
scene-text-field
```

## In the engine

| Export | What it does | Errors |
| --- | --- | --- |
| `cleanText(input, rules)` | The text a player wrote, ready for the state: normalised, stripped of what cannot be shown or stored, with its spaces and lines tidied, and checked against the rules | `EngineError("INVALID_TEXT")` for anything that is not a string, is empty, or is longer, or has more lines or words, than the rules allow |
| `TextRules` | What a text must be like: the most characters (`max`, `DEFAULT_TEXT_MAX` by default), the fewest (`min`), the most lines (`lines`, one by default: a line break is a space) and the most words (`words`) | |
| `textKey(text)` | What two texts are compared by: without accents, case or anything that is not a letter or a digit | |
| `sameText(a, b)` | True when two texts are the same word once compared by `textKey` | |

- Call `cleanText` in `apply`, on the field of the action, and keep what it returns. The action is checked like any other: a missing field is `INVALID_ACTION`, a text that does not pass is `INVALID_TEXT`, a shared code that the platform words for the player ([The shared codes](../01-the-game/05-actions.md#the-shared-codes)).
- The text is never cut, only refused: the player sees that it was too long instead of reading words that were not theirs. The window checks the same rules before it closes, but only the engine's answer counts.
- What `cleanText` does is the same on the server and in the browser: it composes accents, turns every run of spaces into one, removes the control characters, the invisible ones that reorder or hide text (right-to-left overrides, zero-width spaces), the lone surrogates that `jsonb` refuses and the private use ones, keeps the joiners that emoji and some scripts need, cuts a stack of combining marks short, and counts characters the way a reader does (an emoji sequence is one).
- The state keeps the cleaned text as a string, with the rest of the state: lean, bounded by the rules, and gone with the table ([Lean state](../01-the-game/09-state.md#lean-state)). The view gives it to whoever may read it.
- A text everybody writes at once and reveals together (a clue, a title) is a `Submissions<string>` ([Simultaneous steps](../01-the-game/03-turns.md#simultaneous-steps)): the view says who wrote (`submittedFlags`), never what, until the step is resolved, and the log says the texts when they are revealed ([Events and the log](../01-the-game/12-events-and-the-log.md)).
- Rules about two texts, such as a clue that may not be a word of the board or two players who wrote the same word, compare them with `sameText`.
- What a player writes is read by the others. Nothing filters it: a game that needs a word list, or the platform's way to deal with a text that is abusive, is a decision of the product and not of this package ([Not built yet](../03-not-built-yet.md)).
- A game that keeps a text a player wrote stores something new about them: the inventory of personal data and the Privacy Policy change in the same pull request ([legal](../../legal.md)).

From `packages/engine-kit/src/writing.test.ts`:

```ts
cleanText("  e\u0301le\u0301phant ")                 // "éléphant"
cleanText("two\nlines", { lines: 1 })              // "two lines"
cleanText("two words", { words: 1 })               // throws INVALID_TEXT
sameText("Éléphant!", "elephant")                  // true
```

## On the table

A `TextField` is shared: `packages/table/src/text-field/text-field.tsx`. It is a piece of paper that lies on the table with a few words on it. The props are `TextFieldProps`:

| Prop | Role |
| --- | --- |
| `value` | The text in the field. The board owns it: the text the player confirmed, or a text another player wrote when the field is only read |
| `onChange` | Called with the text the player confirmed in the window, cleaned by the rules. Without it the field cannot be written in and only shows its text |
| `label` | What the field is called, in the game's words: the title of its window, and what a screen reader says of it |
| `hint` | A line in the window that says what to write, in the game's words |
| `placeholder` | Said in faint ink on the field while it is empty, and in the window |
| `rules` | What the text is checked against: the rules of the engine's `cleanText`, so that the engine does not refuse what the window accepted. They also decide how long the text may be and how many lines the window has |
| `confirm`, `cancel` | The words of the window's two buttons, in the game's language |
| `lines` | How many lines the field has on the table, the lines of `rules` unless given |
| `at` | `{ x, z, yaw? }`: where the field lies and the way it faces |
| `width`, `height` | Its size in world units; the default height follows the lines |
| `font`, `weight` | The CSS font of the letters, `TABLE_FONT` by default |
| `paper`, `ink`, `accent` | The colours of the paper, of the ink and of its edge under the pointer |
| `disabled` | Nobody can write in it now: the ink is dimmed and it does not open |

- The paper and the writing are painted on a canvas and lie on the table like the rest of the board, so the field is lit, turned and covered as a card is. Its edge takes the accent colour under the pointer when it can be written in.
- The letters are as big as a line is high, shrink until the text fits the lines the field has, and the text is cut, not drawn out of the paper, when it does not fit at the smallest size: choose `rules.max` for the size of the field.
- A field draws a text, and the words around it, the label, the hint and the placeholder, are the game's own: they come from the view, the skin or Sanity, never from a literal in the scene ([Text on the table](09-score.md#text-on-the-table)).
- A field with no `onChange` is how a text another player wrote is drawn, and it can be turned toward its seat with `yaw` like any text.

```tsx
const [clue, setClue] = useState("")

<TextField
  value={clue}
  onChange={(text) => {
    setClue(text)
    post({ type: "clue", text })
  }}
  label={texts.clueLabel}
  hint={texts.clueHint}
  placeholder={texts.cluePlaceholder}
  rules={{ max: 24, words: 1 }}
  at={{ x: 0, z: 2.4 }}
/>
```

## The window

`askText` of `@pbgo/core/components/game/prompt` opens the window and gives back what the player confirmed, or `null` when they close it. It is the platform's own, in its look, so every game asks for a text the same way: the title, a line that says what to write, a field with its counter, an error when the text is not allowed, and the two buttons. The props are `TextPrompt`:

| Prop | Role |
| --- | --- |
| `title`, `description` | The name of what is being written, and a line that says what to write, in the game's words |
| `value`, `placeholder` | The text the field starts with, and what it says while empty |
| `rules` | The rules of `cleanText`: the field stops at the most characters, becomes a text area for several lines, and the text is cleaned and checked when the player confirms; a text that is not allowed stays in the window with the platform's wording of `INVALID_TEXT` |
| `confirm`, `cancel` | The words of the two buttons, in the game's language |

- Enter confirms a field of one line, and Ctrl or Cmd with Enter a text area. Escape and the close button give back `null`. One window is open at a time: asking for another closes the first as cancelled.
- The window is DOM and the table is a canvas, where the context of the page does not reach, so `askText` is a plain function and `PromptHost` draws the window: `GameHud` mounts it, once. It is the same window as the ones that ask for a number or a choice ([Bets and choices](12-bets-and-choices.md#the-windows)).
- A button of the page can call `askText` too, which is the way to a field with the keyboard and with a screen reader: the field on the table is for the pointer, and the board gives the same action to a button of its own.

### Not built

- Cells to write in, as on the score sheet of a roll-and-write game (Yahtzee's pad, Qwixx, Welcome To): a sheet of cells that are marked or filled is a board, and no tool draws one ([Not built yet](../03-not-built-yet.md)).
- Drawing: a canvas where a player draws strokes, for Telestrations or Pictionary.
- A list of the words that may not be written, and a way to report a text: see the Privacy Policy and the moderation of the platform before a game with free text goes live.
