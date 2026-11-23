# Zone lights

Two lights that the table draws on its own surface, for a place that is lit and a lane that is open: an **aura**, a glow round a zone, and a **band of light** that lies on the table and fades away from one end. Both are shaders on a plane that lies flat on the table, take no click, and fade in and out as the strength a game gives them changes. A place that can be pressed is a `Hotspot` or a `DropZone` under them ([Dragging](19-dragging.md), [Floor buttons](25-floor-buttons.md)): the light says where, and the pointer is the hotspot's. The colours are the game's own; the table has none. Shared: `packages/table/src/floor/aura.tsx` and `light-band.tsx`, with what is pure in `zone-light.ts` and `zone-light.test.ts`.

Move the sliders: the glow changes strength, colour, stars and speed, and the two bands swell and fade.

```specimen
scene-zone-lights
```

## Aura

An aura is a glow round a rectangle of the table, such as the zone a player may play on, or the zone of the player who won. It is a rim of light with a slow wave and a chase of light going round it, a soft halo going out from it, and stars that twinkle along it, in a colour and a brighter colour that the game gives. It is drawn on a plane that is bigger than the zone by `AURA_SHAPE.reach` on every side, which is as far as the glow goes, and it fades out at the edge of that plane so that it has none.

| Prop of `AuraProps` | Role |
| --- | --- |
| `size` | `{ width, depth }`: the rectangle it goes round, in world units. The rim lies `AURA_SHAPE.inset` inside its edge, with corners of `AURA_SHAPE.radius` |
| `frame` | Where the zone lies and which way it faces, a `Spot` (the middle of the table, unturned, when not given) |
| `y` | How high it lies above the table (`AURA.height`): over the zone's own surface and under what stands on it |
| `strength` | How strong it is, 0 and up. 0 draws nothing and 1 is the usual glow. It settles on a new value in a fraction of a second (`AURA.settle`), and below `AURA.hidden` it is not drawn at all |
| `color`, `bright` | The colour of the glow (a warm gold), and the brighter one its rim and its stars turn to (a pale gold) |
| `additive` | It adds its light to the table (default), which a light glow needs. False lays it over the table, which a dark glow needs |
| `look` | A `Partial<AuraLook>`: how bright its `edge` is, how far its `halo` goes, how many `stars` there are, how closely they lie (`density`), how big they are (`size`), how fast it all moves (`speed`) and an `intensity` over it all. What is not given is `AURA_LOOK` |

- **Strength is a state.** A game says what the aura should be (0 for a zone that cannot be played on, 0.55 for one that can, 1 for one the pointer is over), and the aura follows. It never snaps.
- **Tuning.** The look is read on every frame, so the knobs a debug panel offers for it (`AURA_FIELDS`, with `useSettings`: [Tuning](../04-build-a-game/07-tuning.md)) move it live.
- **Reduced motion.** A visitor who asks for less motion (`usePrefersReducedMotion`) gets the glow still, at its strength at once: the wave, the chase and the twinkle stop, and it does not fade in.

## Light band

A band of light is a strip that lies on the table and is at its fullest at one end and fades away toward the other: the lane a card may be played along, the column of a table that is lit or put out. A light band adds its light to the table; a dark one lies over it (`additive` false) and is black or a deep colour.

| Prop of `LightBandProps` | Role |
| --- | --- |
| `frame` | Where its bright end lies and which way it runs from there, a `Spot`: along the frame's own -z, which is away from the viewer when it is not turned, so a yaw of half a turn (`Math.PI`) runs it toward the viewer |
| `width`, `length` | How wide it is along the frame's x and how long it is from its bright end to where it has faded out, in world units |
| `y` | How high it lies above the table (`BAND.height`) |
| `color`, `edge` | The colour of the band, and the colour of its two sides, a hair brighter or darker (`color` when not given) |
| `fade` | How fast it fades toward its far end: the power of what is left of its length (`BAND.fade`, 1.6). More is a shorter band |
| `strength` | How strong it is, 0 and up (`BAND.strength`, 0.85). 0 draws nothing, and it settles on a new value in a fraction of a second (`BAND.settle`) |
| `pulse`, `speed` | How much it swells and dims, as a share of its strength (`BAND.pulse`, 0.15), and how fast, in radians a second (`BAND.speed`, 1.6): `bandTarget` |
| `additive` | It adds its light to the table (default). False lays it over the table |

- **Steady for a visitor who asks for less motion.** The pulse stops and the band takes its strength at once.
- **A band takes no click.** A lane that can be pressed is a `Hotspot` over the band, and the game raises the band's `strength` when the pointer is over it, so the light and the pointer are two things the game joins.
- **Both are flat.** They lie a hair over the table (`AURA.height` and `BAND.height`, 0.014), over the surface's pool of light and under the cards, which rest at `RESTING_HEIGHT`, so a card is never hidden by its own light. A light that lies over a bounded mat laid on the table (a playmat) is given a `y` above its thickness, and one that is to lie over the cards, a `y` above them.

## Limits

- The glow of an aura is a function of the distance to a rounded rectangle, so the zone it goes round is a rectangle, not an outline of any shape, and it lies flat. A glow round a card is the card's own state ([Cards](04-cards.md)), and a pool of light with no card in it is a `LightPool` of a hotspot.
- The stars are on a jittered grid in the zone's own frame and twinkle with the clock, so two auras of one look are the same stars.
- Neither takes a texture: the look is made of the shader's own functions and the colours, so a change of the game's colours is the whole of the work of dressing them.
