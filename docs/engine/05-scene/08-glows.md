# Glows

A glow is what a card lights up with: a halo behind it, an outline, a ring around its front, a band of shine. A game names the glows of its cards once with `defineGlows`, and a [Card](06-card.md) wears one at a time through its `glow` prop. Shared: `packages/table/src/card/glows.ts`.

## Parts

| Part | Type | Where it is drawn | Fields |
| --- | --- | --- | --- |
| `halo` | `Halo` | A soft light behind the card, reaching past it | `color`, `opacity`, `pulse` (how far the opacity swings), `speed`, `spread` (how far the light reaches, as a share of the smaller side), `blend` |
| `outline` | `Outline` | A solid line around the back | `color`, `visible` |
| `frame` | `Frame` | A ring around the front that breathes | `color`, `opacity`, `pulse`, `breath` (how much it swells), `speed` |
| `sparkle` | `Sparkle` | A band of shine with sparks that sweeps over the front | `opacity`, `speed` |

- `Glow` is an object of these parts. `GlowSpec` is what a game writes: each part says only what differs from the defaults, which live in `glows.ts`.
- `blend` of a halo is `"add"`, which brightens what is behind (a glow), or `"normal"`, which paints over it (a stain).
- `defineGlows` takes a record of specs and returns the glows under the same names.

Each of the first four cards wears one part, the last all four, all from `defineGlows`.

```specimen
scene-glows
```

## Rules

- A part a glow leaves out is not built at all. `{ frame: {} }` is a frame with every default.
- A card wears one glow at a time; a state that needs two looks at once is a glow of its own.
- Colours, opacities and speeds are read on every frame, so a debug panel can tune them live. `spread` and `blend` are read when the card is drawn.
- Every glow gets its own part objects: tuning one never moves another.
- Name a glow for its meaning in the game (`selection`, `gold`), not for its look.

From `template/src/components/board/glows.ts`:

```ts
export const GLOWS = defineGlows({
  selection: { frame: {} },
})
```
