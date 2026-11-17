# The dots of presence

Module: `@pbgo/ui/platform/friends-panel`

A status is a shape, a colour and a word, never the colour alone. `PresenceDot` sits on the corner of a picture and takes the picture's size, cut out of it by a ring of `--cutout`. On a picture whose size is whatever its place allows (the row of players of the home: `scaled`), it is a share of the picture's width instead, in fractions of it (the cut-out, 3/10 of the width, and the dot 3/4 of the cut-out, so that its ring and the hole of the offline ring keep their proportions), so that it keeps its look from the smallest picture to the largest. It has one shape for each status of a friend (`FriendStatus`):

| Status | Word | Dot | Colour |
| --- | --- | --- | --- |
| `online` | Online (active) | a disc | green, `--presence-online` |
| `playing` | In a game | a disc with a play knocked out of it | blue, `--presence-playing` |
| `inactive` | Inactive | a moon | orange-yellow, `--presence-inactive` |
| `dnd` | Do not disturb | a disc with a bar knocked out of it | red, `--presence-dnd` |
| `offline` | Offline (away) | a thick ring | grey, `muted-foreground` |

Only the dot is coloured, never the text: under a name comes a line of quiet text (`text-muted-foreground`). The four colours are tokens (`bg-presence-*`, `text-presence-*`) that only a dot wears.

```specimen
presence-dots
```
