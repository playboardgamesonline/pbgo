import type { Metadata } from "next"
import { BlankPage } from "@/components/blank-page"

// Nothing on the page yet: it stays out of the search engines until it has something to say
export const metadata: Metadata = { title: "Tournaments", alternates: { canonical: "/tournaments" }, robots: { index: false } }

export default function TournamentsPage() {
  return <BlankPage tab="tournaments" title="Tournaments" />
}
