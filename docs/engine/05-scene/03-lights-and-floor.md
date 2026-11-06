# Lights and floor

The room around the table is a flat colour on a plane that reaches past what the camera sees, and the lights are an ambient light and a sun. Shared: `packages/table/src/table/floor.tsx` and `lights.tsx`. A game asks for them with the `floor` and `lights` props of [Table](01-table.md); the components `Floor` and `Lights` are internal.

## Floor

| Field of `FloorProps` | Role |
| --- | --- |
| `color` | The colour of the room: the skin's dark surface, so the room matches the page behind the canvas |
| `size` | One number for a square, or width and depth; wider than anything the camera sees, so the table has no edge |

- The floor is the lowest thing on the table, just under the mat and the cards, so nothing sinks into it.
- It is unlit and takes no clicks ([Clicks and hover](20-clicks-and-hover.md)).
- Without `floor` the canvas shows the page behind it.
- The template passes the dark surface of its skin: `floor={{ color: props.floor }}`, fed from `theme.surfaceDark`.

## Lights

| Field of `LightsProps` | Role |
| --- | --- |
| `ambient` | The strength of the light that falls everywhere alike |
| `sun` | The strength of the sun, the light that gives lit materials their shade |
| `sunPosition` | Where the sun stands; it shines toward the middle of the table |

- `lights` set to `true` uses `DEFAULT_LIGHTS`; an object overrides the fields it names.
- Every material the package draws is unlit, so the lights show only on a material the game adds that reacts to light. A board of flat materials, like the template's, asks for none.
- Without `lights` the scene has no light at all.
