# Mode switch

Module: `@pbgo/ui/platform/mode-switch`

The switch at the top of the signed-in home's play zone: one case for each thing the zone does, each with its icon and its name, and nothing else. It is a [segmented toggle group](10-toggle-group.md#segmented) a step bigger than the one of a form, and it fits what it holds: as wide as its cases and no wider than its column, centred, never the width of the page.

```specimen
mode-switch
```

- The thumb glides to the case that is picked, with the spring of the segmented group, and takes the corner of the case it is behind. It jumps when less motion is asked for.
- In a column too narrow for every name, the cases that are not picked are an icon alone and the picked one keeps its name. The name of every case is its `title` and is always there for a screen reader.
- A switch that is `disabled`, because a search is on, shows the case that is picked as strong as when it is set.
- It decides nothing: the cases are `options`, and `onValueChange` is how the page keeps the mode. `@pbgo/ui/play-zone` says what the home's four are: Normal, Ranked, Tournaments and Custom.
