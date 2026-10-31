import type { ComponentProps } from "react"
import {
  Album01Icon,
  BalanceScaleIcon,
  BoxingGloveIcon,
  Brain01Icon,
  BubbleChatIcon,
  CardExchange01Icon,
  ChessKnightIcon,
  Coins01Icon,
  Delete02Icon,
  DiceIcon,
  HandHelpingIcon,
  HandshakeIcon,
  Idea01Icon,
  Knife01Icon,
  Layers01Icon,
  Link01Icon,
  MaskIcon,
  PartyPopperIcon,
  Route01Icon,
  Tag01Icon,
  VoteIcon,
} from "@hugeicons/core-free-icons"
import type { HugeiconsIcon } from "@hugeicons/react"

/** What an icon of the platform is: the data that `HugeiconsIcon` draws. */
export type CategoryIcon = ComponentProps<typeof HugeiconsIcon>["icon"]

/**
 * The icon of each category of the games (the categories of the platform's Sanity project, `docs/catalog.md`), by name in lower case. A placeholder: the day the hub reads the icon, the colour
 * and the description that a category has in the Studio, the name of a category finds them there and this goes away. Until then a category
 * that is not here, a new tag, has the plain tag.
 */
const ICONS: Readonly<Record<string, CategoryIcon>> = {
  alliances: HandshakeIcon,
  ambiance: PartyPopperIcon,
  asymmetrical: BalanceScaleIcon,
  betrayal: Knife01Icon,
  collection: Album01Icon,
  cooperation: HandHelpingIcon,
  deduction: Idea01Icon,
  discard: Delete02Icon,
  draft: CardExchange01Icon,
  folds: Layers01Icon,
  "hidden role": MaskIcon,
  majority: VoteIcon,
  management: Coins01Icon,
  memory: Brain01Icon,
  negotiation: BubbleChatIcon,
  plotting: Route01Icon,
  "push your luck": DiceIcon,
  "semi-cooperation": Link01Icon,
  strategy: ChessKnightIcon,
  "take that": BoxingGloveIcon,
}

/** The icon of a category, by its name as the Studio spells it; the tag for one that has none yet. */
export function categoryIcon(name: string): CategoryIcon {
  return ICONS[name.trim().toLowerCase()] ?? Tag01Icon
}
