import type { CSSProperties } from "react"
import type { Specimens } from "@pbgo/docs/markdown"
import { Button } from "@pbgo/ui/platform/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@pbgo/ui/platform/card"
import { Input } from "@pbgo/ui/platform/input"

/*
 * A deliberate illustration of the game layer, the only place of the docs that names a colour or a font: a real skin
 * sets these same names on <html> (`themeStyle()` in `@pbgo/core/lib/settings` from the game's Sanity settings, and the
 * `:root` of `packages/core/styles/game.css`). The values are made up and exist on this page only.
 */
const SIMULATED_SKIN = {
  "--primary": "oklch(0.78 0.14 75)",
  "--primary-foreground": "oklch(0.2 0.03 75)",
  "--radius": "0.25rem",
  "--font-body": "Georgia, serif",
} as CSSProperties

function CreateATable() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Create a table</CardTitle>
        <CardDescription>Two to five players, about 30 minutes.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <Input placeholder="Your nickname" aria-label="Nickname" />
        <div className="flex gap-2">
          <Button>Create</Button>
          <Button variant="outline">Join</Button>
        </div>
      </CardContent>
    </Card>
  )
}

function LayersSkin() {
  return (
    <div className="grid gap-6 md:grid-cols-2">
      <div className="flex flex-col gap-3">
        <p className="text-sm text-muted-foreground">Platform</p>
        <CreateATable />
      </div>
      <div className="flex flex-col gap-3">
        <p className="text-sm text-muted-foreground">Simulated game skin</p>
        {/* `font-sans` makes the font re-resolve here: `font-family` inherits as a computed value */}
        <div style={SIMULATED_SKIN} className="font-sans">
          <CreateATable />
        </div>
      </div>
    </div>
  )
}

export const guidelinesSpecimens: Specimens = {
  "layers-skin": LayersSkin,
}
