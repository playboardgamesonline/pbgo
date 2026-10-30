/**
 * The plans of the Pricing page: a free one and two paid ones, at 0.99 and 3.99 euros a month, a quarter less when a year is paid at once (Oré's prices and Oré's discount). The names and the descriptions are a first
 * draft of mine. What each plan includes is Oré's, from the lists they gave on 2026-10-30 (what Plus and Club share, what is Club's alone, a history of three months for the free plan and an unlimited one for the others), to be
 * changed: nothing here is built yet, and the paid plans cannot be taken, since the games are not licensed (`onSale`), so no line may promise what a player could not get today without it being said. What is true of the
 * free plan is what the site does now. The skins (avatar frames, table colours) are in no plan: they are to be sold in a shop, with a virtual currency. What the publishers will be paid is not said on the page.
 */
export type PlanId = "free" | "plus" | "club"

/** How a paid plan is paid: month by month, or a year at once, which costs `ANNUAL_DISCOUNT` less. */
export type Billing = "monthly" | "annually"

export type Plan = {
  id: PlanId
  name: string
  /** Euros a month when it is paid month by month; 0 for the free plan. */
  price: number
  description: string
  /** What it includes, one line each; a paid plan starts with what the plan under it has. */
  features: readonly string[]
  /** Whether it can be taken today. The paid plans cannot until the games are licensed: they are drawn faded, with a button that says so. */
  onSale: boolean
}

export const PLANS: readonly Plan[] = [
  {
    id: "free",
    name: "Free",
    price: 0,
    description: "For playing with friends.",
    features: ["Play every game of the catalog", "No sign-up needed to join a table", "Tables with your friends, chat included", "Your profile and 3 months of game history"],
    onSale: true,
  },
  {
    id: "plus",
    name: "Plus",
    price: 0.99,
    description: "For players who come back.",
    features: [
      "Everything in Free",
      "Create games with premium expansions",
      "Create tournaments between friends",
      "Play in tournaments",
      "A voice room during games",
      "Advanced statistics",
      "Unlimited game history",
    ],
    onSale: false,
  },
  {
    id: "club",
    name: "Club",
    price: 3.99,
    description: "For groups and organisers.",
    features: ["Everything in Plus", "Create tournaments open to all", "Early access to new games", "Enter contests organised by publishers", "A vote on the next games"],
    onSale: false,
  },
]

/** What a year costs less than twelve months: a quarter (Oré: "genre 25%"). */
export const ANNUAL_DISCOUNT = 0.25

/** Euros for a year paid at once: twelve months less the discount, to the cent. */
export const yearly = (price: number) => Math.round(price * 12 * (1 - ANNUAL_DISCOUNT) * 100) / 100

/** A price as it is written on the page: `€0`, `€0.99`, `€0.74` (the whole euros have no cents). */
export const euro = (amount: number) => new Intl.NumberFormat("en", { style: "currency", currency: "EUR", minimumFractionDigits: 0 }).format(amount)

/**
 * What a plan's card says about its price: the figure, what it is for after it, and how it is billed under it. A year at once is shown as the month it comes to (the plan is still "a month" to compare with the others)
 * with the whole year under it; the note is there for every plan, the free one's included, so that the buttons of the three cards stay level and nothing moves when the selector does.
 */
export function priceOf(plan: Plan, billing: Billing): { price: string; period?: string; note: string } {
  if (plan.price === 0) return { price: euro(0), note: "Nothing to pay" }
  if (billing === "annually") return { price: euro(yearly(plan.price) / 12), period: "/ month", note: `Billed ${euro(yearly(plan.price))} a year` }
  return { price: euro(plan.price), period: "/ month", note: "Billed monthly" }
}
