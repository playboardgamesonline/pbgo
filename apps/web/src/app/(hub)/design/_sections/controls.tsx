import { HugeiconsIcon } from "@hugeicons/react"
import {
  Add01Icon,
  ArrowRight01Icon,
  CheckmarkCircle02Icon,
  Download01Icon,
  Mail01Icon,
  Search01Icon,
} from "@hugeicons/core-free-icons"
import { PROVIDERS, PROVIDER_NAMES } from "@pbgo/accounts"
import { Badge } from "@pbgo/ui/platform/badge"
import { Button } from "@pbgo/ui/platform/button"
import { Checkbox } from "@pbgo/ui/platform/checkbox"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@pbgo/ui/platform/field"
import { Input } from "@pbgo/ui/platform/input"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
  InputGroupText,
} from "@pbgo/ui/platform/input-group"
import { Label } from "@pbgo/ui/platform/label"
import { ProviderButton } from "@pbgo/ui/platform/provider-button"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@pbgo/ui/platform/select"
import { Slider } from "@pbgo/ui/platform/slider"
import { Spinner } from "@pbgo/ui/platform/spinner"
import { Switch } from "@pbgo/ui/platform/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@pbgo/ui/platform/tabs"
import { Textarea } from "@pbgo/ui/platform/textarea"
import { ToggleGroup, ToggleGroupItem } from "@pbgo/ui/platform/toggle-group"
import { Demo, Section } from "../_components/layout"
import { ComboboxSpecimen } from "../_components/combobox-specimen"
import { MeterSpecimen } from "../_components/meter-specimen"
import { RangeSliderSpecimen, SingleSliderSpecimen } from "../_components/slider-specimen"

const ROW = "flex flex-wrap items-center gap-3"

export function Buttons() {
  return (
    <Section
      id="button"
      module="button"
      intro="Every action is a `Button`. The variant says how much an action weighs, the size how dense its surroundings are. Rounded by the control step (`rounded-xl`, smaller for the small sizes), `text-sm`, one weight."
    >
      <Demo
        title="Variants"
        description="`default` is the one main action of a screen, `outline` and `secondary` the others. `ghost` lives in toolbars, `destructive` is for what cannot be undone, `link` sits inside a sentence."
        className={ROW}
        code={`<Button>Create a table</Button>
<Button variant="outline">Join</Button>
<Button variant="secondary">Rules</Button>
<Button variant="ghost">Cancel</Button>
<Button variant="destructive">Delete table</Button>
<Button variant="link">Learn more</Button>`}
      >
        <Button>Create a table</Button>
        <Button variant="outline">Join</Button>
        <Button variant="secondary">Rules</Button>
        <Button variant="ghost">Cancel</Button>
        <Button variant="destructive">Delete table</Button>
        <Button variant="link">Learn more</Button>
      </Demo>

      <Demo
        title="Sizes"
        description="`default` is `h-9`. Use `sm` and `xs` inside dense UI (tables, toolbars, the admin), `lg` for a hero action."
        className={ROW}
        code={`<Button size="xs">Extra small</Button>
<Button size="sm">Small</Button>
<Button>Default</Button>
<Button size="lg">Large</Button>`}
      >
        <Button size="xs">Extra small</Button>
        <Button size="sm">Small</Button>
        <Button>Default</Button>
        <Button size="lg">Large</Button>
      </Demo>

      <Demo
        title="Icon buttons"
        description="Square, one per size. Give each an `aria-label`: there is no text to name it."
        className={ROW}
        code={`<Button variant="outline" size="icon-xs" aria-label="Search">
  <HugeiconsIcon icon={Search01Icon} strokeWidth={2} />
</Button>`}
      >
        <Button variant="outline" size="icon-xs" aria-label="Search">
          <HugeiconsIcon icon={Search01Icon} strokeWidth={2} />
        </Button>
        <Button variant="outline" size="icon-sm" aria-label="Search">
          <HugeiconsIcon icon={Search01Icon} strokeWidth={2} />
        </Button>
        <Button variant="outline" size="icon" aria-label="Search">
          <HugeiconsIcon icon={Search01Icon} strokeWidth={2} />
        </Button>
        <Button variant="outline" size="icon-lg" aria-label="Search">
          <HugeiconsIcon icon={Search01Icon} strokeWidth={2} />
        </Button>
      </Demo>

      <Demo
        title="With an icon"
        description="Mark the icon `data-icon=&quot;inline-start&quot;` or `inline-end`: the button trims the padding on that side."
        className={ROW}
        code={`<Button>
  <HugeiconsIcon icon={Add01Icon} strokeWidth={2} data-icon="inline-start" />
  New table
</Button>
<Button variant="outline">
  Next
  <HugeiconsIcon icon={ArrowRight01Icon} strokeWidth={2} data-icon="inline-end" />
</Button>`}
      >
        <Button>
          <HugeiconsIcon icon={Add01Icon} strokeWidth={2} data-icon="inline-start" />
          New table
        </Button>
        <Button variant="outline">
          Next
          <HugeiconsIcon icon={ArrowRight01Icon} strokeWidth={2} data-icon="inline-end" />
        </Button>
        <Button variant="secondary">
          <HugeiconsIcon icon={Download01Icon} strokeWidth={2} data-icon="inline-start" />
          Export
        </Button>
      </Demo>

      <Demo
        title="States, and as a link"
        description="A disabled button fades and ignores the pointer. `asChild` gives the button look to the element you pass, here an anchor."
        className={ROW}
        code={`<Button disabled>Disabled</Button>
<Button disabled>
  <Spinner data-icon="inline-start" />
  Saving
</Button>
<Button asChild variant="outline">
  <a href="/legal">Legal notice</a>
</Button>`}
      >
        <Button disabled>Disabled</Button>
        <Button variant="outline" disabled>
          Disabled
        </Button>
        <Button disabled>
          <Spinner data-icon="inline-start" />
          Saving
        </Button>
        <Button asChild variant="outline">
          <a href="#button">A link, styled as a button</a>
        </Button>
      </Demo>
    </Section>
  )
}

