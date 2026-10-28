import type { Metadata } from "next"
import { BlankPage } from "@/components/blank-page"

// Nothing on the page yet: it stays out of the search engines until it has something to say
export const metadata: Metadata = { title: "What's New", alternates: { canonical: "/whats-new" }, robots: { index: false } }

export default function WhatsNewPage() {
  return <BlankPage tab="whats-new" title="What's New" />
}
