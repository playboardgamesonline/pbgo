import type { Metadata } from "next"
import Link from "next/link"
import { Button } from "@pbgo/ui/platform/button"
import { ComingSoonPage } from "@/components/coming-soon-page"
import { COMING_SOON } from "@/lib/coming-soon"

// Nothing to list yet: it stays out of the search engines until it has something to say
export const metadata: Metadata = { title: "Tables", alternates: { canonical: "/tables" }, robots: { index: false } }

export default function TablesPage() {
  return (
    <ComingSoonPage
      title="Tables"
      {...COMING_SOON.tables}
      action={
        <Button asChild variant="outline">
          <Link href="/games">Pick a game</Link>
        </Button>
      }
    />
  )
}