export function ProviderButtons() {
  return (
    <Section
      id="provider-button"
      module="provider-button"
      intro="The sign-in's buttons: one per provider, side by side, with nothing on them but the provider's small mark (20px, `size-5`). Each tile is its brand's: Facebook's blue and Discord's blurple (`brand-facebook`, `brand-discord`, the brand's own colours, the only two the platform takes from a brand), Google's white (`foreground`) with its four colours, Apple's black (`background`) with an outline. The marks are the brands' own (`@pbgo/ui/brands`, the one file of the design system that has colour literals) and are never redrawn. A tile is `h-10`, `rounded-xl` and fills its cell, so it is wider than it is tall (about two to one in the sign-in's row of four) and they go in a grid of equal columns; each is named `Continue with <name>` for a screen reader and in a tooltip."
    >
      <Demo
        title="A row of four"
        description="The order of the sign-in: Facebook, Google, Apple, Discord (`PROVIDERS` of `@pbgo/accounts`). Hover one to see its tooltip; the tile of a brand dims a little under the pointer."
        className="grid max-w-md grid-cols-4 gap-3"
        code={`<div role="group" aria-label="Sign in with" className="grid grid-cols-4 gap-3">
  {PROVIDERS.map((provider) => (
    <ProviderButton key={provider} brand={provider} name={PROVIDER_NAMES[provider]} onClick={() => start(provider)} />
  ))}
</div>`}
      >
        {PROVIDERS.map((provider) => (
          <ProviderButton key={provider} brand={provider} name={PROVIDER_NAMES[provider]} />
        ))}
      </Demo>

      <Demo
        title="Pending, and off"
        description="While a sign-in is on its way, its mark gives way to a spinner (`pending`) and the others are off (`disabled`, half faded, deaf to the pointer): the spinner takes the colour of the tile's text, so it reads on a white tile as on a blue one."
        className="grid max-w-md grid-cols-4 gap-3"
        code={`<ProviderButton brand="google" name="Google" pending />
<ProviderButton brand="apple" name="Apple" disabled />`}
      >
        {PROVIDERS.map((provider) => (
          <ProviderButton key={provider} brand={provider} name={PROVIDER_NAMES[provider]} pending disabled />
        ))}
        {PROVIDERS.map((provider) => (
          <ProviderButton key={provider} brand={provider} name={PROVIDER_NAMES[provider]} disabled />
        ))}
      </Demo>
    </Section>
  )
}

