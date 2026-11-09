import type { ReactNode } from "react"
import Link from "next/link"
import { Logo } from "@pbgo/ui/platform/logo"
import { AuthBackdrop } from "@/components/auth-backdrop"
import { AuthFooter } from "@/components/auth-footer"
import { SITE_NAME } from "@/site"

/**
 * The page of the sign-in and the sign-up, the way a game launcher has it: no navbar (`currentOf` of the header draws none on these two addresses), the logo alone at the top left, leading home, the card in the middle of the page on the
 * page's black with the brand's lettering behind it (`AuthBackdrop`), and the quiet foot of the page (`AuthFooter`). The page is as tall as the window, less the room of the cookie banner (`--consent-h`), and grows when the card is taller than that.
 * Both pages put their card in it, so the two stay the same page.
 */
export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="relative isolate flex min-h-[calc(100svh-var(--consent-h,0px))] flex-col overflow-hidden">
      <AuthBackdrop />
      <header className="px-gutter pt-gutter">
        <Link href="/" aria-label={SITE_NAME} className="inline-flex rounded-lg text-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/30">
          <Logo className="h-10" />
        </Link>
      </header>
      <main className="flex flex-1 items-center justify-center px-gutter py-6">{children}</main>
      <AuthFooter />
    </div>
  )
}
