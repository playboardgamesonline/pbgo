// The colours of the 3D specimens come from the platform's own tokens, never from a hex written here: a scene is art, but its floor is the page's grey and its pieces wear the colours of the pieces of the table (`--piece-*`). A token is a CSS expression, so the
// browser resolves it (a probe element), and one pixel of a canvas turns whatever it answers (`color(srgb ...)`, `oklab(...)`) into the sRGB bytes that a three.js material takes.

const resolved = new Map<string, string>()

/** The colour a CSS expression stands for on this page, as `#rrggbb`: `var(--card)`, `color-mix(in oklab, var(--success) 20%, var(--card))`. Browser only. */
export function cssColor(expression: string): string {
  const known = resolved.get(expression)
  if (known) return known
  const probe = document.createElement("span")
  probe.style.color = expression
  document.body.appendChild(probe)
  const computed = getComputedStyle(probe).color
  probe.remove()
  const canvas = document.createElement("canvas")
  canvas.width = canvas.height = 1
  const g = canvas.getContext("2d", { willReadFrequently: true })
  let hex = "#000000"
  if (g) {
    g.fillStyle = computed
    g.fillRect(0, 0, 1, 1)
    const [r = 0, green = 0, b = 0] = g.getImageData(0, 0, 1, 1).data
    hex = `#${[r, green, b].map((channel) => channel.toString(16).padStart(2, "0")).join("")}`
  }
  resolved.set(expression, hex)
  return hex
}

/** The font stack the page's text is set in, for the words painted on the table. */
export function pageFont(): string {
  return getComputedStyle(document.body).fontFamily
}
