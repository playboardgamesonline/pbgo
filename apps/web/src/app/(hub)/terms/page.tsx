import type { Metadata } from "next"
import Link from "next/link"
import { LegalStubPage } from "@/components/legal-stub-page"

// Nothing to read yet: it stays out of the search engines until it has a text
export const metadata: Metadata = { title: "Terms of Use", alternates: { canonical: "/terms" }, robots: { index: false } }

export default function TermsPage() {
  return (
    <LegalStubPage title="Terms of Use">
      This page is being written. What the site stores and measures is in the{" "}
      <Link href="/legal" className="text-foreground underline underline-offset-4">
        legal notice
      </Link>
      .
    </LegalStubPage>
  )
}
