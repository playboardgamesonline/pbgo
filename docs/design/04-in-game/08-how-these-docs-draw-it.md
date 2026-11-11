# How these docs draw it

These pages are the one place where the site shows the in-game UI. Two games (Courtisans and the template) are drawn side by side, each inside a `GameScope` (`apps/web/src/app/(hub)/docs/_specimens/game-scope.tsx`) that resets the platform's values (Geist, weight, line-heights, tracking, radius) and sets the game's tokens and font stacks on its own wrapper, never on `:root`.

- The hub does not load `game.css`: `globals.css` points `@source` at the four pure components (`seat-label`, `players-strip-view`, `announcement-view`, `game-over-card`) and maps the utilities only games have (`font-display`, `bg-surface`, `bg-surface-dark`, `text-accent-game`) with `@theme inline`, which emits no variable. A new pure component drawn here needs its `@source` there.
- The font files of a game are not loaded on the hub, so its families fall to the next of the stack (Georgia, a serif); the colours, layout and motion are the real ones. The colors, the sizes and the texts are the code defaults of each game, not the values saved in its Sanity project.
- The compact layout of a short screen (the `short` variant, a phone held sideways) is keyed on the viewport and is not drawn here ([Compact layout](../01-guidelines/04-in-game-rules.md#compact-layout)).
- Use `data-look`, never `data-game` (analytics counts the hub links that carry it).

## Pure views and connected wrappers

The announcements (`announcement-view.tsx`, which `AnnouncementPresence` wraps in `AnimatePresence`; `announcement.tsx` adds the sound, leva and the game), the end screen (`game-over-card.tsx`; `game-over.tsx` reads the game, shares the result, votes for the rematch and asks for the rank points) and the strip (`players-strip-view.tsx`; `players-strip.tsx`) take props only, so these docs draw the very same markup as the games. A change goes into the view; the specimens follow by themselves.
