// The platform's four display faces: the typefaces of the logo's four letters. A module of its own, not the file of `FaceCycle`, so that a server
// page can read the list (a value exported from a client component is not one a server component can use).

/**
 * The faces in the order the title's word goes through them. `utility` is the class of `styles/platform.css` that holds the family, the weight
 * and the size of the face; `fontsource` is the package that `apps/web/src/app/globals.css` imports it from; `letter` is the letter of the logo
 * that is drawn in it. The first is the most legible in capitals: it is the one a visitor reads before anything turns.
 */
export const DISPLAY_FACES = [
  { utility: "display-unkempt", typeface: "Unkempt", fontsource: "@fontsource/unkempt", letter: "B" },
  { utility: "display-jersey", typeface: "Jersey 15", fontsource: "@fontsource/jersey-15", letter: "G" },
  { utility: "display-fraktur", typeface: "UnifrakturMaguntia", fontsource: "@fontsource/unifrakturmaguntia", letter: "P" },
  { utility: "display-birthstone", typeface: "Birthstone Bounce", fontsource: "@fontsource/birthstone-bounce", letter: "O" },
] as const
