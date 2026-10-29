import type { Metadata } from "next"
import { ComingSoonPage } from "@/components/coming-soon-page"
import { COMING_SOON } from "@/lib/coming-soon"

// Nothing to list yet: it stays out of the search engines until it has something to say
export const metadata: Metadata = { title: "What's New", alternates: { canonical: "/whats-new" }, robots: { index: false } }

export default function WhatsNewPage() {
  return (
    <ComingSoonPage
      title="What's New"
      {...COMING_SOON.whatsNew}
    />
  )
}
