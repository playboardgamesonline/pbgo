import type { Metadata } from "next"
import Link from "next/link"
import { LEGAL_LINK, LegalPage, LegalSection, LegalText } from "@/components/legal-page"
import { CONTACT, PUBLISHER, SITE_NAME } from "@/site"

export const metadata: Metadata = { title: "Legal Notice", alternates: { canonical: "/legal" } }

/**
 * Who publishes the site, who hosts it, and what the games are. The footer does not link to it: the owner is not sure the site needs a notice of
 * its own (other sites have none), so it stays at its address, unlinked, until they decide: keep it, fold it into the terms of use, or drop it.
 * It is the claims contact and the "unofficial adaptation" line that PLT-11 asks for.
 */
export default function Legal() {
  return (
    <LegalPage title="Legal Notice" href="/legal">
      <LegalSection title="Publisher" first>
        <LegalText>
          {SITE_NAME} is published by{" "}
          <a className={LEGAL_LINK} href={PUBLISHER.url}>
            {PUBLISHER.name}
          </a>
          .
        </LegalText>
        <LegalText>
          Contact:{" "}
          <a className={LEGAL_LINK} href={`mailto:${CONTACT}`}>
            {CONTACT}
          </a>
        </LegalText>
      </LegalSection>
      <LegalSection title="Hosting">
        <LegalText>Vercel Inc. (vercel.com).</LegalText>
      </LegalSection>
      <LegalSection title="Games">
        <LegalText>
          The games on this site are unofficial, free online adaptations. The names, trademarks and worlds of the board games mentioned belong to their respective owners.
        </LegalText>
      </LegalSection>
      {/* Where `/legal#cookies` used to lead, before the cookie policy had a page of its own */}
      <LegalSection id="cookies" title="Cookies, storage and statistics">
        <LegalText>
          What the site keeps on your device, and what it measures, is in the{" "}
          <Link href="/legal/cookies" className={LEGAL_LINK}>
            Cookie Policy
          </Link>
          .
        </LegalText>
      </LegalSection>
    </LegalPage>
  )
}
