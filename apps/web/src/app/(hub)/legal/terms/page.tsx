import type { Metadata } from "next"
import Link from "next/link"
import { ACCOUNT_DELETION_GRACE_DAYS } from "@pbgo/core/lib/retention"
import { LEGAL_LINK, LegalList, LegalPage, LegalSection, LegalText, LegalUpdated } from "@/components/legal-page"
import { CONTACT, PUBLISHER, SITE_NAME } from "@/site"

// A draft for the owner, or a lawyer, to read (PLT-110): it stays out of the search engines until then
export const metadata: Metadata = { title: "Terms of Use", alternates: { canonical: "/legal/terms" }, robots: { index: false } }

/** The day the text last changed: change it with the text. */
const UPDATED = "9 November 2026"

/**
 * The rules of using the site, for a guest as much as for an account (the sign-in and the sign-up pages say that continuing, or creating an account, accepts them, `login-card.tsx`, `signup-card.tsx`). What the owner chose to ship without is not on the page: the
 * governing law and courts (`docs/legal.md`, "Decisions of the owner"). The minimum age is the owner's choice: 13, with no parental agreement, which a lawyer should look at (`docs/legal.md`, Decisions 2). The chat's
 * banned-word filter is a feature they plan and that does not exist yet: the sentence about it must not go live before the filter does. What the page says of the games follows the footer's line and the legal notice:
 * the games are unofficial adaptations, and their rights belong to their owners.
 */
export default function TermsOfUse() {
  const mail = (
    <a className={LEGAL_LINK} href={`mailto:${CONTACT}`}>
      {CONTACT}
    </a>
  )
  return (
    <LegalPage title="Terms of Use" href="/legal/terms">
      {/* The line of the stub that this page replaces: it goes when the owner says the text is final (PLT-110) */}
      <LegalText>This page is being written. The text below is a draft and may change.</LegalText>
      <LegalText>
        These terms are the rules for using {SITE_NAME}, as a guest or with an account. By using the site you accept them. If you do not, please do not use it. How we handle your personal data is in the{" "}
        <Link href="/legal/privacy" className={LEGAL_LINK}>
          Privacy Policy
        </Link>
        , and what the site keeps on your device in the{" "}
        <Link href="/legal/cookies" className={LEGAL_LINK}>
          Cookie Policy
        </Link>
        .
      </LegalText>

      <LegalSection id="service" title="The service" first>
        <LegalText>
          {SITE_NAME} is a free site where you play online adaptations of board and card games in your browser, with friends or other players. It is published by{" "}
          <a className={LEGAL_LINK} href={PUBLISHER.url}>
            {PUBLISHER.name}
          </a>
          . Contact: {mail}
        </LegalText>
        <LegalText>Some games and features are marked as coming soon and cannot be used yet. We may change them, add some or remove some, or stop the site, at any time.</LegalText>
      </LegalSection>

      <LegalSection id="age" title="Who can use the site">
        <LegalText>You must be at least 13 to use the site.</LegalText>
      </LegalSection>

      <LegalSection id="accounts" title="Accounts and nicknames">
        <LegalText>
          You do not need an account to play: a guest picks a nickname. An account is made by signing in with Google, Twitch or Discord. You are responsible for what happens under your account, so keep the access to your provider&apos;s account safe, and tell us if someone
          else uses yours.
        </LegalText>
        <LegalText>
          An account can also be made with an e-mail address and a password: you confirm the address with a code that we e-mail you, and you are responsible for keeping the password safe.
        </LegalText>
        <LegalText>
          Your nickname, or the name and picture of your account, are seen by the people at your table. Do not use the name of someone else, or a name or a picture that is offensive, hateful or illegal. We may change a nickname or refuse a picture that breaks this rule.
        </LegalText>
      </LegalSection>

      <LegalSection id="conduct" title="Playing fair">
        <LegalText>Play in good faith and be respectful. You must not:</LegalText>
        <LegalList
          items={[
            "harass, threaten or insult other players, or put hateful, sexual, violent or illegal content in a nickname, in the chat or in feedback;",
            "cheat, for example with scripts or bots, or by using a bug on purpose;",
            "try to see what is hidden from you (such as the hands of the other players), to get around the limits of the site, to disrupt it or overload it, or to reach accounts, tables or data that are not yours;",
            "pretend to be someone else, or to speak for the site;",
            "collect data from the site in bulk.",
          ]}
        />
        <LegalText>
          The chat is shared with the people at your table only. We do not store it and we do not read it. You can choose whether banned words are replaced by stars in the chat; the filter does not catch everything. If someone behaves badly, leave the table and tell us at{" "}
          {mail}. If you break these rules or the law, we may warn you, remove you from a table, block your access or delete your account (see Ending).
        </LegalText>
      </LegalSection>

      <LegalSection id="games" title="The games and other people's rights">
        <LegalText>
          The games on the site are unofficial, free online adaptations of games made by their authors and publishers. The names, trademarks, rules, artwork and worlds of the games belong to their respective owners. {SITE_NAME} is not affiliated with them and they do not endorse it.
        </LegalText>
        <LegalText>
          If you own rights over a game or a picture on the site and want something changed or taken down, write to {mail}. We will look at your request and answer.
        </LegalText>
      </LegalSection>

      <LegalSection id="content" title="What belongs to whom">
        <LegalText>
          The site itself, its design, its code and its texts belong to {PUBLISHER.name} or to those who allowed their use. We give you a personal, free right to use the site as these terms say. It does not let you copy, sell or republish the site or its games.
        </LegalText>
        <LegalText>
          What you write (a nickname, a chat message, feedback) stays yours. By sending it you allow us to show it to the people it is meant for, such as your table, and, for feedback, to read it and use it to improve the site, without paying you.
        </LegalText>
      </LegalSection>

      <LegalSection id="plans" title="Paid plans">
        <LegalText>
          The site is free. The Pricing page shows plans that are not on sale: nothing can be bought and nothing is charged. Before a paid plan opens, its price, how it is billed and how to cancel it are published, and these terms are updated.
        </LegalText>
      </LegalSection>

      <LegalSection id="liability" title="Availability and responsibility">
        <LegalText>
          We do our best to keep the site running, but we cannot promise that it will always be available or free of errors. A game in progress can be lost, for example after a bug or when the service stops. The site is provided as it is. To the extent the law allows, we are not
          responsible for indirect losses, or for what other players say or do.
        </LegalText>
        <LegalText>None of this limits the rights the law gives you, in particular as a consumer, or our responsibility where the law does not allow it to be limited.</LegalText>
      </LegalSection>

      <LegalSection id="ending" title="Ending">
        <LegalText>
          You can stop using the site at any time, and delete your account yourself in your settings: we e-mail you a link to confirm it, and keep the account for {ACCOUNT_DELETION_GRACE_DAYS} days in case you change your mind. If you cannot, or if your account has no
          e-mail address, write to {mail}. We can suspend or end your access, or delete your account, if you break these terms or the law, or if we stop the service. When we can, we tell you why.
        </LegalText>
      </LegalSection>

      <LegalSection id="changes" title="Changes">
        <LegalText>
          We may update these terms, for example when the site gains features. If a change matters to you, we say so on the site before it applies. If you keep using the site after a change, you accept the new terms.
        </LegalText>
        <LegalUpdated on={UPDATED} />
      </LegalSection>
    </LegalPage>
  )
}
