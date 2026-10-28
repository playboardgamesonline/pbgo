import Link from "next/link"
import { ConsentLink } from "@pbgo/analytics/client"
import { Separator } from "@pbgo/ui/platform/separator"
import { Wordmark } from "@pbgo/ui/platform/wordmark"
import { AUTHOR, COPYRIGHT_NAME, COPYRIGHT_YEAR } from "@/site"

/**
 * The footer of the hub's own pages (the home, the list of games, a game's page and the pages of the other tabs): the name of the brand as big
 * letters behind everything (`Wordmark`, in the faces of the logo, fading out), then, under a line, the copyright and who built the site on the left,
 * the legal pages on the right, and what the site is not, centred under them: the smallest, thinnest and faintest line of the page. The Cookie settings link is there only where
 * analytics are on: it reopens the choice of the cookie banner, which the legal notice points to. The cookie policy is the cookies section of
 * the legal notice; the privacy policy and the terms of use are pages that are not written yet.
 */
export function SiteFooter() {
  const link = "underline-offset-4 hover:text-foreground hover:underline"
  return (
    <footer className="mx-auto w-full max-w-page px-gutter pb-10">
      <Wordmark />
      <Separator className="mt-6 mb-6" />
      <div className="flex flex-wrap items-center justify-between gap-x-8 gap-y-3 text-sm text-muted-foreground">
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
      <p className="mt-8 text-center text-xs font-light text-foreground/50">
        Unofficial, online adaptation of board games. All rights belong to their authors and the publisher.
      </p>
    </footer>
  )
}
