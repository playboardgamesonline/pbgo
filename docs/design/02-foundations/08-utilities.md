# Utilities

Utilities the platform adds on top of Tailwind. Anything else is Tailwind's own scale, read through the [tokens](index.md).

| Utility | Does | Token |
| --- | --- | --- |
| `px-gutter`, `py-section`, `pb-section` | Side padding of a page, rhythm between sections | `--gutter`, `--section` |
| `max-w-page`, `max-w-reading` | Width of a page, width of running text | `--container-page`, `--container-reading` |
| `shadow-surface`, `shadow-float`, `shadow-overlay` | The three heights of a surface | `--shadow-*` |
| `display-title` | The home's title: sentence case, strong weight, tight tracking, the full colour of the text | `--text-display`, `--tracking-display` |
| `page-title` | The title of Games, Tables and Tournaments: one line, strong weight, no fade | `--text-page-title`, `--tracking-display` |
| `title-piece`, `title-cards` | The pieces that stand for letters in the home's title, and the two cards after its last word | `--piece-*` |
| `glass` | A container that floats over the page | `--card`, `--cutout` |
| `fine-print` | The finest print of a page: the footer's line on what the site is not | `--text-xs`, `--foreground` |
| `duration-fast`, `duration-base`, `duration-slow` | Duration of a transition | `--transition-duration-*` |
| `ease-standard` | The easing of a transition | `--ease-standard` |
| `bg-scrim` | Dimming layer behind a dialog | `--color-scrim` |
| `bg-secondary-hover` | Hover state of a `secondary` surface | `secondary` mixed with `foreground` |
| `font-heading` | Heading font | `--font-title` |
| `pattern-checker` | Checkerboard that makes translucency visible | `foreground` |

## Text selection

The platform is an app, not a document: `user-select: none` is on `.platform`. Three things can be selected all the same: a field, a code sample (`pre`, `code`), and whatever carries `data-selectable` or the `select-text` class, a table code to copy for instance. `platform.test.ts` keeps both rules. These docs opt in with `data-selectable`.
