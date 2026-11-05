# Meter

Module: `@pbgo/ui/platform/meter`

A scale of a few levels drawn as bars of the same height, filled from the first bar up to the level pressed. Each bar is a button (`aria-pressed` on the picked level, and a label saying what it stands for), so the keyboard and a screen reader get what a pointer gets. Pressing the picked level again clears it, unless the scale is not `clearable`.

## Levels

With a mouse, the bars up to the pointer light up faintly before the press. `levels` is the number of bars.

```specimen
meter-levels
```

## Never empty

`clearable={false}` keeps the picked level when it is pressed again, for a scale that always has one.

```specimen
meter-never-empty
```
