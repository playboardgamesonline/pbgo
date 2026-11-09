import { composeDeletionMail, type DeletionMailInput } from "@pbgo/core/lib/deletion-mail"
import { CONTACT, MAIL_FROM, SITE_NAME } from "@/site"

/** The e-mail that asks a member to confirm the deletion of their account (PLT-36): the words are core's (`composeDeletionMail`, tested), the name, the contact address and the sender are the site's. */
export const deletionMail = (input: DeletionMailInput) => composeDeletionMail({ siteName: SITE_NAME, contact: CONTACT, from: MAIL_FROM }, input)
