/**
 * The pages of the legal section, in the order the footer lists them and the order they are linked under each of them. The footer and
 * `LegalPage` both read this list, so a new page is added here once.
 */
export const LEGAL_PAGES = [
  { href: "/legal", title: "Legal Notice" },
  { href: "/legal/privacy", title: "Privacy Policy" },
  { href: "/legal/cookies", title: "Cookie Policy" },
  { href: "/legal/terms", title: "Terms of Use" },
] as const

export type LegalHref = (typeof LEGAL_PAGES)[number]["href"]
