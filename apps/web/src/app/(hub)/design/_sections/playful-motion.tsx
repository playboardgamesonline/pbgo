import { Bullets, Section } from "../_components/layout"
import { TitleMotionLab } from "../_components/title-motion-lab"

/** The pieces of the home's title, each moved five ways, to choose the one whose values go into the guidelines. */
export function PlayfulMotion() {
  return (
    <Section
      id="playful-motion"
      intro="The platform's own motion is calm on purpose (three short durations and one easing, above). The pieces of the home's title are where it may play: a die that rolls, a coin that spins, a suit that rolls up into the next. Each is moved here five ways, with the easing and the duration written under it, on the table of the hero, so that the one that is right can be chosen by eye. The values of the one that is chosen go into `@pbgo/ui/motion` and into this page, and the others are taken out."
    >
      <TitleMotionLab />
      <Bullets
        items={[
          "What makes a move playful is rarely its curve alone: a wind-up before it, a hop and a squash while it flies, a settle on a spring after it, a pop of size at its fastest moment.",
          "A visitor who asks for less motion gets the pieces still, whatever is chosen here: nothing in the title needs to move to be read.",
        ]}
      />
    </Section>
  )
}
