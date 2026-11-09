import { Button } from "@pbgo/ui/platform/button"
import { CONTACT } from "@/site"

/**
 * The invitation to the publishers to write: a line and a button that opens a mail to the contact address, which is how the contracts for the games begin. The About page has it, and so does the Pricing page when it is open
 * (`PRICING_OPEN`): it used to be that page's alone.
 */
export function PublisherCall() {
  return (
    <aside aria-label="Publishers" className="mx-auto flex max-w-xl flex-col items-center gap-4 text-center">
      <p className="text-lg text-muted-foreground">Are you a publisher? I would love to hear from you.</p>
      <Button asChild size="lg" variant="outline">
        <a href={`mailto:${CONTACT}?subject=Publisher%20enquiry`}>Get in touch</a>
      </Button>
    </aside>
  )
}
