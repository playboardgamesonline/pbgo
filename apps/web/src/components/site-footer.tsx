import Link from "next/link"
import { ConsentLink } from "@pbgo/analytics/client"
import { Wordmark } from "@pbgo/ui/platform/wordmark"
import { AUTHOR, COPYRIGHT_NAME, COPYRIGHT_YEAR } from "@/site"

/**
 * The footer of the hub's own pages (the home, the list of games, a game's page and the pages of the other tabs), as wide as the site, with no
 * margin and no maximum width. From the top: one row with the copyright and who built the site on the left and the legal pages on the right (Privacy
 * Policy, Cookie Policy, which is the cookies section of the legal notice, Terms of Use and, only where analytics are on, Cookie settings, which
 * reopens the choice of the cookie banner and which the legal notice points to), then the name of the brand as big letters (`Wordmark`, in the faces of the logo, fading
 * out, from edge to edge of the window) and, alone under them and centred, what the site is not: the finest print of the page (`fine-print`), well
 * apart from the letters. There is no line between the parts. The privacy policy and the terms of use are pages that are not written yet.
 */
export function SiteFooter() {
  const link = "underline-offset-4 hover:text-foreground hover:underline"
  return (
    <footer className="w-full pb-5">
      <div className="flex flex-wrap items-center justify-between gap-x-8 gap-y-3 px-gutter pb-12 text-sm text-muted-foreground">
        <p>
          © {COPYRIGHT_YEAR} {COPYRIGHT_NAME} <span aria-hidden="true">·</span> Built by{" "}
          <a href={AUTHOR.url} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4 hover:text-foreground">
            {AUTHOR.name}
          </a>
        </p>
        <nav aria-label="Legal" className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <Link href="/privacy" className={link}>
            Privacy Policy
          </Link>
          <Link href="/legal#cookies" className={link}>
            Cookie Policy
          </Link>
          <Link href="/terms" className={link}>
            Terms of Use
          </Link>
          <ConsentLink className={`cursor-pointer ${link}`}>Cookie settings</ConsentLink>
        </nav>
      </div>
      <Wordmark />
      <p className="mt-16 px-gutter text-center fine-print">
        Unofficial, online adaptation of board games. All rights belong to their authors and the publisher.
      </p>
    </footer>
  )
}
