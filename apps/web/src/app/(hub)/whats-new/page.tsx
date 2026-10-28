import type { Metadata } from "next"
import { ComingSoonPage } from "@/components/coming-soon-page"

// Nothing to list yet: it stays out of the search engines until it has something to say
export const metadata: Metadata = { title: "What's New", alternates: { canonical: "/whats-new" }, robots: { index: false } }

export default function WhatsNewPage() {
  return (
    <ComingSoonPage
      tab="whats-new"
      title="What's New"
      heading="Nothing to read yet"
      description="The new games and the notes of each release will be posted here."
    />
  )
}
