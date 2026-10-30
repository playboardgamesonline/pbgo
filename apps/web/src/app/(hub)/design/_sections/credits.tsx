import { CreditLink } from "@pbgo/ui/platform/credit-link"
import { Demo, Section } from "../_components/layout"

export function CreditLinks() {
  return (
    <Section
      id="credit-link"
      module="credit-link"
      intro="A name in the credits of a game's page that leads somewhere else, a publisher's: the icon of its website at the left of its name, the two being one link that opens in a new tab (`target=_blank`, `rel=noopener noreferrer`). The icon is an image of this site's own: the catalog route `/api/catalog/<slug>/publisher-<n>` looks for it on the publisher's website (its page's `rel=icon` links, else `/favicon.ico`) and the CDN keeps it, so a visitor's browser never asks that website for anything. It is decorative (`alt=''`), the name is what the link says. Its place, 16px, is kept from the first paint so that the name does not move when the icon comes in; a website with no icon, or one that cannot be had, leaves the name alone, and so does a publisher with no website (a name, no link). The picture is only asked for once the page is interactive, so that a failure is always heard."
    >
      <Demo
        title="In the credits of a game"
        description="The lines of a game's page, as it draws them: names for the designers and the artists, and for the publishers a link with its icon. The second publisher's icon cannot be had (the address is one nobody serves), so its name stands alone; the third has no website."
        code={`<CreditLink href="https://www.cocktailgames.com" icon="/api/catalog/hanabi/publisher-0?v=…">
  Cocktail Games
</CreditLink>`}
      >
        <dl className="grid max-w-md grid-cols-[auto_1fr] gap-x-8 gap-y-3">
          <dt className="text-muted-foreground">Designer</dt>
          <dd>Antoine Bauza</dd>
          <dt className="text-muted-foreground">Artist</dt>
          <dd>Laura Michaud</dd>
          <dt className="text-muted-foreground">Publishers</dt>
          <dd>
            <CreditLink href="https://playboardgamesonline.app" icon="/favicon.ico">
              Cocktail Games
            </CreditLink>
            {", "}
            <CreditLink href="https://playboardgamesonline.app" icon="/design/no-such-icon.png">
              Oya
            </CreditLink>
            {", Spiral Éditions"}
          </dd>
        </dl>
      </Demo>
    </Section>
  )
}
