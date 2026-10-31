// The live specimens of the controls page of the design docs (`docs/design`): one component for each piece the markdown shows, registered by name below. The words around them are the page's.

import type { Specimens } from "@pbgo/docs/markdown"
import { HugeiconsIcon } from "@hugeicons/react"
import { Add01Icon, ArrowRight01Icon, CheckmarkCircle02Icon, Download01Icon, Mail01Icon, Search01Icon } from "@hugeicons/core-free-icons"
import { PROVIDERS, PROVIDER_NAMES } from "@pbgo/accounts"
import { Badge } from "@pbgo/ui/platform/badge"
import { Button } from "@pbgo/ui/platform/button"
import { Checkbox } from "@pbgo/ui/platform/checkbox"
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel, FieldLegend, FieldSet } from "@pbgo/ui/platform/field"
import { Input } from "@pbgo/ui/platform/input"
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput, InputGroupText } from "@pbgo/ui/platform/input-group"
import { Label } from "@pbgo/ui/platform/label"
import { ProviderButton } from "@pbgo/ui/platform/provider-button"
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectSeparator, SelectTrigger, SelectValue } from "@pbgo/ui/platform/select"
import { Slider } from "@pbgo/ui/platform/slider"
import { Spinner } from "@pbgo/ui/platform/spinner"
import { Switch } from "@pbgo/ui/platform/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@pbgo/ui/platform/tabs"
import { Textarea } from "@pbgo/ui/platform/textarea"
import { ToggleGroup, ToggleGroupItem } from "@pbgo/ui/platform/toggle-group"
import { ComboboxSpecimen } from "./combobox-specimen"
import { MeterSpecimen } from "./meter-specimen"
import { RangeSliderSpecimen, SingleSliderSpecimen } from "./slider-specimen"
import { Frame } from "./text"

const ROW = "flex flex-wrap items-center gap-3"

function ButtonVariants() {
  return (
    <Frame className={ROW} code={`<Button>Create a table</Button>
<Button variant="outline">Join</Button>
<Button variant="secondary">Rules</Button>
<Button variant="ghost">Cancel</Button>
<Button variant="destructive">Delete table</Button>
<Button variant="link">Learn more</Button>`}>
      <Button>Create a table</Button>
      <Button variant="outline">Join</Button>
      <Button variant="secondary">Rules</Button>
      <Button variant="ghost">Cancel</Button>
      <Button variant="destructive">Delete table</Button>
      <Button variant="link">Learn more</Button>
    </Frame>
  )
}

function ButtonSizes() {
  return (
    <Frame className={ROW} code={`<Button size="xs">Extra small</Button>
<Button size="sm">Small</Button>
<Button>Default</Button>
<Button size="lg">Large</Button>`}>
      <Button size="xs">Extra small</Button>
      <Button size="sm">Small</Button>
      <Button>Default</Button>
      <Button size="lg">Large</Button>
    </Frame>
  )
}

function ButtonIconButtons() {
  return (
    <Frame className={ROW} code={`<Button variant="outline" size="icon-xs" aria-label="Search">
  <HugeiconsIcon icon={Search01Icon} strokeWidth={2} />
</Button>`}>
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
    </Frame>
  )
}

function ButtonWithAnIcon() {
  return (
    <Frame className={ROW} code={`<Button>
  <HugeiconsIcon icon={Add01Icon} strokeWidth={2} data-icon="inline-start" />
  New table
</Button>
<Button variant="outline">
  Next
  <HugeiconsIcon icon={ArrowRight01Icon} strokeWidth={2} data-icon="inline-end" />
</Button>`}>
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
    </Frame>
  )
}

function ButtonStatesAndAsALink() {
  return (
    <Frame className={ROW} code={`<Button disabled>Disabled</Button>
<Button disabled>
  <Spinner data-icon="inline-start" />
  Saving
</Button>
<Button asChild variant="outline">
  <a href="/legal">Legal notice</a>
</Button>`}>
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
    </Frame>
  )
}

function ProviderButtonARowOfFour() {
  return (
    <Frame className="grid max-w-md grid-cols-4 gap-3" code={`<div role="group" aria-label="Sign in with" className="grid grid-cols-4 gap-3">
  {PROVIDERS.map((provider) => (
    <ProviderButton key={provider} brand={provider} name={PROVIDER_NAMES[provider]} onClick={() => start(provider)} />
  ))}
</div>`}>
      {PROVIDERS.map((provider) => (
        <ProviderButton key={provider} brand={provider} name={PROVIDER_NAMES[provider]} />
      ))}
    </Frame>
  )
}

