import type { Metadata } from "next"

// Open to anyone with the link and out of the search engines (noindex on every page of it, absent from the sitemap, and no analytics: `isExcludedPath`): the docs are the team's and its agents' reference, and some of them
// name identifiers of the project's own services.
export const metadata: Metadata = { robots: { index: false, follow: false } }

/**
 * `/docs` is the way into the docs (`page.tsx`: a card for each doc under a slim top with the logo, with no navbar) and each doc has a shell of its own (`[section]/layout.tsx`: its side menu next to its pages), so this
 * layout draws nothing. It is where all of them become `noindex`.
 */
export default function DocsLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children
}
