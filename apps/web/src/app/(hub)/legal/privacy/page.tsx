import type { Metadata } from "next"
import Link from "next/link"
import { ConsentLink } from "@pbgo/analytics/client"
import { ANALYTICS_ENABLED } from "@pbgo/analytics/config"
import { MAX_BLOCKS, MAX_FRIENDS } from "@pbgo/core/lib/friends"
import {
  ACCOUNT_DELETION_GRACE_DAYS,
  FEEDBACK_RETENTION_MONTHS,
  FINISHED_STATE_RETENTION_HOURS,
  FRIEND_REQUEST_RETENTION_DAYS,
  PRESENCE_RETENTION_DAYS,
  TABLE_RETENTION_DAYS,
  UNRANKED_SEAT_RETENTION_MONTHS,
} from "@pbgo/core/lib/retention"
import { LEGAL_LINK, LegalEntries, LegalPage, LegalSection, LegalText, LegalUpdated } from "@/components/legal-page"
import { CONTACT, PUBLISHER, SITE_NAME } from "@/site"

// A draft for the owner, or a lawyer, to read (PLT-110): it stays out of the search engines until then
export const metadata: Metadata = { title: "Privacy Policy", alternates: { canonical: "/legal/privacy" }, robots: { index: false } }

/** The day the text last changed: change it with the text. */
const UPDATED = "10 November 2026"

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
              text: "As a guest you type one (20 characters at most). It is kept on your device and sent to the table, where everyone who has the table's link sees it, and everyone who visits the site if the table is public (below). If you are signed in, the table shows the name of your account instead.",
            },
            {
              name: "The table",
              text: `A table keeps its code, who hosts it, who sits at it (nicknames and player identifiers), its options, the state of the game (the cards and, in some games, what the players write or draw), the moves played, a log of what happened in the game (for the history on the screen: who drew which card, who stayed, who won the round, with player identifiers and no names) and the last time each player was seen. While a game starts, it also keeps the time each player confirmed that they are there, once their board had loaded, for a minute at most. That is how a game goes on after a reload, how the others can play for someone who has left, and how the game begins for everybody together. Anyone who has the table's link can see who sits at it, with their nicknames and pictures: share it with the people you want to play with. The one who opens a table also chooses who may join it, and the table keeps that choice with the speed it is played at and the number of seats: it is private, reached by its link alone, or public, and a public table can ask for a minimum rank in the game and a language. A public table that is waiting for players is listed with the open tables of its game, on the Tables page and on the home page, for as long as someone sits at it and is seen there: every visitor of the site, signed in or not, then sees the nicknames or account names and pictures of the people who sit at it, and what its host asked for. The form that opens a table starts with the table public, and the host can make it private before or after opening it. A table that its last player leaves is deleted at once. A clean-up runs every night and deletes a table ${TABLE_RETENTION_DAYS} days after the last thing that happened at it (a move, a join, a change of its options). Once a game is over and its result is written down (below), the hidden part of its state, such as the cards in hand, and the log of what happened are deleted ${FINISHED_STATE_RETENTION_HOURS} hours after the table was last written to, without waiting for the rest of the table.`,
            },
            {
              name: "The result of a game",
              text: `When a game ends, we write down how it ended, apart from the table: the game, when it ended, how long it lasted, the options it was played with (the expansions included) and, for each seat, the place at the table, the place reached, the score and how it ended for the player (a win, a loss, a draw, or a table that won or lost together), with the nickname or the account name, and the picture address, that the seat showed. A seat held by a signed-in account is linked to that account. A seat held by a guest is linked to no one: a guest has no history, and nothing in the result tells who they are but the nickname they typed. This is what the history, the statistics and the ranks of the players are made of. The seats of a game that did not count for the ranks are deleted ${UNRANKED_SEAT_RETENTION_MONTHS} months after the game ended, by the same nightly clean-up, and the totals of the players keep what they counted. The game itself, which names no one, is kept. The seats of a game that counted for the ranks are kept as long as the account is. When an account is deleted, the link to it goes, and the name and the picture of its seats are erased: its games stay as those of a deleted player.`,
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
        <LegalText>An account is optional. You sign in with Google, Discord or Steam, and you can link a Twitch account to yours, which does not sign you in. From your settings you can also link a Steam account to an account you made another way. Some accounts use an e-mail address and a password instead.</LegalText>
        <LegalEntries
          items={[
            {
              name: "What your provider gives us",
              text: "When you choose a provider, it tells our sign-in service, Supabase, who you are: an identifier, your e-mail address, your name and your picture, as far as that provider gives them. We keep them with your account, to sign you in and to show your name and picture to you and to the others at your table. We never see your password for that provider. The provider learns that you signed in to this site, and its own privacy policy applies to that.",
            },
            {
              name: "Signing in with Steam",
              text: "Steam gives us no e-mail address. When you sign in with it, Steam tells us the number of your Steam account (the one in the address of your Steam profile), and our server then asks Steam for the name and the picture of your profile. We keep the number, the name and the picture with your account, to sign you in and to show your name and picture to you and to the others at your table. Our sign-in service needs an address for every account, so we make one up for yours: it ends in external.pbgo.invalid, it cannot receive any e-mail and it is never shown. We never see your Steam password. Steam learns that you signed in to this site, and its own privacy policy applies to that. You can also link a Steam account to an account you made another way, from your settings: the same number, name and picture are kept with it, nothing else about your account changes, and unlinking it deletes them.",
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
              name: "Your settings",
              text: "Your username is kept in your profile (see \"Your profile\"), and a copy of it with your account, so that the site can show it as soon as you are signed in. Your choices (the notifications you want, hiding your game history, how times are written, whether the site's animations or its see-through surfaces are reduced) are kept with your account, so that they follow you from one device to the next. The choices for the animations and the see-through surfaces are also kept in a cookie each on each device, so that a page can honour them as it opens (see the Cookie Policy). All of it stays until the account is deleted. A change of e-mail address sends a link to the new address, through the same sender as the sign-up.",
            },
            {
              name: "Your country or region",
              text: "In your account settings you can record the country or region you are in. It is optional and nobody else sees it. We keep it with your account until the account is deleted, and you can change or remove it at any time.",
            },
            {
              name: "Your date of birth",
              text: "Some games, and some expansions of a game, are for adults only, or for an older age than 13. To play one you give your date of birth, in your account settings or when the site asks for it. It is optional until you want to play one of those. You give it once, and it cannot be changed afterwards: write to us if it is wrong. We take your word for it and do not check it. We keep it apart from the rest of your account, in a table that only our server reads, and the server works out your age from it each time you sit at a table that asks for one. Other players never see it; you see it yourself with its day and month hidden. It stays until your account is deleted. A date that would make you younger than 13 is refused and not kept.",
            },
            {
              name: "Multi-factor authentication",
              text: "If you turn it on in your account settings, our sign-in service, Supabase, makes a secret that you add to an authenticator app on your phone, by scanning a QR code or typing a key. Supabase keeps the secret, the name we give it (\"Authenticator app\") and its dates with your account, and records each set-up and each check of a code, with your IP address, in the log of your sign-in events. We never see the codes the app shows and keep none. Once it is on, you are asked for a code each time you sign in, whichever way you sign in, and turning it on signs you out of your other devices. It is optional. We keep it until you turn it off, which deletes the secret, or until your account is deleted. If you lose your phone, write to us from the e-mail address of your account and we turn it off. Accounts with no e-mail address, the ones made with Steam, cannot turn it on.",
            },
            {
              name: "Being online",
              text: `While you are signed in and the site is open in a tab you are looking at, your browser tells our server, about every 45 seconds, that you are there. We keep only the time of the last time, one entry per account. The home page counts the members seen in the last two minutes, with the people sitting at a table, and shows the total as the players online, which names nobody. Your friends do see whether you are online (see "Your friends"). A clean-up runs every night and deletes that time ${PRESENCE_RETENTION_DAYS} ${PRESENCE_RETENTION_DAYS === 1 ? "day" : "days"} after your last visit, and it goes with your account. A guest who only looks around is not counted.`,
            },
            {
              name: "Your session",
              text: "While you are signed in, your browser keeps cookies that prove it. Our sign-in service records, for each session, when it started, your IP address and your browser, and logs sign-ups, sign-ins, sign-outs and renewals with your IP address, to keep accounts safe. The record of a session is deleted when you sign out, and the log of events after a short time.",
            },
            {
              name: "At a table",
              text: "When you sit down at a table, we copy your account's name (20 characters at most), your tag (the four digits after your name, as in Alex#0042) and the address of your picture onto the table, so that the others see them, and every visitor of the site does too if the table is public. The picture itself stays with your provider and each person's browser loads it from there; its address can contain an identifier of your account at that provider. The table also records which account holds your seat, apart from what the others see, so that you are counted once among the players online. Both go with the table. When the game ends, the account that held your seat is written in the result of the game, which stays (see \"The result of a game\").",
            },
            {
              name: "Your profile",
              text: "Every account has a public profile: a page that any visitor can open, signed in or not, at an address made of your username and your tag (as in /player/Alex-0042). It shows your username with its tag, a number of four digits that we give you at random and that you can change when you edit your profile, so that two players with the same name can be told apart; your picture; the month you joined; what you choose to fill in when you edit your profile, each field optional and empty until you fill it: your pronouns (from a list), your country or region (from a list; it is not the country of your settings, which stays private), your city (found by a search at Geoapify, never typed: our server sends Geoapify the first letters you type to look for it, and the city you pick once more when you save, to check that it exists; Geoapify gets those letters and our server's address, not you, your account or your browser; we keep nothing of what you typed; our host's technical logs record the request like any other), up to five favourite games and a short bio of 200 characters at most, which is text and which anybody who opens your profile can read, so write nothing you want to keep to yourself; and, unless you hide them, the games you played, with your rank, how many you won and how many you played in each, and your last ten games with the names of the other players, each leading to their own profile. We keep it in our database, with your account, until the account is deleted: it is made from what we already hold, with no copy anywhere else. Search engines are asked not to list or read these pages. If you change your username or your tag, the old address stops working, and when you delete your account your username and tag are free for someone else. The choice to hide your game history, in your settings, hides your games, your records and your ranks from your profile for the other players: they see your username, your tag, your picture, the month you joined and what you filled in, and no games. You always see all of it on your own page, and you can change or empty each field you filled in at any time.",
            },
            {
              name: "Your friends",
              text: `You can add other members as friends, by their username and tag or from their profile. For each pair of friends we keep that they are friends and since when; for each request that waits, who sent it to whom and when; and for each member you block, that you blocked them and when. Your friends can see whether you are online, which means that our server saw you in the last two minutes, in a tab of the site or at a table, and the game you are at, and whether you wait in its lobby or are playing. They never see a table or its code, and they see no other time: not when you were last online. Nobody who is not your friend sees any of it. If you block a member, you stop being friends, the requests between you are deleted, they can no longer send you any and they are not told: a request they send seems to go, and nothing is kept. A member who is blocked sees nothing about you, and you are no longer in their list of friends. You can have up to ${MAX_FRIENDS} friends and block up to ${MAX_BLOCKS} members. A request nobody answers is deleted after ${FRIEND_REQUEST_RETENTION_DAYS} days, and one that is answered is not kept: accepting makes you friends, and declining or cancelling leaves nothing. Your friends and the members you block stay until you remove or unblock them, or until one of the accounts is deleted. While your account is closed (see "Deleting your account") you are in nobody's list.`,
            },
            {
              name: "Your games, your totals and your rank",
              text: "For each game you play, we count your games, how many you won and how long you played. When a game counts for the ranks (a ranked game, where every seat is a different account and nobody played for another), we also keep rank points for you in that game: you earn points by winning, more when your opponents are stronger than you, and you lose points by losing, more when they are weaker, and your points set your rank. Behind the points we keep a hidden rating, which says how strong a player is, and what each game did to it. The rating is hidden: it is never shown and never sent to your browser; the site shows your rank, the points a game gave or took and, from your first ranked game, your place. The best players of a game are listed on its page, for every visitor, with the name and the picture of their account, their rank and their place. Your totals, your rating and the link between you and your games are deleted with your account. Hiding your game history in your settings hides your games, your records and your ranks from your profile for the other players (see \"Your profile\"). It does not stop us from writing your games down, since your totals and your rank are made of them, it does not take you off the list of the best players of a game, and your name stays in the games of the players you played with.",
            },
            {
              name: "Deleting your account",
              text: `You delete your account yourself, in your settings. It is closed at once: you are signed out everywhere and nobody can sign in to it. We e-mail you a link to reopen it, through our e-mail provider, to the address of your account and with your name in the greeting. The link works for ${ACCOUNT_DELETION_GRACE_DAYS} days. For the link to work, we write down a scrambled form of its token (never the token), when you closed your account and the day the link stops working. That record goes when you reopen your account, or with the account.`,
            },
            {
              name: "Keeping and deleting",
              text: (
                <>
                  Your account stays until you delete it. When you do, it is closed at once and kept for {ACCOUNT_DELETION_GRACE_DAYS} days, in case you change your mind: you can reopen it with the link we e-mail you, or delete it right away from the page that
                  link opens. When the {ACCOUNT_DELETION_GRACE_DAYS} days are over, the clean-up that runs every night deletes it with what it holds: your sign-in details (e-mail address, name, picture address, password and the services linked to it), your profile (username, tag, picture address, pronouns, country, city, favourite games and bio), your
                  language and your settings, your country or region and your date of birth if you gave them, your second step if you turned it on, your friends, the requests you sent or got and the members you blocked, your totals, your rank points and your rating, and the feedback you sent with your e-mail address, screenshots included. The name, the tag and the picture that a table or a game had copied from your account are erased, and
                  your games stay as those of a deleted player, without your name or your picture. Your e-mail address can then be used for a new account. An account without an e-mail address cannot be deleted from the site, since it would have no link to be
                  reopened with: write to{" "}
                  <a className={LEGAL_LINK} href={`mailto:${CONTACT}`}>
                    {CONTACT}
                  </a>{" "}
                  and we delete it; write to us as well if you cannot reopen your account. Some things stay: the counts of the statistics, which carry a player identifier and never your account, so deleting your account cannot find them (they go by themselves, see
                  Statistics), the record that our e-mail provider keeps of the e-mails it sent, and the technical logs of our host, for the time each of them keeps them.
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
                  text: "When a table is created, joined, started or finished, or goes because nobody sits at it any more, our server counts it, with the game, the number of players, the options, whether it is open to everyone and how long it lasted. Each count carries your player identifier, never a nickname, a chat message or a table code. This runs whatever you chose in the cookie banner.",
                },
                {
                  name: "Counts with no identifier",
                  text: "A few counts carry no identifier of yours: a new random code is made for each and used once. They are a sign-in (with which provider, and whether it made the account), a sign-out, the steps of an account deletion, a friend request sent or answered, a friend removed or a member blocked (never who), feedback sent (its type, never what it says) and a request that a game refused (the error code). This runs whatever you chose in the cookie banner.",
                },
                {
                  name: "Visits",
                  text: "The pages opened, clicks, loading times and errors are counted without any identifier kept on your device. So are a few actions, by name: the steps of signing in or signing up, a search or a filter on a list (how many, never what you typed), the buttons of a game's page, the tables you open from a list and the settings you change (which, never to what). Table codes are removed from the addresses, and so are the names in the addresses of profiles. A visit to a profile is counted without a name or a tag.",
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
                {
                  name: "When you delete your account",
                  text: "These counts carry a player identifier, which is a code made from the secret of a cookie of one game on one device, or a code used once, and never your account or your e-mail address. Nothing links them to your account, so deleting it does not delete them: they go by themselves, after the time above.",
                },
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
            { name: "To give you the service", text: "Sitting you at a table, signing you in, remembering your language and your settings, keeping your games, your totals and your rank, checking your age for the games and expansions that ask for one: we could not do it without your data." },
            {
              name: "Our legitimate interest",
              text: `In running a safe site that works: limiting requests, blocking abuse, keeping technical logs, handling feedback, counting what happens at tables to fix and improve the games, and keeping a deleted account for ${ACCOUNT_DELETION_GRACE_DAYS} days, so that nobody loses it by mistake or by someone else's hand. You can object to this (see Your rights).`,
            },
            {
              name: "Your consent",
              text: ANALYTICS_ENABLED
                ? "For what the cookie banner asks: the identifier that PostHog keeps on your device and the session replays. And for the country or region you choose to record in your account. You can say no, and change your mind at any time."
                : "For the country or region you choose to record in your account. You can say no, and change your mind at any time.",
            },
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
            {
              name: "Resend",
              text: "Sends the e-mails of the site: the one that confirms an address, for our sign-in service, and the one that tells you your account is closed and holds the link to reopen it, which our servers send. Receives your e-mail address, your name (in the greeting) and the content of the e-mail (the code or the link), and keeps a record of what it sent for 30 days.",
            },
            ...(ANALYTICS_ENABLED
              ? [{ name: "PostHog", text: "Statistics, on its European cloud. Receives the counts of what happens at tables and of visits and, if you accept, the identifier and the session replays." }]
              : []),
            { name: "Sanity", text: "Stores the texts, pictures and videos of the games. Your browser loads the pictures and videos from its servers." },
            { name: "Geoapify", text: "Finds the cities you can pick for your profile, only when you search for one. Our server sends it the first letters you type in the City field and, when you save, the name and the country of the city you picked, to check that it exists. It receives our server's address and not you, your account or your browser. It is a company registered in Cyprus and handles those letters under its own policy." },
            { name: "Google, Discord, Steam and Twitch", text: "Only if you sign in with them or link them to your account (Twitch can only be linked). They learn that you sign in to this site and handle your data under their own policies. For Steam, our server also asks its operator, Valve, to confirm the sign-in and for the name and the picture of your profile." },
            { name: "The other people at your table", text: "See your nickname, or the name and picture of your account, and your chat messages." },
            { name: "Your friends", text: "See whether you are online and the game you are at, and whether you wait in its lobby or play. Never a table, its code or when you were last online. A member you blocked, and anyone who is not your friend, see none of it." },
            { name: "Every visitor, for a public table", text: "A table that its host made public, or that a search opened, is listed while it waits for players: anyone who opens the site sees the nicknames or account names and pictures of the people who sit at it, and what was asked for (a minimum rank, a language, the speed, the number of seats, whether it counts for the rank). When you press Play, the search sits you at such a table for each game you picked, until a game begins or you stop looking. Chat messages are not shown." },
            { name: "Every visitor of a game's page", text: "See the best players of the game: the name and the picture of their account, their rank and their place. Never a rating, and never the games behind it." },
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
          You can delete your account yourself, in your settings (see Keeping and deleting). To use your other rights, or if you cannot, write to{" "}
          <a className={LEGAL_LINK} href={`mailto:${CONTACT}`}>
            {CONTACT}
          </a>
          . We answer within one month. We may ask for proof that the data is yours. With an account, tell us the e-mail address of the account (if you signed in with Steam, which gives none, the link of your Steam profile). As a guest you are only a random secret in a cookie, so we can only find your data if you tell us the link of the table and the
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