function ProviderButtonPendingAndOff() {
  return (
    <Frame className="grid max-w-md grid-cols-4 gap-3" code={`<ProviderButton brand="google" name="Google" pending />
<ProviderButton brand="apple" name="Apple" disabled />`}>
      {PROVIDERS.map((provider) => (
        <ProviderButton key={provider} brand={provider} name={PROVIDER_NAMES[provider]} pending disabled />
      ))}
      {PROVIDERS.map((provider) => (
        <ProviderButton key={provider} brand={provider} name={PROVIDER_NAMES[provider]} disabled />
      ))}
    </Frame>
  )
}

function BadgeVariants() {
  return (
    <Frame className={ROW} code={`<Badge>Live</Badge>
<Badge variant="secondary">Beta</Badge>
<Badge variant="outline">2–5 players</Badge>
<Badge variant="destructive">Offline</Badge>
<Badge variant="ghost">Draft</Badge>
<Badge variant="link">Link</Badge>
<Badge variant="notification">3</Badge>`}>
      <Badge>Live</Badge>
      <Badge variant="secondary">Beta</Badge>
      <Badge variant="outline">2–5 players</Badge>
      <Badge variant="destructive">Offline</Badge>
      <Badge variant="ghost">Draft</Badge>
      <Badge variant="link">Link</Badge>
      <Badge variant="notification">3</Badge>
    </Frame>
  )
}

function BadgeWithAnIconAndAsALink() {
  return (
    <Frame className={ROW} code={`<Badge variant="secondary">
  <HugeiconsIcon icon={CheckmarkCircle02Icon} strokeWidth={2} data-icon="inline-start" />
  Ready
</Badge>
<Badge asChild variant="outline">
  <a href="/courtisans">Courtisans</a>
</Badge>`}>
      <Badge variant="secondary">
        <HugeiconsIcon icon={CheckmarkCircle02Icon} strokeWidth={2} data-icon="inline-start" />
        Ready
      </Badge>
      <Badge asChild variant="outline">
        <a href="#badge">A badge that links</a>
      </Badge>
    </Frame>
  )
}

function InputAndTextarea() {
  return (
    <Frame className="grid gap-4 md:grid-cols-2" code={`<Input placeholder="Your nickname" />
<Input defaultValue="Ana" />
<Input disabled placeholder="Disabled" />
<Input aria-invalid defaultValue="Not an email" />
<Textarea placeholder="Tell us what happened" />`}>
      <Input placeholder="Your nickname" aria-label="Placeholder" />
      <Input defaultValue="Ana" aria-label="Filled" />
      <Input disabled placeholder="Disabled" aria-label="Disabled" />
      <Input aria-invalid defaultValue="Not an email" aria-label="Invalid" />
      <Textarea className="md:col-span-2" placeholder="Tell us what happened" aria-label="Message" />
    </Frame>
  )
}

function InputField() {
  return (
    <Frame code={`<FieldSet>
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
</FieldSet>`}>
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
    </Frame>
  )
}

function InputGroupAddons() {
  return (
    <Frame className="flex flex-col gap-4" code={`<InputGroup>
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
</InputGroup>`}>
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
    </Frame>
  )
}

function CheckboxStates() {
  return (
    <Frame className="flex flex-col gap-3" code={`<div className="flex items-center gap-2">
  <Checkbox id="notify" defaultChecked />
  <Label htmlFor="notify">Notify me when it is my turn</Label>
</div>`}>
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
    </Frame>
  )
}

function SwitchStates() {
  return (
    <Frame className="flex flex-col gap-3" code={`<div className="flex items-center gap-2">
  <Switch id="sound" defaultChecked />
  <Label htmlFor="sound">Sound</Label>
</div>
<Switch size="sm" />`}>
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
    </Frame>
  )
}

function SelectDefaultAndSmall() {
  return (
    <Frame className={ROW} code={`<Select defaultValue="en">
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
</Select>`}>
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
    </Frame>
  )
}

function ComboboxInAPopover() {
  return (
    <Frame className={ROW} code={`<Popover>
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
</Popover>`}>
      <ComboboxSpecimen />
    </Frame>
  )
}

function SliderOneThumb() {
  return (
    <Frame code={`<Slider
  min={1}
  max={5}
  step={1}
  value={[level]}
  onValueChange={([next]) => setLevel(next)}
  ticks
  thumbLabels={["Level"]}
  valueText={(value) => \`Level \${value} of 5\`}
/>`}>
      <SingleSliderSpecimen />
    </Frame>
  )
}

function SliderARange() {
  return (
    <Frame code={`<Slider
  min={0}
  max={100}
  step={10}
  minStepsBetweenThumbs={1}
  value={range}
  onValueChange={setRange}
  ticks
  thumbLabels={["From", "To"]}
/>`}>
      <RangeSliderSpecimen />
    </Frame>
  )
}

