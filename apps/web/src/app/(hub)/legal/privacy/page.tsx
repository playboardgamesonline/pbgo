import type { Metadata } from "next"
import Link from "next/link"
import { ConsentLink } from "@pbgo/analytics/client"
import { ANALYTICS_ENABLED } from "@pbgo/analytics/config"
import { FEEDBACK_RETENTION_MONTHS, PRESENCE_RETENTION_DAYS, TABLE_RETENTION_DAYS } from "@pbgo/core/lib/retention"
import { LEGAL_LINK, LegalEntries, LegalPage, LegalSection, LegalText, LegalUpdated } from "@/components/legal-page"
import { CONTACT, PUBLISHER, SITE_NAME } from "@/site"

// A draft for the owner, or a lawyer, to read (PLT-110): it stays out of the search engines until then
export const metadata: Metadata = { title: "Privacy Policy", alternates: { canonical: "/legal/privacy" }, robots: { index: false } }

/** The day the text last changed: change it with the text. */
const UPDATED = "7 November 2026"

/**
 * Everything the site does with personal data, in the order a person meets it. Every line is the code's, and the table of `docs/legal.md` lists where: a new field that holds
 * personal data, a new recipient or a new tracker is added here at the same time, or the page says less than the site does. What the site keeps on a device is the Cookie
 * Policy's (`cookies/page.tsx`), and what the PostHog parts say follows `ANALYTICS_ENABLED`, as the Cookie Policy's do.
 */
