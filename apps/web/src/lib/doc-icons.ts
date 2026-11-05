import { BookOpen01Icon, CodeIcon, CpuIcon, DiceIcon, PaintBoardIcon } from "@hugeicons/core-free-icons"

/**
 * The icons a doc can name in the front matter of its landing page (`icon: paint-board`): its card on the docs hub draws it. A doc that names none gets the book. A name that is not here stops the build, so a typo never ships;
 * a new doc that needs another icon adds it here.
 */
export const DOC_ICONS = {
  book: BookOpen01Icon,
  code: CodeIcon,
  cpu: CpuIcon,
  dice: DiceIcon,
  "paint-board": PaintBoardIcon,
} as const

export type DocIconName = keyof typeof DOC_ICONS

const isDocIcon = (name: string): name is DocIconName => name in DOC_ICONS

/** The icon of a doc from the name its front matter gave, or the book when it gave none. */
export function docIconOf(name: string | null) {
  if (name === null) return DOC_ICONS.book
  if (!isDocIcon(name)) throw new Error(`A doc names the icon "${name}" and the site has none of that name (${Object.keys(DOC_ICONS).join(", ")}): add it to apps/web/src/lib/doc-icons.ts, or correct the name`)
  return DOC_ICONS[name]
}
