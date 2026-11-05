# Glass

A container that floats over the page (a navbar island, the dock, a panel, a bar, a menu, a chat) is `glass`, a utility of `platform.css`: the grey of a card, partly translucent (`--glass-opacity`), over a blur (`--glass-blur`) that saturates what it blurs (`--glass-saturate`). The three settings are on `.platform` and the same for every container: no component picks a blur of its own. The one exception is the search bar, which uses the lighter `--card-bar` (see [The one grey](01-colors.md#the-one-grey)) so that it is read first. To change the glass of every container, change these variables or the `--card` mix, nowhere else.

## The settings, live

Move the settings on real components: an island of the navbar, the search bar, a panel. The search bar keeps its own grey, so only the blur and the saturation move it.

```specimen
glass-lab
```

## The cutout

What is cut out of a picture inside a container (the ring round a status dot: `AvatarBadge`, `AvatarCount`, `PresenceDot`) must be the colour of what the picture is on: not `background` but `--cutout` (`ring-(color:--cutout)`, `bg-(color:--cutout)`), which `glass` sets to the container's grey.
