/**
 * The plans of the Pricing page: a free one and two paid ones, at 0.99 and 3.99 euros a month (Oré's prices). The names and the descriptions are a first draft of mine. What each plan
 * includes is Oré's for the expansions, the tournaments and the audio (said on 2026-10-30) and a first draft of mine for the rest, to be changed: nothing here is built or on sale yet
 * (the paid plans have a disabled "Coming soon" button), so no line may promise what a player could not get today without it being said. What is true of the free plan is what the site does now.
 */
export type Plan = {
  id: "free" | "plus" | "club"
  name: string
  /** Euros a month; 0 for the free plan. */
  price: number
  description: string
  /** What it includes, one line each; a paid plan starts with what the plan under it has. */
  features: readonly string[]
}

export const PLANS: readonly Plan[] = [
  {
    id: "free",
    name: "Free",
    price: 0,
    description: "Every game, with or without an account.",
    features: ["Play every game of the catalog", "No sign-up needed to join a table", "Tables with your friends, chat included", "Your profile and your last games"],
  },
  {
    id: "plus",
    name: "Plus",
    price: 0.99,
    description: "For players who come back.",
    features: [
      "Everything in Free",
      "Create games with premium expansions",
      "Play in tournaments",
      "In-game audio",
      "Your whole history and your statistics",
      "A badge next to your name",
      "Avatar frames and table colours",
    ],
  },
  {
    id: "club",
    name: "Club",
    price: 3.99,
    description: "For groups and organisers.",
    features: [
      "Everything in Plus",
      "Create tournaments, between friends or open to all",
      "Save your groups and invite them in one tap",
      "A first look at the new games",
      "A say in which games come next",
    ],
  },
]

/** A price as it is written on the page: `€0`, `€0.99`, `€3.99` (the whole euros have no cents). */
export const euro = (amount: number) => new Intl.NumberFormat("en", { style: "currency", currency: "EUR", minimumFractionDigits: 0 }).format(amount)
