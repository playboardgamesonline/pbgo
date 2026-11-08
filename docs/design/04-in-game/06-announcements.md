# Announcements

Start, round, your turn, victory and defeat, full screen over the table, in five kinds (`start`, `round`, `turn`, `victory`, `defeat`). Same timeline for every game (the veil, the hairlines drawn from the centre, the title rising into focus, the subtitle). The presets and the timeline are in `lib/announcement-settings.ts`, pure and tested; `announcementSettings(preset, UI_THEME.announcement)` seeds them.

A defeat is for a table that lost together: the title alone, with no medallion, no confetti and no spring.

`UI_THEME.announcement` sets the font, the letters, the veil, the hairlines and the confetti (`font`, `color`, `outline`, `shadow`, `veil`, `rule`, `confetti`), and `UI_THEME.motion` the flourish: `calm` fades and short slides, `lively` adds springs and confetti. Reduced motion always wins: everything fades at once, 150 ms at most.

Sizes go through `vh()`, `calc(var(--vh, 1vh) * n)`: a screen reads the viewport, a stage that sets `--vh` (the specimen below, scaled down) sizes like a screen of its own height. The stage of the specimen is a 1280 × 720 reference screen scaled down.

```specimen
announcements
```
