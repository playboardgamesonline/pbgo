# Navbar

Module: `@pbgo/ui/platform/navbar`

The top of a page: two glass islands over a transparent bar, the brand and the tabs on the left (`NavbarStart`), the account on the right (`NavbarEnd`). The page shows through the bar and the pointer goes through it.

## Parts of the navbar

| Part | What it is |
| --- | --- |
| `Navbar` | The bar: transparent |
| `NavbarStart` | The left island: the brand, then the tabs |
| `NavbarEnd` | The right island: the account |
| `NavbarBack` | The way back, in an island of its own at the left of the first one |
| `NavbarBrand` | The home's button around the `Logo` |
| `NavbarTabs` | The tabs, next to the brand in the same island |
| `NavbarTab` | One tab, a link. `current` marks the page the visitor is in |
| `NavbarSeparator` | A hairline between two groups of tabs |

## On the home, signed out

On the home the logo is `current` and no tab is. `current` puts the bar's fill (`bg-muted`) behind the item, the same for the logo and for a tab; on any other page the logo is as quiet as a tab. Sign in is the ghost button and `Let's play` the primary one, both `lg`.

```specimen
navbar-signed-out
```

## On a tab's page, signed in

On the page of a tab, here Games, the tab has the fill and the logo is quiet. The account is an [`Avatar`](../04-surfaces/03-avatar.md) in place of the two buttons; what it opens is the page's business.

```specimen
navbar-signed-in
```

## Moving between the items

The fill behind the current item is one element for the whole bar (`layoutId` of `motion/react`): when the current item changes it glides to the next with `SPRING_TRAVEL` instead of jumping. It can only glide if the bar stays mounted from one page to the next, which is why the hub's layout mounts it once. `Navbar` mounts a `MotionConfig reducedMotion=user` (less motion gets the jump) and a `LayoutGroup` of its own, so two bars on one page do not trade the fill.

```specimen
navbar-moving
```

## The islands

- Each container is a glass island (`border glass shadow-surface`), a rounded square and not a capsule. It takes the pointer back from the bar.
- What an island holds is one step less round, the island's radius less its padding, so the corners stay concentric. `NavbarEnd` makes its buttons that radius too, so the page does not have to remember it.
- The bar spans the window, not `max-w-page`, so the islands sit on its edges.

## Placing the bar

The bar is `fixed` at the top so it stays in view. The page leaves `pt-navbar` under it, or lets the backdrop of its first screen run under the islands. An anchor that lands below it has `scroll-mt-navbar`.

## Tabs and groups

- The tabs leave the first island on a narrow screen, where the account needs the room: only the logo is left.
- `NavbarSeparator` splits the tabs for playing from the ones about the site, which leave the bar sooner, where there is no room for them next to the dock of a signed-in visitor.
- The links are plain `<a>` (`@pbgo/ui` is framework-free): a page passes its router's link with `asChild`.