export function Badges() {
  return (
    <Section
      id="badge"
      module="badge"
      intro="A short label: a status, a count, a category. Never an action; for that, use a `Button`."
    >
      <Demo
        title="Variants"
        className={ROW}
        code={`<Badge>Live</Badge>
<Badge variant="secondary">Beta</Badge>
<Badge variant="outline">2–5 players</Badge>
<Badge variant="destructive">Offline</Badge>
<Badge variant="ghost">Draft</Badge>
<Badge variant="link">Link</Badge>`}
      >
        <Badge>Live</Badge>
        <Badge variant="secondary">Beta</Badge>
        <Badge variant="outline">2–5 players</Badge>
        <Badge variant="destructive">Offline</Badge>
        <Badge variant="ghost">Draft</Badge>
        <Badge variant="link">Link</Badge>
      </Demo>

      <Demo
        title="With an icon, and as a link"
        className={ROW}
        code={`<Badge variant="secondary">
  <HugeiconsIcon icon={CheckmarkCircle02Icon} strokeWidth={2} data-icon="inline-start" />
  Ready
</Badge>
<Badge asChild variant="outline">
  <a href="/courtisans">Courtisans</a>
</Badge>`}
      >
        <Badge variant="secondary">
          <HugeiconsIcon icon={CheckmarkCircle02Icon} strokeWidth={2} data-icon="inline-start" />
          Ready
        </Badge>
        <Badge asChild variant="outline">
          <a href="#badge">A badge that links</a>
        </Badge>
      </Demo>
    </Section>
  )
}

