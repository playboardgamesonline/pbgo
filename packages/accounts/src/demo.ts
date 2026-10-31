// The demo account of development: a way to see the pages of a signed-in visitor on a machine where no provider is set up (docs/accounts.md). It is
// a cookie that a development server alone honours (`/auth/demo` sets it, and answers 404 in a build), and the account it stands for is not in any
// database. Pure, so that the server, the browser and the tests read it the same way.

import type { Account } from "./account"

/** The cookie that says the visitor is the demo account. Readable by the browser, since it holds nothing. */
export const DEMO_COOKIE = "pbgo_demo_account"

/**
 * The picture of the demo account: a small pixel-art face on a bold gradient, drawn once with DiceBear's Pixel Art style (CC0) and kept as a data URI, so that nothing is a file
 * (`apps/web/public` holds none) and it works offline. It is small because this module is in what every page loads: the pictures of the people of the demo are in `./demo-avatars`.
 */
const DEMO_AVATAR = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16' fill='none' shape-rendering='crispEdges' width='96' height='96'%3E%3Cmetadata xmlns:rdf='http://www.w3.org/1999/02/22-rdf-syntax-ns%23' xmlns:xsi='http://www.w3.org/2001/XMLSchema-instance' xmlns:dc='http://purl.org/dc/elements/1.1/' xmlns:dcterms='http://purl.org/dc/terms/'%3E%3Crdf:RDF%3E%3Crdf:Description%3E%3Cdc:title%3EPixel Art%3C/dc:title%3E%3Cdc:creator%3EDiceBear%3C/dc:creator%3E%3Cdc:source xsi:type='dcterms:URI'%3Ehttps://www.figma.com/community/file/1198754108850888330%3C/dc:source%3E%3Cdcterms:license xsi:type='dcterms:URI'%3Ehttps://creativecommons.org/publicdomain/zero/1.0/%3C/dcterms:license%3E%3Cdc:rights%3E„Pixel Art” (https://www.figma.com/community/file/1198754108850888330) by „DiceBear”, licensed under „CC0 1.0” (https://creativecommons.org/publicdomain/zero/1.0/)%3C/dc:rights%3E%3C/rdf:Description%3E%3C/rdf:RDF%3E%3C/metadata%3E%3Cmask id='viewboxMask'%3E%3Crect width='16' height='16' rx='0' ry='0' x='0' y='0' fill='%23fff' /%3E%3C/mask%3E%3Cg mask='url(%23viewboxMask)'%3E%3Crect fill='url(%23backgroundLinear)' width='16' height='16' x='0' y='0' /%3E%3Cdefs%3E%3ClinearGradient id='backgroundLinear' gradientTransform='rotate(147 0.5 0.5)'%3E%3Cstop stop-color='%23ff6b6b'/%3E%3Cstop offset='1' stop-color='%23eb459e'/%3E%3C/linearGradient%3E%3C/defs%3E%3Cpath d='M4 2h8v1h1v3h1v2h-1v3h-1v1H9v1h4v1h1v2H2v-2h1v-1h4v-1H4v-1H3V8H2V6h1V3h1V2Z' fill='%23e0b687'/%3E%3Cpath d='M4 2h8v1h1v3h1v2h-1v3h-1v1H4v-1H3V8H2V6h1V3h1V2Z' fill='%23fff' fill-opacity='.1'/%3E%3Cpath d='M6 14H4v1H3v1h4v-1H6v-1ZM12 15h1v1H9v-1h1v-1h2v1Z' fill='%23ffc425'/%3E%3Cpath d='M10 5h1v2H9V6h1V5ZM5 5h1v2H4V6h1V5Z' fill='%23fff'/%3E%3Cpath fill='%23876658' d='M11 6h-1v1h1zM6 6H5v1h1z'/%3E%3Cpath d='M9 9v1H7v1H6v-1h1V9h2Z' fill='%23de0f0d'/%3E%3Cpath d='M3 4h1v3H3zM12 4h1v3h-1zM3 2h10v2H3z' fill='%2383623b'/%3E%3Cpath d='M12 1H4v1H3v2h12V3h-2V2h-1V1Z' fill='%23614f8a'/%3E%3C/g%3E%3C/svg%3E"

/** The demo account: a name and a made-up picture. */
export const DEMO_ACCOUNT: Account = {
  id: "demo",
  nickname: "Oré",
  email: null,
  avatarUrl: DEMO_AVATAR,
  provider: null,
  createdAt: "2026-10-01T09:00:00.000Z",
}

/** Whether this code runs in development: the one case where the demo account exists. Inlined by the build, so a production bundle holds none of it. */
export const demoAllowed = (): boolean => process.env.NODE_ENV !== "production"
