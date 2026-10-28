import type { Metadata } from "next"
import Link from "next/link"
import { Button } from "@pbgo/ui/platform/button"
import { ComingSoonPage } from "@/components/coming-soon-page"

// Nothing to list yet: it stays out of the search engines until it has something to say
export const metadata: Metadata = { title: "Tables", alternates: { canonical: "/tables" }, robots: { index: false } }

export default function TablesPage() {
  return (
    <ComingSoonPage
      tab="tables"
      title="Tables"
      heading="No table to join yet"
      description="Tables are private for now: open one from a game and share its link. The tables open to everyone will be listed here."
      action={
        <Button asChild variant="outline">
          <Link href="/games">Pick a game</Link>
        </Button>
      }
    />
  )
}