export function Inputs() {
  return (
    <Section
      id="input"
      module="field"
      intro="Text entry is `Input` and `Textarea`. In a form, wrap each in a `Field` with its label, help and error. `InputGroup` adds an icon, a prefix or a button to the edge of an input."
    >
      <Demo
        title="Input and textarea"
        description="Pass `aria-invalid` for the error state: the field turns red and its ring follows."
        className="grid gap-4 md:grid-cols-2"
        code={`<Input placeholder="Your nickname" />
<Input defaultValue="Ana" />
<Input disabled placeholder="Disabled" />
<Input aria-invalid defaultValue="Not an email" />
<Textarea placeholder="Tell us what happened" />`}
      >
        <Input placeholder="Your nickname" aria-label="Placeholder" />
        <Input defaultValue="Ana" aria-label="Filled" />
        <Input disabled placeholder="Disabled" aria-label="Disabled" />
        <Input aria-invalid defaultValue="Not an email" aria-label="Invalid" />
        <Textarea className="md:col-span-2" placeholder="Tell us what happened" aria-label="Message" />
      </Demo>

      <Demo
        title="Field"
        description="`Field` stacks a label, a control, a description and an error, and `FieldGroup` spaces several of them. Set `data-invalid` on the field so its text turns red too."
        code={`<FieldSet>
  <FieldLegend>Create a table</FieldLegend>
  <FieldGroup>
    <Field>
      <FieldLabel htmlFor="nickname">Nickname</FieldLabel>
      <Input id="nickname" placeholder="Ana" />
      <FieldDescription>Shown to the other players.</FieldDescription>
    </Field>
    <Field data-invalid>
      <FieldLabel htmlFor="email">Email</FieldLabel>
      <Input id="email" type="email" aria-invalid />
      <FieldError errors={[{ message: "Enter a valid email address." }]} />
    </Field>
    <Field orientation="horizontal">
      <Checkbox id="terms" />
      <FieldLabel htmlFor="terms">I accept the rules of the table</FieldLabel>
    </Field>
  </FieldGroup>
</FieldSet>`}
      >
        <FieldSet className="max-w-sm">
          <FieldLegend>Create a table</FieldLegend>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="field-nickname">Nickname</FieldLabel>
              <Input id="field-nickname" placeholder="Ana" />
              <FieldDescription>Shown to the other players.</FieldDescription>
            </Field>
            <Field data-invalid>
              <FieldLabel htmlFor="field-email">Email</FieldLabel>
              <Input id="field-email" type="email" defaultValue="ana@" aria-invalid />
              <FieldError errors={[{ message: "Enter a valid email address." }]} />
            </Field>
            <Field orientation="horizontal">
              <Checkbox id="field-terms" defaultChecked />
              <FieldLabel htmlFor="field-terms">I accept the rules of the table</FieldLabel>
            </Field>
          </FieldGroup>
        </FieldSet>
      </Demo>

      <Demo
        title="Input group"
        description="The addon sits inside the same rounded frame as the input, so focus and error states cover both."
        className="flex flex-col gap-4"
        code={`<InputGroup>
  <InputGroupAddon>
    <HugeiconsIcon icon={Search01Icon} strokeWidth={2} />
  </InputGroupAddon>
  <InputGroupInput placeholder="Search a game" />
  <InputGroupAddon align="inline-end">
    <InputGroupButton size="xs">Search</InputGroupButton>
  </InputGroupAddon>
</InputGroup>

<InputGroup>
  <InputGroupAddon>
    <InputGroupText>
      <HugeiconsIcon icon={Mail01Icon} strokeWidth={2} />
      Email
    </InputGroupText>
  </InputGroupAddon>
  <InputGroupInput type="email" placeholder="ana@example.com" />
</InputGroup>`}
      >
        <InputGroup className="max-w-sm">
          <InputGroupAddon>
            <HugeiconsIcon icon={Search01Icon} strokeWidth={2} />
          </InputGroupAddon>
          <InputGroupInput placeholder="Search a game" aria-label="Search a game" />
          <InputGroupAddon align="inline-end">
            <InputGroupButton size="xs">Search</InputGroupButton>
          </InputGroupAddon>
        </InputGroup>
        <InputGroup className="max-w-sm">
          <InputGroupAddon>
            <InputGroupText>
              <HugeiconsIcon icon={Mail01Icon} strokeWidth={2} />
              Email
            </InputGroupText>
          </InputGroupAddon>
          <InputGroupInput type="email" placeholder="ana@example.com" aria-label="Email" />
        </InputGroup>
      </Demo>
    </Section>
  )
}

