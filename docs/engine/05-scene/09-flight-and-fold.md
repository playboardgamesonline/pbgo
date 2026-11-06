# Flight and fold

A flight takes a card from one pose to another along a curve, and a fold bends the card while it flies. Shared, and internal to `Card`: `packages/table/src/card/flight.ts` and `fold.ts`. A game reaches them through `Card` and the fields of `CARD_SETTINGS` ([Settings](06-card.md#settings)).

Send the card across; the sliders write into `CARD_SETTINGS`, and the next flight follows them.

```specimen
scene-flight
```

## Flight

- It starts from where the card is (position, orientation, scale) once the `delay` of the pose it flies from has passed; until then the card waits at that pose.
- Its duration and its height grow with the distance; `flightDuration` and `flightHeight` then scale them. `flightSeconds` and `flightLift` hold the two curves.
- The path is a cubic Bézier from the start to the target, with its control points above both ends (`bezier`). A card that is already high gets no extra lift.
- Along the way the card turns about the vertical axis and swells a little, both peaking mid-flight; its orientation and scale end exactly on the target's.
- The side it arches and turns toward is drawn at random for each flight, so two clients can differ. It is cosmetic, and `startFlight` takes the side as an argument, which is how tests pin it.
- `easing` names the curve of the clock, one of `EASING_NAMES` of core.
- The flight follows the `target` the card has on every frame, so a target that moves in mid-flight moves the landing.
- It lands exactly on the target pose, then `onArrive` is called.

## Fold

- While it flies the card arches along its height by the `foldable` setting times a sine of the flight, toward the side of the flight, and relaxes when it lands.
- The bend is done in the vertex shader of the front, the rim and the back (`applyFold`), which adds the uniforms `uFold`, `uHalfH` and `uDir`. A material is patched once, and the folded materials share one shader program.
- A shader needs triangles to bend: the function `foldable` cuts the card's geometry into small ones, once per geometry.
- What is drawn on the face rides above it by the height of the arch, or the arch would hide it ([`children` of Card](06-card.md#props)).

From `packages/table/src/card/flight.ts`, the arch that `stepFlight` writes on every step:

```ts
fold.value = settings.foldable * Math.sin(Math.PI * u) * v.direction
```

`bezier`, `startFlight`, `stepFlight`, `flightSeconds`, `flightLift`, `foldable` and `applyFold` are not exported; `flight.test.ts` and `fold.test.ts` state what they do.