export default function PrivacyPolicy() {
  const consent = <ConsentLink className={`cursor-pointer ${LEGAL_LINK}`}>this link</ConsentLink>
  return (
    <LegalPage title="Privacy Policy" href="/legal/privacy">
      {/* The line of the stub that this page replaces: it goes when the owner says the text is final (PLT-110) */}
      <LegalText>This page is being written. The text below is a draft and may change.</LegalText>
      <LegalText>
        This page says what personal data {SITE_NAME} collects, why, where it goes, how long it is kept and what you can do about it. It describes what the site does. We do not sell your data and we do not use it for advertising. What the site keeps on
        your device, and what it measures, is in the{" "}
        <Link href="/legal/cookies" className={LEGAL_LINK}>
          Cookie Policy
        </Link>
        .
      </LegalText>

      <LegalSection id="controller" title="Who we are" first>
        <LegalText>
          {SITE_NAME} is published by{" "}
          <a className={LEGAL_LINK} href={PUBLISHER.url}>
            {PUBLISHER.name}
          </a>
          . For the data described here, we decide why and how it is used. Questions or requests about your data:{" "}
          <a className={LEGAL_LINK} href={`mailto:${CONTACT}`}>
            {CONTACT}
          </a>
        </LegalText>
      </LegalSection>

      <LegalSection id="visit" title="When you visit">
        <LegalText>You do not need an account to look around, and nothing is stored on your device when you arrive.</LegalText>
        <LegalEntries
          items={[
            {
              name: "Technical data",
              text: "Like any website, the company that hosts the site receives your IP address, your browser and device type, the page you ask for and the time. It uses them to send you the page, to keep the site working and to block abuse. It keeps them in its logs for a short time, and we do not use them to follow you from one visit to the next.",
            },
            {
              name: "Pictures and videos",
              text: "The pictures and videos of the games are stored by Sanity, our content service. Your browser asks its servers for them directly, so Sanity receives your IP address and browser details, as any site does when it shows a picture.",
            },
          ]}
        />
      </LegalSection>

      <LegalSection id="tables" title="When you play">
        <LegalText>You can play as a guest or with an account. Opening or joining a table needs a nickname.</LegalText>
        <LegalEntries
          items={[
            {
              name: "Your player identifier",
              text: "The cookie holds a random secret, one per game, for 30 days. It stays between your browser and our servers. What the tables, the chat and the statistics use is a code made from it with a one-way hash, your player identifier: it recognises you at your table so you can leave and come back, tells the players of a table apart and does not name you.",
            },
            {
              name: "Your nickname",
              text: "As a guest you type one (20 characters at most). It is kept on your device and sent to the table, where everyone who has the table's link sees it. If you are signed in, the table shows the name of your account instead.",
            },
            {
              name: "The table",
              text: `A table keeps its code, who hosts it, who sits at it (nicknames and player identifiers), its options, the state of the game, the moves played and the last time each player was seen. While a game starts, it also keeps the time each player's board finished loading, for a minute at most. That is how a game goes on after a reload, how the others can play for someone who has left, and how the game begins for everybody together. Anyone who has the table's link can see who sits at it, with their nicknames and pictures: share it with the people you want to play with. A clean-up runs every night and deletes a table ${TABLE_RETENTION_DAYS} days after the last thing that happened at it (a move, a join, a change of its options).`,
            },
            {
              name: "The chat",
              text: "A message (200 characters at most) or a reaction goes through our server to the players connected to the table, with your nickname. We do not store it and cannot read it afterwards: it only exists in the browsers of the players while their page is open. The statistics count that a message was sent, never its text.",
            },
            {
              name: "Live updates",
              text: "While you are at a table, your browser stays connected to our database provider, Supabase, to receive the table's updates and the chat. While a game starts, it also tells the other players how far your board has loaded, which only draws the bar of the start screen and is not stored. Supabase receives your IP address for that.",
            },
          ]}
        />
      </LegalSection>

      <LegalSection id="accounts" title="When you sign in">
        <LegalText>An account is optional. You sign in with Google, Twitch or Discord. Some accounts use an e-mail address and a password instead.</LegalText>
        <LegalEntries
          items={[
            {
              name: "What your provider gives us",
              text: "When you choose a provider, it tells our sign-in service, Supabase, who you are: an identifier, your e-mail address, your name and your picture, as far as that provider gives them. We keep them with your account, to sign you in and to show your name and picture to you and to the others at your table. We never see your password for that provider. The provider learns that you signed in to this site, and its own privacy policy applies to that.",
            },
            {
              name: "E-mail accounts",
              text: "If you create an account with an e-mail address and a password, we keep the address, a scrambled form of the password (never the password itself) and, if you give one, your display name. To check that the address is yours, our sign-in service e-mails it a code and a link, and the account can only be used once one of them has been used. We use the address to sign you in and to send you those e-mails.",
            },
            {
              name: "Your language",
              text: "The language you choose is kept with your account, so that it follows you from one device to the next, and in a cookie on each device.",
            },
            {
              name: "Being online",
              text: `While you are signed in and the site is open in a tab you are looking at, your browser tells our server, about every 45 seconds, that you are there. We keep only the time of the last time, one entry per account. The home page counts the members seen in the last two minutes, with the people sitting at a table, and shows the total as the players online: nobody is shown whether you are online. A clean-up runs every night and deletes that time ${PRESENCE_RETENTION_DAYS} ${PRESENCE_RETENTION_DAYS === 1 ? "day" : "days"} after your last visit, and it goes with your account. A guest who only looks around is not counted.`,
            },
            {
              name: "Your session",
              text: "While you are signed in, your browser keeps cookies that prove it. Our sign-in service records, for each session, when it started, your IP address and your browser, and logs sign-ups, sign-ins, sign-outs and renewals with your IP address, to keep accounts safe. The record of a session is deleted when you sign out, and the log of events after a short time.",
            },
            {
              name: "At a table",
              text: "When you sit down at a table, we copy your account's name (20 characters at most) and the address of your picture onto the table, so that the others see them. The picture itself stays with your provider and each person's browser loads it from there; its address can contain an identifier of your account at that provider. The table also records which account holds your seat, apart from what the others see, so that you are counted once among the players online. Both go with the table.",
            },
            {
              name: "Keeping and deleting",
              text: (
                <>
                  Your account stays until you ask us to delete it, by writing to{" "}
                  <a className={LEGAL_LINK} href={`mailto:${CONTACT}`}>
                    {CONTACT}
                  </a>
                  . We then delete it with what it holds.
                </>
              ),
            },
          ]}
        />
      </LegalSection>

      <LegalSection id="feedback" title="When you send feedback">
        <LegalText>
          The feedback button in a game sends us your message (2,000 characters at most) and, if you add them, an e-mail address and a screenshot. A screenshot shows whatever was on your screen, so look at it before you send it.
        </LegalText>
        <LegalText>
          With it we receive the page you were on, the code of your table if you were at one, your nickname and player identifier, your browser details, and a fingerprint of your IP address, which we only use to limit how many messages one person can send (the address
          itself is not stored). A screenshot is shrunk and re-encoded, which removes its hidden metadata, and it is kept in a private space. Only the people who run the site read feedback. We use it to fix bugs and improve the games, and to answer you if you left an
          address. A clean-up runs every night and deletes feedback, with its screenshot, {FEEDBACK_RETENTION_MONTHS} months after we receive it. You can ask us to delete it sooner.
        </LegalText>
      </LegalSection>

      <LegalSection id="statistics" title="Statistics">
        {ANALYTICS_ENABLED && (
          <>
            <LegalText>
              We use PostHog, on its European cloud, to see how the site is used and to fix what breaks. IP addresses are discarded. The Cookie Policy has the choices in full. In short:
            </LegalText>
            <LegalEntries
              items={[
                {
                  name: "Counts at tables",
                  text: "When a table is created, joined, started or finished, our server counts it, with the game, the number of players, the options and how long it lasted. Each count carries your player identifier, never a nickname, a chat message or a table code. This runs whatever you chose in the cookie banner.",
                },
                {
                  name: "Visits",
                  text: "The pages opened, clicks, loading times and errors are counted without any identifier kept on your device. Table codes are removed from the addresses.",
                },
                {
                  name: "If you accept",
                  text: (
                    <>
                      PostHog keeps an identifier on your device. It tells us when the same browser comes back and, at a table, it is linked to your player identifier. Your visits may be recorded as session replays, to see where people get stuck: what you type in a field, the chat and
                      nicknames are masked. If you refuse, none of this happens. You can change your choice at any time with {consent}.
                    </>
                  ),
                },
                { name: "How long", text: "Counts are kept for 12 months at most, session replays for 30 days." },
              ]}
            />
          </>
        )}
        <LegalText>The pages of the games&apos; boards also use Vercel Analytics, which counts visits without cookies and without keeping an identifier.</LegalText>
      </LegalSection>

      <LegalSection id="legal-bases" title="Why we may use your data">
        <LegalText>The law asks for a reason for each use of personal data. Ours are:</LegalText>
        <LegalEntries
          items={[
            { name: "To give you the service", text: "Sitting you at a table, signing you in, remembering your language: we could not do it without your data." },
            {
              name: "Our legitimate interest",
              text: "In running a safe site that works: limiting requests, blocking abuse, keeping technical logs, handling feedback, and counting what happens at tables to fix and improve the games. You can object to this (see Your rights).",
            },
            ...(ANALYTICS_ENABLED
              ? [{ name: "Your consent", text: "For what the cookie banner asks: the identifier that PostHog keeps on your device and the session replays. You can say no, and change your mind at any time." }]
              : []),
          ]}
        />
        <LegalText>We make no automated decision that has legal or similar effects on you.</LegalText>
      </LegalSection>

      <LegalSection id="recipients" title="Who receives your data">
        <LegalText>A few companies help us run the site. They handle your data for us, on our instructions, except the sign-in providers, which act for themselves. We do not sell your data.</LegalText>
        <LegalEntries
          items={[
            { name: "Vercel", text: "Hosts the site and runs its servers, in Paris. Receives your IP address and browser details with every request." },
            { name: "Supabase", text: "Our database, our sign-in service and the live updates of tables, in Paris. Holds the tables, the accounts and the feedback, relays the chat, and writes the e-mail that confirms an address." },
            { name: "Resend", text: "Sends the e-mail that confirms an address, for our sign-in service. Receives your e-mail address and the content of that e-mail (the code and the link), and keeps a record of what it sent for 30 days." },
            ...(ANALYTICS_ENABLED
              ? [{ name: "PostHog", text: "Statistics, on its European cloud. Receives the counts of what happens at tables and of visits and, if you accept, the identifier and the session replays." }]
              : []),
            { name: "Sanity", text: "Stores the texts, pictures and videos of the games. Your browser loads the pictures and videos from its servers." },
            { name: "Google, Twitch and Discord", text: "Only if you sign in with them. They learn that you sign in to this site and handle your data under their own policies." },
            { name: "The other people at your table", text: "See your nickname, or the name and picture of your account, and your chat messages." },
            { name: "The people who run the site", text: "Can read the database and the feedback." },
          ]}
        />
        <LegalText>We also give data to an authority when the law requires it.</LegalText>
      </LegalSection>

      <LegalSection id="transfers" title="Outside the European Union">
        <LegalText>
          The site&apos;s servers and its database are in France, and PostHog&apos;s European cloud is in the EU. But some of the companies above are based in the United States, or have a parent company there (Vercel, Supabase, PostHog, Sanity, Resend and the sign-in providers), so their
          staff can reach data from outside the EU. Resend, which sends the confirmation e-mails, keeps its records in the United States. And the pictures and videos from Sanity, and the pictures of signed-in players, come from servers around the world, which receive your IP address when your browser asks for them. These transfers are covered by the standard
          contractual clauses of the European Commission in the companies&apos; data processing agreements, or by their certification under the EU–US Data Privacy Framework.
        </LegalText>
      </LegalSection>

      <LegalSection id="security" title="How we protect it">
        <LegalText>
          The connection to the site is encrypted. Your browser cannot read the database: only our servers can. Passwords are stored scrambled, feedback screenshots in a private space, and the chat is not stored at all. Only the people who run the site have access to the back office.
        </LegalText>
      </LegalSection>

      <LegalSection id="rights" title="Your rights">
        <LegalText>
          You can ask us, at any time, to show you the data we hold about you, to correct it, to delete it, to limit how we use it, or to give it to you in a usable format. You can object to the uses based on our legitimate interest.
          {ANALYTICS_ENABLED && <> You can withdraw a consent you gave at any time, with {consent}.</>}
        </LegalText>
        <LegalText>
          To use these rights, write to{" "}
          <a className={LEGAL_LINK} href={`mailto:${CONTACT}`}>
            {CONTACT}
          </a>
          . We answer within one month. We may ask for proof that the data is yours. With an account, tell us the e-mail address of the account. As a guest you are only a random secret in a cookie, so we can only find your data if you tell us the link of the table and the
          nickname you used.
        </LegalText>
        <LegalText>
          If you think we do not respect your rights, you can complain to the{" "}
          <a className={LEGAL_LINK} href="https://www.cnil.fr" target="_blank" rel="noopener noreferrer">
            CNIL
          </a>
          , the French data protection authority, or to the one in your country.
        </LegalText>
      </LegalSection>

      <LegalSection id="children" title="Children">
        <LegalText>
          The site is for people aged 13 and over. We do not knowingly collect data from children under 13: if you think one has given us some, write to{" "}
          <a className={LEGAL_LINK} href={`mailto:${CONTACT}`}>
            {CONTACT}
          </a>{" "}
          and we delete it.
        </LegalText>
      </LegalSection>

      <LegalSection id="changes" title="Changes">
        <LegalText>We change this page when the site changes what it does with your data. If a change matters to you, we say so on the site before it applies.</LegalText>
        <LegalUpdated on={UPDATED} />
      </LegalSection>
    </LegalPage>
  )
}
