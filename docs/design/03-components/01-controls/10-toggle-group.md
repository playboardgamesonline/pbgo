# Toggle group

Module: `@pbgo/ui/platform/toggle-group`

A set of chips to pick one from, for a short list of choices that all stay in view. The arrow keys move between the chips, and the group is one stop of the Tab key.

## Single

A picked chip turns primary. A second click on the picked chip unpicks it, and the value then reads as an empty string. Name each group with an `aria-label`.

```specimen
toggle-group-single
```

## Segmented

`variant="segmented"` puts the chips in one container, as the tabs of a tab list are, with a primary thumb that glides to the picked chip (`SPRING_TRAVEL`; it jumps when less motion is asked for). For a choice of a few words that a form is about, such as a speed. A chip that should be narrower, an icon alone, is `fit`; its name is then for a screen reader and the pointer (`aria-label`, `title`). The thumb takes the corner of the chip it is behind, so a taller chip, such as the [mode switch](16-mode-switch.md)'s, gives it the corner it sets.

```specimen
toggle-group-segmented
```