function SliderDisabled() {
  return (
    <Frame className="max-w-sm px-8" code={`<Slider min={0} max={6} defaultValue={[2, 4]} minStepsBetweenThumbs={1} ticks disabled />`}>
      <Slider min={0} max={6} defaultValue={[2, 4]} minStepsBetweenThumbs={1} ticks disabled />
    </Frame>
  )
}

function MeterLevels() {
  return (
    <Frame code={`<Meter
  value={level}
  onValueChange={setLevel}
  levelLabel={(level) => \`Up to \${level} of 5\`}
/>`}>
      <MeterSpecimen />
    </Frame>
  )
}

function MeterNeverEmpty() {
  return (
    <Frame code={`<Meter
  value={level}
  clearable={false}
  onValueChange={(next) => next !== null && setLevel(next)}
  levelLabel={(level) => \`Up to \${level} of 5\`}
/>`}>
      <MeterSpecimen clearable={false} />
    </Frame>
  )
}

function TabsDefault() {
  return (
    <Frame code={`<Tabs defaultValue="rules">
  <TabsList>
    <TabsTrigger value="rules">Rules</TabsTrigger>
    <TabsTrigger value="players">Players</TabsTrigger>
  </TabsList>
  <TabsContent value="rules">…</TabsContent>
  <TabsContent value="players">…</TabsContent>
</Tabs>`}>
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
    </Frame>
  )
}

function TabsLine() {
  return (
    <Frame code={`<TabsList variant="line">…</TabsList>`}>
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
    </Frame>
  )
}

function TabsVertical() {
  return (
    <Frame code={`<Tabs orientation="vertical">
  <TabsList variant="line">…</TabsList>
</Tabs>`}>
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
    </Frame>
  )
}

function ToggleGroupSingleAndMultiple() {
  return (
    <Frame className="flex flex-col gap-4" code={`<ToggleGroup type="single" defaultValue="4" aria-label="Number of players">
  <ToggleGroupItem value="3">3</ToggleGroupItem>
  <ToggleGroupItem value="4">4</ToggleGroupItem>
  <ToggleGroupItem value="5">5</ToggleGroupItem>
</ToggleGroup>

<ToggleGroup type="multiple" defaultValue={["Cards"]} aria-label="Categories">
  <ToggleGroupItem value="Cards">Cards</ToggleGroupItem>
  <ToggleGroupItem value="Party">Party</ToggleGroupItem>
</ToggleGroup>`}>
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
    </Frame>
  )
}

function ToggleGroupDisabled() {
  return (
    <Frame code={`<ToggleGroup type="single" defaultValue="30" aria-label="Duration">
  <ToggleGroupItem value="15" disabled>15 min</ToggleGroupItem>
  <ToggleGroupItem value="30">30 min</ToggleGroupItem>
</ToggleGroup>`}>
      <ToggleGroup type="single" defaultValue="30" aria-label="Duration">
        <ToggleGroupItem value="15" disabled>
          15 min
        </ToggleGroupItem>
        <ToggleGroupItem value="30">30 min</ToggleGroupItem>
        <ToggleGroupItem value="45">45 min</ToggleGroupItem>
      </ToggleGroup>
    </Frame>
  )
}

export const controlsSpecimens: Specimens = {
  "button-variants": ButtonVariants,
  "button-sizes": ButtonSizes,
  "button-icon-buttons": ButtonIconButtons,
  "button-with-an-icon": ButtonWithAnIcon,
  "button-states-and-as-a-link": ButtonStatesAndAsALink,
  "provider-button-a-row-of-four": ProviderButtonARowOfFour,
  "provider-button-pending-and-off": ProviderButtonPendingAndOff,
  "badge-variants": BadgeVariants,
  "badge-with-an-icon-and-as-a-link": BadgeWithAnIconAndAsALink,
  "input-and-textarea": InputAndTextarea,
  "input-field": InputField,
  "input-group-addons": InputGroupAddons,
  "checkbox-states": CheckboxStates,
  "switch-states": SwitchStates,
  "select-default-and-small": SelectDefaultAndSmall,
  "combobox-in-a-popover": ComboboxInAPopover,
  "slider-one-thumb": SliderOneThumb,
  "slider-a-range": SliderARange,
  "slider-disabled": SliderDisabled,
  "meter-levels": MeterLevels,
  "meter-never-empty": MeterNeverEmpty,
  "tabs-default": TabsDefault,
  "tabs-line": TabsLine,
  "tabs-vertical": TabsVertical,
  "toggle-group-single-and-multiple": ToggleGroupSingleAndMultiple,
  "toggle-group-disabled": ToggleGroupDisabled,
}
