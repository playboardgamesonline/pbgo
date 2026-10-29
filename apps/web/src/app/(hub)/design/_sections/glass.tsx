import { GlassLab } from "../_components/glass-lab"
import { Demo, Section } from "../_components/layout"

export function GlassSection() {
  return (
    <Section
      id="glass"
      intro="A container that floats over the page, an island of the navbar, the dock, a panel, a bar, a menu, a chat, is `glass`: the grey of a card, of which it keeps some (`--glass-opacity`), over a blur (`--glass-blur`) that saturates what it blurs (`--glass-saturate`). The three settings, and the grey, are on `.platform` and the same for every container: no component picks its own. Move them here: the samples are real components, and the values to keep are printed under the sliders."
    >
      <Demo
        title="The settings, live"
        description="What the glass lets through is the page behind it: here, big shapes of the colours of the platform and a title. With the opacity at 100% nothing shows through, whatever the blur is; the lower it goes, the more the blur and the saturation matter. The grey (`--card`) is also the one of the cards and the dialogs."
        className="p-0"
        code={`.platform {
  --card: oklch(0.237 0 0);
  --glass-opacity: 94%;
  --glass-blur: 24px;
  --glass-saturate: 100%;
}`}
      >
        <GlassLab />
      </Demo>
    </Section>
  )
}
