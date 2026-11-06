# Lights

The lights of a table are an ambient light and a sun. Shared: `packages/table/src/table/lights.tsx`. A game asks for them with the `lights` prop of [Table](01-table.md); the component `Lights` is internal.

## Props

| Field of `LightsProps` | Role |
| --- | --- |
| `ambient` | The strength of the light that falls everywhere alike |
| `sun` | The strength of the sun, the light that gives lit materials their shade |
| `sunPosition` | Where the sun stands; it shines toward the middle of the table |

## Rules

- `lights` set to `true` uses `DEFAULT_LIGHTS`; an object overrides the fields it names.
- Every material the package draws is unlit, so the lights show only on a material the game adds that reacts to light. A board of flat materials, like the template's, asks for none.
- Without `lights` the scene has no light at all.
