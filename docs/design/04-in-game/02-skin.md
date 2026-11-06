# Skin

`lib/skin.ts` (`loadSkin`, `useSkin`, `useText`) reads the game's skin from Sanity: `interface` (top and bottom art, character, pattern, host icon, player colors, desktop only) and `texts` (victory lines, the `UI_TEXTS` labels of `@pbgo/studio-kit/constants`).

A game's `DEFAULT_SKIN` only says how the skin behaves (player colours, desktop only), never a text or an image: a picture that is not in Sanity is not drawn, and a required text that is not there reads `[missing: <key>]` (see `docs/sanity-and-languages.md`).

## Accent font

The accent font (announcements, intro) is the CSS variable `--font-accent`, set by `themeStyle()` from the accent font file uploaded in Gamemaster › Visual (`settings.accentFontFile`, family `Site Accent`, served like the other uploaded fonts). A game with no file reads `var(--font-accent, var(--font-title))`, so the screens fall back to its title font. A game's CSS never declares a font file: fonts are Sanity files.
