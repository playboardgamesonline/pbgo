# Text on the table

Text lies flat on the table as a texture painted on a canvas: nicknames, points, a counter. Per game: the template's `board/table-text.tsx`, `TableText`, is the reference.

## Props

| Prop | Role |
| --- | --- |
| `text` | What is written |
| `style` | A `TextStyle` ([Style](#style)) |
| `height` | The size of the letters, in world units |
| `position`, `yaw` | Where it lies and its turn about the vertical axis |
| `onClick`, `onHover` | Make the text a click target ([Clicks and hover](20-clicks-and-hover.md)) |
| `layer` | The render order |
| `children` | What sits before the text, in a frame whose origin is the text's left edge and whose x grows to the right, so a negative x is just left of the first letter |
| `trailing` | What sits after the text, in a frame whose origin is its right edge |

## Style

`TextStyle` is a `color` and optional effects, all painted into the texture:

| Field | Effect |
| --- | --- |
| `color` | The fill |
| `outline`, `glow` | A stroke around the letters, and a blur of colour around the stroke |
| `weight`, `spacing` | The font weight, and the letter spacing as a CSS length |
| `shadow` | A drop shadow, written as three parts joined by a bar: colour, blur and offset |
| `bloom`, `aura` | A soft light of that colour around the letters |
| `relief` | A stack of copies for depth, with a gloss and a shimmer |
| `holo` | Scan lines cut out of the letters, and a slow flicker |

## Rules

- The texture is painted again only when the text, the style or the readiness of the font changes, and the old one is disposed. The component waits for the font (`document.fonts`), or a fallback font would be frozen into the texture.
- The font is the `FONT` constant of the file; a game with its own font changes it there.
- The plane is larger than the letters, to leave room for the effects.
- The text takes pointer events only when it has `onClick` or `onHover`, and shows a pointer cursor only with `onClick` ([Clicks and hover](20-clicks-and-hover.md)).
- The template does not turn its plates toward each player: they read upright from the viewer's side. A game that wants them to follow its seats passes `yaw`.
- A label painted on the table is still the game's text: it comes from the view, the skin or Sanity, never a literal in the scene.
