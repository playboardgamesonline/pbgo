import Link from "next/link"
import { Wordmark } from "@pbgo/ui/platform/wordmark"
import { AUTHOR, COPYRIGHT_YEAR, SITE_NAME } from "@/site"

/**
 * The footer of the hub's own pages (the home, the list of games, a game's page and the pages of the other tabs), as wide as the site, with no
 * margin and no maximum width. From the top: one row with the copyright and who built the site on the left and the legal pages on the right (Privacy
 * Policy, Cookie Policy, which is the cookies section of the legal notice, and Terms of Use: the choice of the cookie banner is reopened from that section
 * and from a game's settings menu, the footer has no link of its own for it), then the name of the brand as big letters (`Wordmark`, in the faces of the logo, fading
 * out, from edge to edge of the window) and, alone under them and centred, what the site is not: the finest print of the page (`fine-print`), a little
 * apart from the letters (`mt-3`). Each text has 4px of padding of its own (`p-1`) and the row 20px (`p-5`), so the texts are 24px from the edges of the window, like the
 * navbar's, and no more. There is no line between the parts. The privacy policy and the terms of use are pages that are not written yet.
 */
export function SiteFooter() {
  const link = "p-1 underline-offset-4 hover:text-foreground hover:underline"
  return (
    <footer className="w-full pb-5">
      <div className="flex flex-wrap items-center justify-between gap-x-8 gap-y-3 p-5 text-sm text-muted-foreground">
        <p className="p-1">
          © {COPYRIGHT_YEAR} {SITE_NAME} <span aria-hidden="true">·</span> Built by{" "}
          <a href={AUTHOR.url} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4 hover:text-foreground">
            {AUTHOR.name}
          </a>
        </p>
        <nav aria-label="Legal" className="flex flex-wrap items-center gap-x-3">
          <Link href="/privacy" className={link}>
            Privacy Policy
          </Link>
          <Link href="/legal#cookies" className={link}>
            Cookie Policy
          </Link>
          <Link href="/terms" className={link}>
            Terms of Use
          </Link>
        </nav>
      </div>
      <Wordmark />
      <p className="mx-5 mt-3 p-1 text-center fine-print">
        Unofficial, online adaptation of board games. All rights belong to their authors and the publisher.
      </p>
    </footer>
  )
}
