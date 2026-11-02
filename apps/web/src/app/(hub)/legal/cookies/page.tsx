import type { ReactNode } from "react"
import type { Metadata } from "next"
import { ConsentLink } from "@pbgo/analytics/client"
import { ANALYTICS_ENABLED } from "@pbgo/analytics/config"
import { LEGAL_LEAD, LEGAL_LINK, LegalPage, LegalSection, LegalText } from "@/components/legal-page"
import { CONTACT } from "@/site"

export const metadata: Metadata = { title: "Cookie Policy", alternates: { canonical: "/legal/cookies" } }

/**
 * Everything the site writes on a device, one entry for a name: what it is, what it is for, how long it lasts and when it is written.
 * The entries are the code's (`player.ts`, `admin.ts`, `language-select.tsx`, `consent.ts`, `profile.ts`, `sound.ts`, `folded-games.ts`, the
 * cookies of `@pbgo/accounts`): a new cookie or storage key is added here at the same time, or the page says less than the site does.
 */
function Stored({ items }: { items: { name: string; text: ReactNode }[] }) {
  return (
    <dl className="flex flex-col gap-4">
      {items.map((item) => (
        <div key={item.name} className="flex flex-col gap-1">
          <dt className="font-mono text-sm text-foreground">{item.name}</dt>
          <dd className="text-muted-foreground">{item.text}</dd>
        </div>
      ))}
    </dl>
  )
}

/** What the site measures, in full: the cookie banner is a small card that says the essentials in one sentence and links here. */
const STATISTICS: ReactNode[] = [
  "We use PostHog, on its European cloud, to see how the site is used and to fix what breaks. IP addresses are discarded. Two kinds of counts run whatever you choose, and neither stores anything on your device:",
  <>
    <span className={LEGAL_LEAD}>Game statistics.</span> When a table is created, joined, started or finished, the server counts it with the game, the number of players, the options and how long it lasted. Each count carries the random value of that game&apos;s
    player cookie, so we can tell that someone came back to a game, but never a nickname or anything typed in the chat (a chat message is counted, never read).
  </>,
  <>
    <span className={LEGAL_LEAD}>Visits.</span> The pages opened, clicks, loading times and errors are counted without any identifier kept in your browser: nothing links one page load to the next. Table codes are removed from the addresses.
  </>,
  <>
    <span className={LEGAL_LEAD}>If you accept,</span> PostHog also stores a random identifier in a cookie and in your browser&apos;s local storage (their names start with <span className="font-mono text-sm">ph_</span>). It tells us when the same browser comes back, and at a
    table it is linked to your player identifier. Your visits may be recorded as session replays, to see where people get stuck: what you type in a field, the chat and nicknames are masked.
  </>,
  <>
    <span className={LEGAL_LEAD}>If you refuse,</span> nothing is stored for statistics and nothing is recorded. The two counts above carry on.
  </>,
  <>
    You can change your choice at any time with{" "}
    <ConsentLink className={`cursor-pointer ${LEGAL_LINK}`}>this link</ConsentLink> or a game&apos;s settings menu.
  </>,
]

export default function CookiePolicy() {
  return (
    <LegalPage title="Cookie Policy" href="/legal/cookies">
      <LegalText>
        This page lists what the site keeps on your device, why, and for how long. A cookie is a small file that your browser keeps for a site; local storage is a similar space that only the site that wrote to it can read.
      </LegalText>
      <LegalText>
        Nothing is stored when you arrive. The site writes something only when you do what needs it (create or join a table, pick a language, sign in) or when you answer the cookie banner. No advertising cookies, no tracking across sites, and nothing is sold or shared for
        advertising. The site does not use cookies to personalise what you see or to market anything to you.
      </LegalText>

      <LegalSection id="essential" title="What the site needs" first>
        <Stored
          items={[
            {
              name: "<game>_player",
              text: "A random identifier, one per game (courtisans_player, for example), that recognises you at your table so you can leave and come back. It is sent to this site only and page scripts cannot read it. Kept 30 days; written when you create or join a table.",
            },
            {
              name: "sb-…",
              text: "Keeps you signed in. Written by Supabase, our sign-in service, on this site's own domain, and only if you sign in. Kept while you stay signed in, 400 days at most.",
            },
            {
              name: "gamemaster_session",
              text: "For the people who run the site only: it opens the back office. Kept 7 days. Visitors never get it.",
            },
          ]}
        />
      </LegalSection>

      <LegalSection id="preferences" title="Choices kept on your device">
        <Stored
          items={[
            { name: "pbgo-locale", text: "A cookie that remembers the language you picked. Kept one year; written when you choose a language." },
            {
              name: "pbgo-consent",
              text: "Local storage. Your answers to the cookie banner (analytics, marketing) and their date. We ask again after 13 months, and when a new kind of cookie comes in.",
            },
            {
              name: "<game>:profile, <game>:sound, <game>:music, <game>:volumes",
              text: "Local storage. Your nickname and your sound settings in that game. They stay until you clear your browser's data.",
            },
            {
              name: "pbgo:folded-games",
              text: "Local storage. The games you folded in your friends' list, when you are signed in. It stays until you clear your browser's data.",
            },
          ]}
        />
      </LegalSection>

      <LegalSection id="statistics" title="Statistics">
        {ANALYTICS_ENABLED && STATISTICS.map((paragraph, i) => <LegalText key={i}>{paragraph}</LegalText>)}
        <LegalText>The pages of the games also use Vercel Analytics for audience measurement. It is anonymous and sets no cookie.</LegalText>
      </LegalSection>

      <LegalSection id="marketing" title="Marketing">
        <LegalText>
          The cookie banner has a marketing choice, off unless you switch it on. The site uses no marketing cookie today, so the switch changes nothing yet. We will ask you again before we use one.
        </LegalText>
      </LegalSection>

      <LegalSection title="Contact">
        <LegalText>
          Questions about your data:{" "}
          <a className={LEGAL_LINK} href={`mailto:${CONTACT}`}>
            {CONTACT}
          </a>
        </LegalText>
      </LegalSection>
    </LegalPage>
  )
}
