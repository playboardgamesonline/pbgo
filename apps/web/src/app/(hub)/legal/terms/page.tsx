import type { Metadata } from "next"
import Link from "next/link"
import { LegalStubPage } from "@/components/legal-stub-page"

// Nothing to read yet: it stays out of the search engines until it has a text
export const metadata: Metadata = { title: "Terms of Use", alternates: { canonical: "/legal/terms" }, robots: { index: false } }

export default function TermsPage() {
  return (
    <LegalStubPage title="Terms of Use" href="/legal/terms">
      This page is being written. What the site keeps on your device and what it measures is in the{" "}
      <Link href="/legal/cookies" className="text-foreground underline underline-offset-4">
        Cookie Policy
      </Link>
      .
    </LegalStubPage>
  )
}
