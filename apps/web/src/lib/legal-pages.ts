/**
 * The pages the footer lists, in order, and the pages linked under each legal page: the privacy policy, the cookie policy and the terms of
 * use, each a page of its own under `/legal`. The footer and `LegalPage` both read this list, so a new page is added here once. The legal
 * notice, `/legal`, is not in it: nothing links to it for now (see the page).
 */
export const LEGAL_PAGES = [
  { href: "/legal/privacy", title: "Privacy Policy" },
  { href: "/legal/cookies", title: "Cookie Policy" },
  { href: "/legal/terms", title: "Terms of Use" },
] as const

/** A page of the legal section: the three of the footer, and the notice that it does not list. */
export type LegalHref = (typeof LEGAL_PAGES)[number]["href"] | "/legal"
