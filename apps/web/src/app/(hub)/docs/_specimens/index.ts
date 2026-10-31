import type { Specimens } from "@pbgo/docs/markdown"
import { controlsSpecimens } from "./controls"
import { foundationsSpecimens } from "./foundations"
import { guidelinesSpecimens } from "./guidelines"
import { inGameSpecimens } from "./in-game"
import { navigationSpecimens } from "./navigation"
import { overlaysSpecimens } from "./overlays"
import { socialSpecimens } from "./social"
import { surfacesSpecimens } from "./surfaces"

/**
 * The live pieces of the site that the pages of `docs/` show, by name: a fenced block of the language `specimen` in a markdown file asks for one (`@pbgo/docs/markdown`), and the page draws it where the block stands. One module for each
 * page of the design docs, and a name belongs to one of them. A name that no page shows stops the build (`generateStaticParams` of the docs route), as does a page that shows a name that is not here.
 */
const FAMILIES: readonly Specimens[] = [guidelinesSpecimens, foundationsSpecimens, controlsSpecimens, navigationSpecimens, overlaysSpecimens, surfacesSpecimens, socialSpecimens, inGameSpecimens]

function merge(families: readonly Specimens[]): Specimens {
  const all: Record<string, Specimens[string]> = {}
  for (const family of families) {
    for (const [name, specimen] of Object.entries(family)) {
      if (name in all) throw new Error(`Two specimens are called ${name}`)
      all[name] = specimen
    }
  }
  return all
}

export const SPECIMENS: Specimens = merge(FAMILIES)
