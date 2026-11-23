/** The scale of a lettering on the table: a pixel of the canvas it is painted on is `height / TEXT_PX` world units, `height` being the lettering's size. `TableText`, and whatever measures what it draws, share it */
export const TEXT_PX = 155

/**
 * How much a lettering of `height`, painted `textWidth` canvas pixels wide, shrinks to be no wider than `maxWidth` world units: 1 when it fits or when there is no room to keep to, less when it does not. The lettering keeps its proportions, so a longer
 * text is smaller, never cut.
 */
export function fitScale(textWidth: number, height: number, maxWidth?: number): number {
  if (maxWidth === undefined || !(maxWidth > 0)) return 1
  const natural = (textWidth * height) / TEXT_PX
  return natural > maxWidth ? maxWidth / natural : 1
}

