# Aura

An aura is the light that glows on the table under a seat. Per game: the template's `board/aura.tsx` is the reference, a plane with a shader that a game copies. It lies flat over the mat and under the cards.

## Props

| Prop | Role |
| --- | --- |
| `width`, `depth` | The size of the lit area, in world units; the plane is a little larger so the glow can fade out |
| `position`, `yaw` | Where it lies, just above the mat, and its turn about the vertical axis |
| `force` | The strength, a number or a function read on every frame; it eases in and out |
| `color`, `light` | The colour of the edge, and the lighter colour of its glints |
| `additive` | Additive blending, on by default, which brightens what lies under it |
| `settings` | An `AuraSettings` object, read on every frame |

`AuraSettings` holds `intensity`, which multiplies `force`, and `edge`, `halo`, `stars`, `density`, `size` and `speed`: the ring along the edge, the halo outside it, the glints and how fast the light moves.

## Rules

- `force` follows the state, whatever it is: set it, and the component eases there. Near zero the mesh is not drawn at all, so an unlit aura costs nothing.
- It is a shader on a plane, with no texture. It is transparent, writes no depth and takes no pointer events ([Clicks and hover](20-clicks-and-hover.md)).
- `settings` is an object per use, so a debug panel can tune two uses apart: the file exports `ZONE_AURA_SETTINGS`, the default, and `WINNER_AURA_SETTINGS`, and `AURA_FIELDS` lists the knobs a debug folder can offer (not `intensity`).
- The template draws one aura under each seat's plate, in the seat's colour, with a force for the player whose turn it is and for the winners ([Turn change](21-turn-change.md)).
- The colour of a seat comes from the skin's `playerColors`, through the `color` function the scene is given.