export function Checks() {
  return (
    <Section
      id="checkbox"
      module="checkbox"
      intro="A `Checkbox` is one box in a list of options, a `Switch` is a setting that applies at once. Both pair with a `Label`."
    >
      <Demo
        title="Checkbox"
        className="flex flex-col gap-3"
        code={`<div className="flex items-center gap-2">
  <Checkbox id="notify" defaultChecked />
  <Label htmlFor="notify">Notify me when it is my turn</Label>
</div>`}
      >
        <div className="flex items-center gap-2">
          <Checkbox id="check-a" />
          <Label htmlFor="check-a">Unchecked</Label>
        </div>
        <div className="flex items-center gap-2">
          <Checkbox id="check-b" defaultChecked />
          <Label htmlFor="check-b">Checked</Label>
        </div>
        <div className="flex items-center gap-2">
          <Checkbox id="check-c" disabled />
          <Label htmlFor="check-c">Disabled</Label>
        </div>
        <div className="flex items-center gap-2">
          <Checkbox id="check-d" aria-invalid />
          <Label htmlFor="check-d">Invalid</Label>
        </div>
      </Demo>

      <Demo
        title="Switch"
        description="Two sizes. The thumb is `foreground` when off and `primary-foreground` when on."
        className="flex flex-col gap-3"
        code={`<div className="flex items-center gap-2">
  <Switch id="sound" defaultChecked />
  <Label htmlFor="sound">Sound</Label>
</div>
<Switch size="sm" />`}
      >
        <div className="flex items-center gap-2">
          <Switch id="switch-a" />
          <Label htmlFor="switch-a">Off</Label>
        </div>
        <div className="flex items-center gap-2">
          <Switch id="switch-b" defaultChecked />
          <Label htmlFor="switch-b">On</Label>
        </div>
        <div className="flex items-center gap-2">
          <Switch id="switch-c" size="sm" defaultChecked />
          <Label htmlFor="switch-c">Small</Label>
        </div>
        <div className="flex items-center gap-2">
          <Switch id="switch-d" disabled />
          <Label htmlFor="switch-d">Disabled</Label>
        </div>
      </Demo>
    </Section>
  )
}

export function Selects() {
  return (
    <Section
      id="select"
      module="select"
      intro="A choice among a handful of options, in a popover that opens over the trigger. For two options, prefer a `Switch`; for a dozen or more, a search."
    >
      <Demo
        title="Default and small"
        description="Groups take a `SelectLabel`; `SelectSeparator` splits them. The trigger comes in `default` and `sm`."
        className={ROW}
        code={`<Select defaultValue="en">
  <SelectTrigger className="w-48">
    <SelectValue placeholder="Language" />
  </SelectTrigger>
  <SelectContent>
    <SelectGroup>
      <SelectLabel>Language</SelectLabel>
      <SelectItem value="fr">Français</SelectItem>
      <SelectItem value="en">English</SelectItem>
    </SelectGroup>
    <SelectSeparator />
    <SelectGroup>
      <SelectLabel>Other</SelectLabel>
      <SelectItem value="auto">Follow my browser</SelectItem>
    </SelectGroup>
  </SelectContent>
</Select>

<Select defaultValue="3">
  <SelectTrigger size="sm" className="w-36">
    <SelectValue placeholder="Players" />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="2">2 players</SelectItem>
    <SelectItem value="3">3 players</SelectItem>
  </SelectContent>
</Select>

<Select disabled>
  <SelectTrigger className="w-48">
    <SelectValue placeholder="Disabled" />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="none">Nothing</SelectItem>
  </SelectContent>
</Select>`}
      >
        <Select defaultValue="en">
          <SelectTrigger className="w-48" aria-label="Language">
            <SelectValue placeholder="Language" />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectLabel>Language</SelectLabel>
              <SelectItem value="fr">Français</SelectItem>
              <SelectItem value="en">English</SelectItem>
              <SelectItem value="es">Español</SelectItem>
              <SelectItem value="de">Deutsch</SelectItem>
            </SelectGroup>
            <SelectSeparator />
            <SelectGroup>
              <SelectLabel>Other</SelectLabel>
              <SelectItem value="auto">Follow my browser</SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>
        <Select defaultValue="3">
          <SelectTrigger size="sm" className="w-36" aria-label="Players">
            <SelectValue placeholder="Players" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="2">2 players</SelectItem>
            <SelectItem value="3">3 players</SelectItem>
            <SelectItem value="4">4 players</SelectItem>
            <SelectItem value="5">5 players</SelectItem>
          </SelectContent>
        </Select>
        <Select disabled>
          <SelectTrigger className="w-48" aria-label="Disabled">
            <SelectValue placeholder="Disabled" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Nothing</SelectItem>
          </SelectContent>
        </Select>
      </Demo>
    </Section>
  )
}

