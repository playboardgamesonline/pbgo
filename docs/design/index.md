---
icon: paint-board
description: The colours, type and components every screen of Play Board Games Online is built from, and the rules for using them.
---

# Design

The tokens and components of `@pbgo/ui` in two layers, platform and game, with the rules for them. Every token and building block of the platform is shown here live: check them before building a screen. A page is not documented here, only what it is made of. Hub, account, legal, the docs, gamemaster and 404 are built from these and from nothing else; the in-game UI is not, each game draws it in its own look.

The platform's pieces are `@pbgo/ui/platform/*`, its tokens `@pbgo/ui/styles/platform.css` and the colour of its browser chrome `@pbgo/ui/theme`.

## Pages

- [Guidelines](01-guidelines/index.md): the principles, the two layers, how to add a component, the rules of the in-game UI.
- [Foundations](02-foundations/index.md): colour, type, radius, spacing, depth, glass and motion.
- [Components](03-components/index.md): controls, navigation, overlays, surfaces and the social panel, a page for each piece.
- [In-game UI](04-in-game.md): what every game shares around its board.

## How these pages are made

They are the markdown files of `docs/design/`, shown at `/docs/design`. A page is one token or one component, never a long scroll. A folder is a group of pages, with an `index.md` for its landing page, and a number in front of a name sets its place in the menu.

A live piece is a fenced block of the language `specimen`:

````md
```specimen
button-variants
```
````

The first line names a component registered in `apps/web/src/app/(hub)/docs/_specimens/`, one module for each group of pages; the lines after it, if any, are given to the specimen. A name nobody registered, or a registered name no page shows, stops the build. A new component follows [Adding a component](01-guidelines/03-adding-a-component.md).

A page says a rule in a line and names the token or the utility that holds the value; it never writes the value itself (a size, a spacing, a duration, a percentage), which the token and a live specimen show, nor a long text on how a choice came about.
