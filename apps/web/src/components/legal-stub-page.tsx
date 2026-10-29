import type { ReactNode } from "react"
import Link from "next/link"
import { SITE_NAME } from "@/site"

/**
 * A legal page whose text is not written yet (the privacy policy, the terms of use), in the layout of the legal notice: a link back, its title,
 * and a line that says so and points to what exists. The footer links to it, so a visitor never meets a dead link. The text is the owner's to
 * write (or to have written), not the code's: when it exists, the page replaces this component.
 */
export function LegalStubPage({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main className="mx-auto flex min-h-[calc(100svh-var(--consent-h,0px))] w-full max-w-reading flex-col gap-8 px-gutter py-section">
      <div className="flex flex-col gap-2">
        <Link href="/" className="text-sm text-muted-foreground underline-offset-4 hover:underline">
          {SITE_NAME}
        </Link>
        <h1 className="font-heading text-3xl">{title}</h1>
      </div>
      <p className="text-muted-foreground">{children}</p>
    </main>
  )
}
