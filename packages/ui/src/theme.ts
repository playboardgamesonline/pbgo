/**
 * Platform values that cannot read a CSS variable, because the browser needs them before (or outside) the stylesheet.
 * Each one copies a token of `styles/platform.css`; `theme.test.ts` fails when they drift apart.
 */

/** `<meta name="theme-color">` of the platform pages: the `--background` token (neutral-950, the black of the platform). */
export const PLATFORM_THEME_COLOR = "#060606"
