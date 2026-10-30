import { Bullets, Section } from "../_components/layout"
import { TitleMotionLab } from "../_components/title-motion-lab"

/** The three moves that were chosen for the pieces of the home's title, with their values. */
export function PlayfulMotion() {
  return (
    <Section
      id="playful-motion"
      intro="The platform's own motion is calm on purpose (three short durations and one easing, above). The pieces of the home's title are where it may play: a die that rolls, a coin that is tossed, a wheel of suits, two cards that fold up. Each move was chosen and calmed a little: these are the four moves, played by the real pieces (`TitleDie`, `TitleCoin`, `TitleSuits`, `TitleCards`) at a faster tempo than the home's, with the values that the pieces read from `PLAYFUL` of `@pbgo/ui/motion`."
    >
      <TitleMotionLab />
      <Bullets
        items={[
          "What makes a move playful is rarely its curve alone: a swell toward the viewer at the fastest moment, a dip before the toss, a squash on landing, a stretch at speed, a little past the stop and back on a spring.",
          "The curves are exponential or cubic in and out for what travels, a long ease-out for what spins down and a spring for what settles: never a linear move, never more than one thing at a time that is not the piece itself.",
          "They are rare (every fifteen seconds, the coin every twenty-five or so) and each piece has its own moment, so that the title is never busy; a visitor who asks for less motion gets them still: the die on its six, the suit a heart, the coin on its profile, the cards in their fan.",
          "To change a move, change its values in `PLAYFUL`; the pieces and this page follow.",
        ]}
      />
    </Section>
  )
}
