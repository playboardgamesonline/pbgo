import type { ReactNode } from "react"
import type { LegalHref } from "@/lib/legal-pages"
import { LegalPage, LegalText } from "./legal-page"

/**
 * A legal page whose text is not written yet (the privacy policy, the terms of use), in the frame of the other legal pages: its title and a
 * line that says so and points to what exists. The footer links to it, so a visitor never meets a dead link. The text is the owner's to
 * write (or to have written), not the code's: when it exists, the page replaces this component.
 */
export function LegalStubPage({ title, href, children }: { title: string; href: LegalHref; children: ReactNode }) {
  return (
    <LegalPage title={title} href={href}>
      <LegalText>{children}</LegalText>
    </LegalPage>
  )
}
