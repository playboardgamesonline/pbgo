import type { Metadata } from "next"
import { ComingSoonPage } from "@/components/coming-soon-page"
import { ListSearch } from "@/components/page-search"
import { COMING_SOON } from "@/lib/coming-soon"

// Nothing to list yet: it stays out of the search engines until it has something to say
export const metadata: Metadata = { title: "Tournaments", alternates: { canonical: "/tournaments" }, robots: { index: false } }

export default function TournamentsPage() {
  return (
    <ComingSoonPage
      title="Tournaments"
      search={<ListSearch label="Search tournaments" placeholder="Search tournaments..." />}
      {...COMING_SOON.tournaments}
    />
  )
}
