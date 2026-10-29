import type { Metadata } from "next"
import Link from "next/link"
import { ConsentLink } from "@pbgo/analytics/client"
import { ANALYTICS_ENABLED } from "@pbgo/analytics/config"
import { Separator } from "@pbgo/ui/platform/separator"
import { CONTACT, PUBLISHER, SITE_NAME } from "@/site"

export const metadata: Metadata = { title: "Legal notice", alternates: { canonical: "/legal" } }

const lead = "text-foreground"

/**
 * What the site measures, in full: the cookie banner is a small card that says the essentials in one sentence and links here.
 * Only on a deployment that has the analytics key: without it nothing below happens, and the notice must not say it does.
 */
const STATISTICS = [
  "We use PostHog, on its European cloud, to see how the site is used and to fix what breaks. IP addresses are discarded. Two kinds of counts run whatever you choose, and neither stores anything on your device:",
  <>
    <span className={lead}>Game statistics.</span> When a table is created, joined, started or finished, the server counts it with the game, the number of players, the options and how long it lasted. Each count carries the random value of that game&apos;s
    player cookie, so we can tell that someone came back to a game, but never a nickname or anything typed in the chat (a chat message is counted, never read).
  </>,
  <>
    <span className={lead}>Visits.</span> The pages opened, clicks, loading times and errors are counted without any identifier kept in your browser: nothing links one page load to the next. Table codes are removed from the addresses.
  </>,
  <>
    <span className={lead}>If you accept,</span> PostHog also stores a random identifier in a cookie and in your browser&apos;s local storage. It tells us when the same browser comes back, and at a table it is linked to your player identifier. Your visits may be
    recorded as session replays, to see where people get stuck: what you type in a field, the chat and nicknames are masked.
  </>,
  <>
    <span className={lead}>If you refuse,</span> nothing is stored for statistics and nothing is recorded. The two counts above carry on.
  </>,
  <>
    You can change your choice at any time with{" "}
    <ConsentLink className="cursor-pointer text-foreground underline underline-offset-4">this link</ConsentLink>, the Cookie settings link in the footer or a game&apos;s settings menu. We ask again after 13 months. Questions about your data:{" "}
    <a className="text-foreground underline underline-offset-4" href={`mailto:${CONTACT}`}>
      {CONTACT}
    </a>
    .
  </>,
]

const SECTIONS: { id?: string; title: string; body: React.ReactNode[] }[] = [
  {
    title: "Publisher",
    body: [
      <>
        {SITE_NAME} is published by{" "}
        <a className="text-foreground underline underline-offset-4" href={PUBLISHER.url}>
          {PUBLISHER.name}
        </a>
        .
      </>,
      <>
        Contact:{" "}
        <a className="text-foreground underline underline-offset-4" href={`mailto:${CONTACT}`}>
          {CONTACT}
        </a>
      </>,
    ],
  },
  { title: "Hosting", body: ["Vercel Inc. (vercel.com)."] },
  {
    title: "Games",
    body: [
      "The games on this site are unofficial, free online adaptations. The names, trademarks and worlds of the board games mentioned belong to their respective owners.",
    ],
  },
  {
    // The banner's "Details" link lands here (`/legal#cookies`)
    id: "cookies",
    title: "Cookies, storage and statistics",
    body: [
      "No advertising cookies, no tracking across sites, and nothing is sold or shared for advertising.",
      "What the games need to run, whatever you choose: a player identity cookie per game (a random value, kept for 30 days) so you are recognised at your table, a language cookie (one year), and your browser's local storage (nickname, sound preferences, your cookie choice). Administrators also get a session cookie when they sign in to the back office.",
      ...(ANALYTICS_ENABLED ? STATISTICS : ["Audience measurement by Vercel Analytics is anonymous and cookie-free."]),
    ],
  },
]

export default function Legal() {
  return (
    <main className="mx-auto flex min-h-[calc(100svh-var(--consent-h,0px))] w-full max-w-reading flex-col gap-8 px-gutter py-section">
      <div className="flex flex-col gap-2">
        <Link href="/" className="text-sm text-muted-foreground underline-offset-4 hover:underline">
          {SITE_NAME}
        </Link>
        <h1 className="font-heading text-3xl">Legal notice</h1>
      </div>
      {SECTIONS.map((section, i) => (
        <section key={section.title} id={section.id} className="flex scroll-mt-8 flex-col gap-3">
          {i > 0 && <Separator className="mb-5" />}
          <h2 className="font-heading text-lg">{section.title}</h2>
          {section.body.map((paragraph, j) => (
            <p key={j} className="text-muted-foreground">
              {paragraph}
            </p>
          ))}
        </section>
      ))}
    </main>
  )
}
