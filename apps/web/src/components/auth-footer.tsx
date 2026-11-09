import Link from "next/link"
import { LEGAL_PAGES } from "@/lib/legal-pages"
import { AUTHOR, COPYRIGHT_YEAR, SITE_NAME } from "@/site"

/**
 * The foot of the sign-in and the sign-up, quiet and at the left edge, in the way of a game launcher's: one line of small links, the legal pages (`LEGAL_PAGES`: Privacy Policy, Cookie Policy and Terms of Use; the choice of the cookie
 * banner is reopened from the Cookie Policy), and under it, in the finest print of the platform (`fine-print`), the copyright, who built the site and what the site is not. It has no brand lettering of its own: `AuthBackdrop` is behind the page.
 */
export function AuthFooter() {
  return (
    <footer className="flex flex-col gap-2 px-gutter pb-gutter">
      <nav aria-label="Legal" className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted-foreground">
        {LEGAL_PAGES.map((page) => (
          <Link key={page.href} href={page.href} className="underline-offset-4 hover:text-foreground hover:underline">
            {page.title}
          </Link>
        ))}
      </nav>
      <p className="fine-print">
        © {COPYRIGHT_YEAR} {SITE_NAME} <span aria-hidden="true">·</span> Built by{" "}
        <a href={AUTHOR.url} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4 hover:text-foreground">
          {AUTHOR.name}
        </a>
        . Unofficial, online adaptation of board games. All rights belong to their authors and the publisher.
      </p>
    </footer>
  )
}