export function Comboboxes() {
  return (
    <Section
      id="combobox"
      module="combobox"
      intro="A list of options with a search field above it, for a panel that has more options than chips can hold: the categories of the games. An option is a name and, if it wants one, an icon at the start of its row; the check of a pick is at the other end. The rows go from one edge of the panel to the other. Typing keeps the options that hold the text, whatever the case and the accents. Any number can be picked, so the list stays open. It draws nothing around itself: put it in a `Popover` with no padding of its own (`p-0`), which gives it its title, its Clear button and its place."
    >
      <Demo
        title="In a popover"
        description="The field has the focus the moment the panel opens, except on a screen that is touched, where the keyboard would hide the list. The list has no scrollbar and scrolls all the same: a row cut by its bottom edge says there is more. The panel is `w-52`, its header is not padded as much as a panel's (`pt-2 pr-2 pb-1 pl-4`) and the field has a margin of 8px of its own. The arrow keys move along the list without leaving the field, Home and End go to its ends, Enter picks or unpicks the option they are on, and so does a click. The field is `text-base` on a phone, like every input, so iOS does not zoom in on it. Try `des` or `strat`: the accents do not matter."
        className={ROW}
        code={`<Popover>
  <PopoverTrigger asChild>
    <Button variant="outline">Categories</Button>
  </PopoverTrigger>
  <PopoverContent aria-label="Categories" className="w-52 gap-0 p-0">
    <PopoverHeader className="pt-2 pr-2 pb-1 pl-4">
      <PopoverTitle>Categories</PopoverTitle>
      <Button type="button" variant="ghost" size="sm">Clear</Button>
    </PopoverHeader>
    <Combobox
      options={[{ value: "Cooperation", icon: HandHelpingIcon }, { value: "Dés" }]}
      value={picked}
      onValueChange={setPicked}
      aria-label="Categories"
      placeholder="Search categories..."
      empty="No category matches."
    />
  </PopoverContent>
</Popover>`}
      >
        <ComboboxSpecimen />
      </Demo>
    </Section>
  )
}

export function Sliders() {
  return (
    <Section
      id="slider"
      module="slider"
      intro="A slider for a value or a range along a scale: one thumb, or two for a range, a track that fills between them (from the start with one thumb) and, for a scale of a few stops, a dot on the track at each. It is Radix's `Slider` with one change: Radix keeps a thumb inside the slider by shifting it by half its width, which it has to measure, so a thumb drawn at its full size sits somewhere else on the server than in the browser. Here the thumb itself has no size, its centre is exactly where the fill, the dots and the pointer put it, and the handle, a white vertical capsule 8px wide and 20px high, is drawn around that centre. The handles stick out of the track by half their width at each end, so leave that room around the slider (a margin of `mx-1`). It is `touch-none`: a finger drags a thumb instead of scrolling the page."
    >
      <Demo
        title="One thumb"
        description="The fill runs from the start to the thumb. `ticks` draws a dot at each step, for a scale of a few stops, where the thumb jumps from one to the next. A screen reader hears the number of the thumb; `valueText` says what it stands for, and `thumbLabels` what each thumb is. The hub's duration filter is one of these on twelve steps: up to 5 minutes, then 10, 15 and so on to 55, and `1h+`, the last step, which is no limit; it has no dots, the track and its fill are enough. `ticks` can list the values worth a dot instead of marking every step."
        code={`<Slider
  min={1}
  max={5}
  step={1}
  value={[level]}
  onValueChange={([next]) => setLevel(next)}
  ticks
  thumbLabels={["Level"]}
  valueText={(value) => \`Level \${value} of 5\`}
/>`}
      >
        <SingleSliderSpecimen />
      </Demo>

      <Demo
        title="A range"
        description="Two thumbs light what is between them. `minStepsBetweenThumbs` keeps them from meeting."
        code={`<Slider
  min={0}
  max={100}
  step={10}
  minStepsBetweenThumbs={1}
  value={range}
  onValueChange={setRange}
  ticks
  thumbLabels={["From", "To"]}
/>`}
      >
        <RangeSliderSpecimen />
      </Demo>

      <Demo
        title="Disabled"
        description="`disabled` is Radix's: half opacity, no pointer, no focus. There is no state for a slider that has not been touched: it always shows what it is set to, and a limit that is no limit puts the thumb at the end, with the fill covering the whole track."
        className="max-w-sm px-8"
        code={`<Slider min={0} max={6} defaultValue={[2, 4]} minStepsBetweenThumbs={1} ticks disabled />`}
      >
        <Slider min={0} max={6} defaultValue={[2, 4]} minStepsBetweenThumbs={1} ticks disabled />
      </Demo>
    </Section>
  )
}

