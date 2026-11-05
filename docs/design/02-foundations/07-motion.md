# Motion

Three durations (`fast`, `base`, `slow`), one easing (`ease-standard`, quick to leave and slow to settle) and one spring. The durations and the easing are tokens of `platform.css`; the spring is only in JavaScript. Plain `transition` and `transition-colors` already use the base duration and the standard easing, so most components write neither. What CSS cannot do (a layout animation, a sequence) is done with `motion/react`, which reads the same numbers.

## Durations

```specimen
motion-durations
```

```specimen
token-table
--transition-duration-fast | duration-fast | Overlays entering and leaving: dialog, dropdown, popover.
--transition-duration-base | duration-base | The default of `transition` and `transition-colors`: hover and focus on controls.
--transition-duration-slow | duration-slow | Things that travel: the dock opening, the game card art zooming.
--ease-standard | ease-standard | The one easing.
```

## In JavaScript

`@pbgo/ui/motion` copies the durations and the easing in the units `motion/react` takes (`DURATION`, `EASE_STANDARD`); `motion.test.ts` fails when a copy drifts from `platform.css`. The values below are imported from it, not typed here.

```specimen
motion-javascript
```

`SPRING_TRAVEL` is for something that moves to a place it was not and must feel attached to the hand that asked, like the fill that glides between the tabs of the navbar: stiff, with no visible overshoot.

## When to move

- The platform moves in JavaScript only for what CSS cannot do: the fill behind the current item of the navbar, the social dock and its panels, a card that moves, the pieces of the home's title. Everything else is a CSS transition.
- An animation answers an action or says that something changed. Use the tokens, never a duration or an easing written in a component (the guard test rejects `duration-200`).
- Less motion is honoured everywhere. In CSS the durations become zero under `prefers-reduced-motion`, so no component checks. In JavaScript `Navbar` mounts `MotionConfig reducedMotion=user`, and an animation that starts by itself (the title's pieces) stays still.
- The games' UI shares the curve (`EASE_STANDARD`), not the durations: it has its own timings, read with `useMotion()` and tuned by `UI_THEME` (see [In-game UI](../04-in-game.md)).
