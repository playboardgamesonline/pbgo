import type { Metadata } from "next"
import { ComingSoonPage } from "@/components/coming-soon-page"

// Nothing to list yet: it stays out of the search engines until it has something to say
export const metadata: Metadata = { title: "Tournaments", alternates: { canonical: "/tournaments" }, robots: { index: false } }

export default function TournamentsPage() {
  return (
    <ComingSoonPage
      tab="tournaments"
      title="Tournaments"
      heading="No tournament yet"
      description="Brackets between friends, and public ones, are on their way. The tournaments in progress will be listed here."
    />
  )
}
