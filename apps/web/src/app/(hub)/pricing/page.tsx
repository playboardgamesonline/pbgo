import type { Metadata } from "next"
import Link from "next/link"
import { Button } from "@pbgo/ui/platform/button"
import { ComingSoonPage } from "@/components/coming-soon-page"
import { COMING_SOON } from "@/lib/coming-soon"

// No plan to show yet, and it says so: it stays out of the search engines until it has something to say
export const metadata: Metadata = { title: "Pricing", alternates: { canonical: "/pricing" }, robots: { index: false } }

export default function PricingPage() {
  return (
    <ComingSoonPage
      title="Pricing"
      {...COMING_SOON.pricing}
      action={
        <Button asChild variant="outline">
          <Link href="/games">Pick a game</Link>
        </Button>
      }
    />
  )
}
