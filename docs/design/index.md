# Design system

The design system of the platform and of the games: the two token layers of `@pbgo/ui` (platform and game), the palette, the components and the rules for them. Every token and every component of the platform is shown here live, as it renders today, with the rules that go with it: check them before building a screen. Hub, account, legal, the docs, gamemaster and 404 are built from these and from nothing else. The in-game UI is not: it is drawn in the look of each game, because each game owns its universe.

The platform's pieces are `@pbgo/ui/platform/*`, its tokens `@pbgo/ui/styles/platform.css` and the colour of its browser chrome `@pbgo/ui/theme`.

## Pages

- [Guidelines](01-guidelines.md): the rules of the platform UI and of the in-game UI: the principles, the two layers and the boundary between them, how to add a component, the guards, the rules of the in-game UI.
- [Foundations](02-foundations.md): the tokens the platform's look is made of: colour, type, radius, spacing, depth, glass and motion.
- [Components](03-components/index.md): the pieces of the platform, in five pages by what they do: [Controls](03-components/01-controls.md), [Navigation and brand](03-components/02-navigation.md), [Overlays](03-components/03-overlays.md), [Surfaces and data](03-components/04-surfaces.md) and [Social](03-components/05-social.md).
- [In-game UI](04-in-game.md): what every game shares around its board, drawn in the look of two games side by side: each game owns its universe, the platform's look stops at the table's edge.

## How these pages are made

The pages are the markdown files of `docs/design/`, shown at `/docs/design`. A folder of it is a group of pages (`03-components/`), a number in front of a file name (`01-controls.md`) sets its place in the menu and is not part of its address, and the side menu lists the sections of the page that is open: its `##` headings, which are also its anchors.

A live piece of the site is embedded where it is explained, with a fenced block of the language `specimen`:

````md
```specimen
button-variants
```
````

The first line is the name of a specimen: a component registered in `apps/web/src/app/(hub)/docs/_specimens/`, one module for each page. The lines after the name, when there are some, are given to the specimen (the token tables use them for their rows). A page that shows a name nobody registered, or a registered name that no page shows, stops the build.

A new section is a `##` heading in the page that fits, with its specimens, and a new component follows [Adding a component](01-guidelines.md#adding-a-component).
