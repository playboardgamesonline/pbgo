# Avatar

Module: `@pbgo/ui/platform/avatar`

A round marker for a player. It shows the picture when there is one (`AvatarImage`) and the initials otherwise (`AvatarFallback`).

## Sizes, badge and count

- Four sizes: `sm`, the default, `lg` and `xl`.
- `AvatarBadge` marks a state, at the bottom right.
- `AvatarCount` puts what waits for the person (messages not read, requests to answer) on the top right corner, as a [`notification`](../01-controls/02-badge.md) badge. It draws nothing for 0.

```specimen
avatar-sizes-badge-and-count
```