export function Meters() {
  return (
    <Section
      id="meter"
      module="meter"
      intro="A scale of a few levels drawn as bars of the same height that you fill from the first bar up to a level by pressing that bar. The hub uses it for how complex a game is, from light to heavy: the weight BoardGameGeek gives it, from 1 to 5, rounded. Each bar is a button (the level that is picked is `aria-pressed`, and each says in its label what it stands for), so the keyboard and a screen reader get what a pointer gets. Pressing the picked level again clears it, unless the scale is not `clearable`: then it always has a level."
    >
      <Demo
        title="Levels"
        description="With a mouse, the bars up to the pointer light up faintly before the press, so the fill can be seen coming. The bars are all 16px high (`h-4`), and `levels` is the number of bars (five by default)."
        code={`<Meter
  value={level}
  onValueChange={setLevel}
  levelLabel={(level) => \`Up to \${level} of 5\`}
/>`}
      >
        <MeterSpecimen />
      </Demo>

      <Demo
        title="Never empty"
        description="`clearable={false}` keeps the level that is picked when it is pressed again, for a scale that always has one: the hub's complexity starts on 3 and never goes below 1."
        code={`<Meter
  value={level}
  clearable={false}
  onValueChange={(next) => next !== null && setLevel(next)}
  levelLabel={(level) => \`Up to \${level} of 5\`}
/>`}
      >
        <MeterSpecimen clearable={false} />
      </Demo>
    </Section>
  )
}

export function TabsSection() {
  return (
    <Section
      id="tabs"
      module="tabs"
      intro="Switches between panels of the same page without leaving it. The list comes as a filled pill (`default`) or as an underlined row (`line`), horizontal or vertical."
    >
      <Demo
        title="Default"
        code={`<Tabs defaultValue="rules">
  <TabsList>
    <TabsTrigger value="rules">Rules</TabsTrigger>
    <TabsTrigger value="players">Players</TabsTrigger>
  </TabsList>
  <TabsContent value="rules">…</TabsContent>
  <TabsContent value="players">…</TabsContent>
</Tabs>`}
      >
        <Tabs defaultValue="rules">
          <TabsList>
            <TabsTrigger value="rules">Rules</TabsTrigger>
            <TabsTrigger value="players">Players</TabsTrigger>
            <TabsTrigger value="history">History</TabsTrigger>
          </TabsList>
          <TabsContent value="rules" className="pt-2 text-sm text-muted-foreground">
            Everything a player needs to know before the first turn.
          </TabsContent>
          <TabsContent value="players" className="pt-2 text-sm text-muted-foreground">
            Who is at the table, and who is yet to arrive.
          </TabsContent>
          <TabsContent value="history" className="pt-2 text-sm text-muted-foreground">
            The turns played so far, newest first.
          </TabsContent>
        </Tabs>
      </Demo>

      <Demo
        title="Line"
        code={`<TabsList variant="line">…</TabsList>`}
      >
        <Tabs defaultValue="identity">
          <TabsList variant="line">
            <TabsTrigger value="identity">Identity</TabsTrigger>
            <TabsTrigger value="mechanics">Mechanics</TabsTrigger>
            <TabsTrigger value="visual">Visual</TabsTrigger>
          </TabsList>
          <TabsContent value="identity" className="pt-2 text-sm text-muted-foreground">
            Name, tagline and links of the game.
          </TabsContent>
          <TabsContent value="mechanics" className="pt-2 text-sm text-muted-foreground">
            Timers, default options and limits.
          </TabsContent>
          <TabsContent value="visual" className="pt-2 text-sm text-muted-foreground">
            Images, colours and fonts of the skin.
          </TabsContent>
        </Tabs>
      </Demo>

      <Demo
        title="Vertical"
        code={`<Tabs orientation="vertical">
  <TabsList variant="line">…</TabsList>
</Tabs>`}
      >
        <Tabs defaultValue="setup" orientation="vertical">
          <TabsList variant="line">
            <TabsTrigger value="setup">Setup</TabsTrigger>
            <TabsTrigger value="tasks">Tasks</TabsTrigger>
            <TabsTrigger value="monitoring">Monitoring</TabsTrigger>
          </TabsList>
          <TabsContent value="setup" className="px-4 text-sm text-muted-foreground">
            Identity, mechanics, visual, audio and copy.
          </TabsContent>
          <TabsContent value="tasks" className="px-4 text-sm text-muted-foreground">
            Launch checklist, backlog, bugs and feedback.
          </TabsContent>
          <TabsContent value="monitoring" className="px-4 text-sm text-muted-foreground">
            Games, audience and health.
          </TabsContent>
        </Tabs>
      </Demo>
    </Section>
  )
}

