import type { Metadata } from "next"
import Link from "next/link"
import { Separator } from "@pbgo/ui/platform/separator"
import { CONTACT, PUBLISHER, SITE_NAME } from "@/site"

export const metadata: Metadata = { title: "Legal notice", alternates: { canonical: "/legal" } }

const SECTIONS = [
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
    title: "Cookies and storage",
    body: [
      "No advertising cookies, and no tracking across sites.",
      "Only what the games need to run: a player identity cookie per game so you are recognised at your table, a language cookie, and your browser's local storage (nickname, sound preferences). Administrators also get a session cookie when they sign in to a game's admin.",
      "Any audience measurement is anonymous and cookie-free.",
    ],
  },
]

export default function Legal() {
  return (
    <main className="mx-auto flex min-h-svh w-full max-w-reading flex-col gap-8 px-gutter py-section">
      <div className="flex flex-col gap-2">
        <Link href="/" className="text-sm text-muted-foreground underline-offset-4 hover:underline">
          {SITE_NAME}
        </Link>
        <h1 className="font-heading text-3xl">Legal notice</h1>
      </div>
      {SECTIONS.map((section, i) => (
        <section key={section.title} className="flex flex-col gap-3">
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
