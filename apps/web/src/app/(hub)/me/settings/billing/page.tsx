import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { CreditCardIcon, Invoice01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { requireAccount } from "@pbgo/accounts/server"
import { Button } from "@pbgo/ui/platform/button"
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@pbgo/ui/platform/empty"
import { Item, ItemActions, ItemContent, ItemDescription, ItemTitle } from "@pbgo/ui/platform/item"
import { SettingsGroup, SettingsPage } from "@/components/settings-page"
import { PAID_PLANS_NOTICE, PLANS, priceOf } from "@/lib/plans"
import { BILLING_OPEN } from "@/site"

export const metadata: Metadata = { title: "Billing settings" }

/**
 * The Billing section of the settings: the member's plan, how they pay for it, their invoices and the way to cancel it. Every member is on the free plan, since no paid one is offered (`PAID_PLANS_NOTICE`, the line the pricing page
 * says), so the plan is the free one with the way to the pricing page, and the payment method, the invoices and the cancellation have their place and their empty state, ready for the day a paid plan is taken. Nothing is kept here: there
 * is no payment provider behind it. There is nothing to bill for now, so the section is hidden: it has no entry in the settings and shows the 404 page while `BILLING_OPEN` (`apps/web/src/site.ts`) is false.
 */
export default async function BillingSettingsPage() {
  if (!BILLING_OPEN) notFound()
  await requireAccount("/me/settings/billing")
  const plan = PLANS.find((candidate) => candidate.id === "free")

  return (
    <SettingsPage title="Billing" description="Your plan, how you pay for it and your invoices.">
      <p className="-mt-4 text-sm text-muted-foreground">{PAID_PLANS_NOTICE}</p>
      <SettingsGroup title="Plan">
        <Item>
          <ItemContent>
            <ItemTitle>{plan?.name ?? "Free"}</ItemTitle>
            {plan && (
              <ItemDescription>
                {plan.description} {priceOf(plan, "monthly").note}.
              </ItemDescription>
            )}
          </ItemContent>
          <ItemActions>
            <Button asChild variant="outline">
              <Link href="/pricing">Adjust plan</Link>
            </Button>
          </ItemActions>
        </Item>
      </SettingsGroup>
      <SettingsGroup title="Payment method">
        <Empty className="border p-6">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <HugeiconsIcon icon={CreditCardIcon} strokeWidth={2} aria-hidden="true" />
            </EmptyMedia>
            <EmptyTitle>No payment method</EmptyTitle>
            <EmptyDescription>The card you pay your plan with is kept here.</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button variant="outline" disabled>
              Add a payment method
            </Button>
          </EmptyContent>
        </Empty>
      </SettingsGroup>
      <SettingsGroup title="Invoices">
        <Empty className="border p-6">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <HugeiconsIcon icon={Invoice01Icon} strokeWidth={2} aria-hidden="true" />
            </EmptyMedia>
            <EmptyTitle>No invoices yet</EmptyTitle>
            <EmptyDescription>Your invoices are listed here, ready to download.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      </SettingsGroup>
      <SettingsGroup title="Cancel plan">
        <Item>
          <ItemContent>
            <ItemTitle>Cancel your plan</ItemTitle>
            <ItemDescription>You are on the free plan: there is nothing to cancel.</ItemDescription>
          </ItemContent>
          <ItemActions>
            <Button variant="destructive" disabled>
              Cancel plan
            </Button>
          </ItemActions>
        </Item>
      </SettingsGroup>
    </SettingsPage>
  )
}