export function ToggleGroups() {
  return (
    <Section
      id="toggle-group"
      module="toggle-group"
      intro="A set of chips to pick from, for a short list of choices that all stay in view: the filters of the search bar are made of them. `single` keeps one chip picked, `multiple` any number. The arrow keys move between the chips, and the whole group is one stop of the Tab key."
    >
      <Demo
        title="Single and multiple"
        description="A chip that is picked turns primary. In a `single` group a second click on the picked chip unpicks it, and the value then reads as an empty string: the page takes that for no pick. Name each group with an `aria-label`, since its chips are only numbers or short words."
        className="flex flex-col gap-4"
        code={`<ToggleGroup type="single" defaultValue="4" aria-label="Number of players">
  <ToggleGroupItem value="3">3</ToggleGroupItem>
  <ToggleGroupItem value="4">4</ToggleGroupItem>
  <ToggleGroupItem value="5">5</ToggleGroupItem>
</ToggleGroup>

<ToggleGroup type="multiple" defaultValue={["Cards"]} aria-label="Categories">
  <ToggleGroupItem value="Cards">Cards</ToggleGroupItem>
  <ToggleGroupItem value="Party">Party</ToggleGroupItem>
</ToggleGroup>`}
      >
        <ToggleGroup type="single" defaultValue="4" aria-label="Number of players">
          {["1", "2", "3", "4", "5", "6", "7", "8+"].map((count) => (
            <ToggleGroupItem key={count} value={count}>
              {count}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        <ToggleGroup type="multiple" defaultValue={["Cards", "Party"]} aria-label="Categories">
          {["Bluffing", "Cards", "Co-op", "Party", "Strategy"].map((category) => (
            <ToggleGroupItem key={category} value={category}>
              {category}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </Demo>

      <Demo
        title="Disabled"
        description="A chip, or the whole group, can be `disabled`: it is dimmed and skipped by the keyboard."
        code={`<ToggleGroup type="single" defaultValue="30" aria-label="Duration">
  <ToggleGroupItem value="15" disabled>15 min</ToggleGroupItem>
  <ToggleGroupItem value="30">30 min</ToggleGroupItem>
</ToggleGroup>`}
      >
        <ToggleGroup type="single" defaultValue="30" aria-label="Duration">
          <ToggleGroupItem value="15" disabled>
            15 min
          </ToggleGroupItem>
          <ToggleGroupItem value="30">30 min</ToggleGroupItem>
          <ToggleGroupItem value="45">45 min</ToggleGroupItem>
        </ToggleGroup>
      </Demo>
    </Section>
  )
}
