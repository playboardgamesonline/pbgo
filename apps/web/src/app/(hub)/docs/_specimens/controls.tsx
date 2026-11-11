// The live specimens of the controls pages of the design docs (`docs/design`): one component for each piece the markdown shows, registered by name below. The words around them are the page's.

import type { Specimens } from "@pbgo/docs/markdown"
import { HugeiconsIcon } from "@hugeicons/react"
import { Add01Icon, ArrowRight01Icon, CheckmarkCircle02Icon, Download01Icon, InfinityIcon, Mail01Icon, Search01Icon } from "@hugeicons/core-free-icons"
import { Badge } from "@pbgo/ui/platform/badge"
import { Button } from "@pbgo/ui/platform/button"
import { Checkbox } from "@pbgo/ui/platform/checkbox"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@pbgo/ui/platform/collapsible"
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@pbgo/ui/platform/field"
import { Input } from "@pbgo/ui/platform/input"
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput, InputGroupText } from "@pbgo/ui/platform/input-group"
import { Label } from "@pbgo/ui/platform/label"
import { PasswordInput } from "@pbgo/ui/platform/password-input"
import { RadioGroup, RadioGroupItem } from "@pbgo/ui/platform/radio-group"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@pbgo/ui/platform/select"
import { Spinner } from "@pbgo/ui/platform/spinner"
import { Switch } from "@pbgo/ui/platform/switch"
import { Tabs, TabsList, TabsTrigger } from "@pbgo/ui/platform/tabs"
import { Textarea } from "@pbgo/ui/platform/textarea"
import { ToggleGroup, ToggleGroupItem } from "@pbgo/ui/platform/toggle-group"
import { CodeSpecimen } from "./code-specimen"
import { ComboboxSpecimen } from "./combobox-specimen"
import { InlineEditSpecimen, InlineFieldsSpecimen } from "./inline-edit-specimen"
import { MeterSpecimen } from "./meter-specimen"
import { CountedTextareaSpecimen, CoverTileSpecimen, MultiSelectSpecimen, SearchSelectRemoteSpecimen, SearchSelectSpecimen } from "./picker-specimens"
import { SingleSliderSpecimen } from "./slider-specimen"
import { Frame } from "./text"

const ROW = "flex flex-wrap items-center gap-3"

function ButtonVariants() {
  return (
    <Frame className={ROW} code={`<Button>Create a table</Button>
<Button variant="outline">Join</Button>
<Button variant="secondary">Rules</Button>
<Button variant="ghost">Cancel</Button>
<Button variant="destructive">Delete table</Button>`}>
      <Button>Create a table</Button>
      <Button variant="outline">Join</Button>
      <Button variant="secondary">Rules</Button>
      <Button variant="ghost">Cancel</Button>
      <Button variant="destructive">Delete table</Button>
    </Frame>
  )
}

function ButtonSizes() {
  return (
    <Frame className={ROW} code={`<Button size="xs">Extra small</Button>
<Button size="sm">Small</Button>
<Button>Default</Button>
<Button size="lg">Large</Button>
<Button size="xl">Extra large</Button>`}>
      <Button size="xs">Extra small</Button>
      <Button size="sm">Small</Button>
      <Button>Default</Button>
      <Button size="lg">Large</Button>
      <Button size="xl">Extra large</Button>
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
      <Button variant="outline" size="icon-xl" aria-label="Search">
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

function BadgeVariants() {
  return (
    <Frame className={ROW} code={`<Badge>Live</Badge>
<Badge variant="secondary">Beta</Badge>
<Badge variant="outline">2–5 players</Badge>
<Badge variant="destructive">Offline</Badge>
<Badge variant="notification">3</Badge>
<Badge variant="ranked">Ranked</Badge>`}>
      <Badge>Live</Badge>
      <Badge variant="secondary">Beta</Badge>
      <Badge variant="outline">2–5 players</Badge>
      <Badge variant="destructive">Offline</Badge>
      <Badge variant="notification">3</Badge>
      <Badge variant="ranked">Ranked</Badge>
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
    <Frame code={`<FieldGroup>
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
</FieldGroup>`}>
      <FieldGroup className="max-w-sm">
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
      </FieldGroup>
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

function PasswordInputStates() {
  return (
    <Frame code={`<PasswordInput aria-label="Password" autoComplete="new-password" />
<PasswordInput aria-label="Password" defaultShown defaultValue="correct horse" />
<PasswordInput aria-label="Password" aria-invalid defaultValue="short" />`}>
      <div className="flex max-w-sm flex-col gap-4">
        <PasswordInput aria-label="Password" autoComplete="new-password" />
        <PasswordInput aria-label="Password" defaultShown defaultValue="correct horse" />
        <PasswordInput aria-label="Password" aria-invalid defaultValue="short" />
      </div>
    </Frame>
  )
}

function InputOtpCode() {
  return (
    <Frame code={`<InputOTP maxLength={6} pattern={REGEXP_ONLY_DIGITS} aria-label="Confirmation code">
  <InputOTPGroup>
    {Array.from({ length: 6 }, (_, index) => (
      <InputOTPSlot key={index} index={index} />
    ))}
  </InputOTPGroup>
</InputOTP>`}>
      <CodeSpecimen />
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
    <SelectItem value="fr">Français</SelectItem>
    <SelectItem value="en">English</SelectItem>
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
</Select>`}>
      <Select defaultValue="en">
        <SelectTrigger className="w-48" aria-label="Language">
          <SelectValue placeholder="Language" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="fr">Français</SelectItem>
          <SelectItem value="en">English</SelectItem>
          <SelectItem value="es">Español</SelectItem>
          <SelectItem value="de">Deutsch</SelectItem>
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
    </Frame>
  )
}

function RadioGroupStates() {
  return (
    <Frame className="max-w-xs" code={`<RadioGroup defaultValue="auto">
  <div className="flex items-center gap-3">
    <RadioGroupItem id="time-auto" value="auto" />
    <Label htmlFor="time-auto">Automatic</Label>
  </div>
  <div className="flex items-center gap-3">
    <RadioGroupItem id="time-12h" value="12h" />
    <Label htmlFor="time-12h">12-hour</Label>
  </div>
  <div className="flex items-center gap-3">
    <RadioGroupItem id="time-24h" value="24h" disabled />
    <Label htmlFor="time-24h">24-hour</Label>
  </div>
</RadioGroup>`}>
      <RadioGroup defaultValue="auto">
        <div className="flex items-center gap-3">
          <RadioGroupItem id="specimen-time-auto" value="auto" />
          <Label htmlFor="specimen-time-auto">Automatic</Label>
        </div>
        <div className="flex items-center gap-3">
          <RadioGroupItem id="specimen-time-12h" value="12h" />
          <Label htmlFor="specimen-time-12h">12-hour</Label>
        </div>
        <div className="flex items-center gap-3">
          <RadioGroupItem id="specimen-time-24h" value="24h" disabled />
          <Label htmlFor="specimen-time-24h">24-hour</Label>
        </div>
      </RadioGroup>
    </Frame>
  )
}

function InlineEditRow() {
  return (
    <Frame className="max-w-xl" code={`<InlineEdit
  open={open}
  onOpenChange={setOpen}
  title="Username"
  value={saved}
  editLabel="Edit username"
  canSave={valid && changed}
  pending={pending}
  error={failure}
  onSave={save}
>
  <InlineField label="Username" htmlFor="username" aside={left} error={problem}>
    <InlineFieldInput id="username" value={value} onChange={...} />
  </InlineField>
</InlineEdit>`}>
      <InlineEditSpecimen />
    </Frame>
  )
}

function InlineEditFields() {
  return (
    <Frame code={`<InlineField label="Country / region" htmlFor="country">
  <Select value={code} onValueChange={setCode}>
    <InlineFieldSelectTrigger id="country">
      <SelectValue />
    </InlineFieldSelectTrigger>
    <SelectContent>...</SelectContent>
  </Select>
</InlineField>`}>
      <InlineFieldsSpecimen />
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

function SearchSelectInAField() {
  return (
    <Frame code={`<SearchSelect
  options={[{ value: "FR", label: "France" }, { value: "BE", label: "Belgium" }]}
  value={country}
  onValueChange={setCountry}
  placeholder="Select a country"
  searchPlaceholder="Search countries..."
  empty="No country matches."
  clearLabel="Clear"
  aria-label="Country"
/>`}>
      <SearchSelectSpecimen />
    </Frame>
  )
}

function SearchSelectFromAServer() {
  return (
    <Frame code={`<SearchSelect
  options={found}
  value={city}
  selectedLabel={cityText}
  onValueChange={setCity}
  onQueryChange={search}
  loading={loading}
  prompt="Type the first letters."
  placeholder="Not set"
  searchPlaceholder="Search cities..."
  empty="No city matches."
  aria-label="City"
/>`}>
      <SearchSelectRemoteSpecimen />
    </Frame>
  )
}

function MultiSelectLimited() {
  return (
    <Frame code={`<MultiSelect
  options={[{ value: "hanabi", label: "Hanabi", cover: { picture: url } }]}
  value={picked}
  onValueChange={setPicked}
  max={5}
  placeholder="Add a game"
  searchPlaceholder="Search games..."
  empty="No game matches."
  aria-label="Favourite games"
/>`}>
      <MultiSelectSpecimen />
    </Frame>
  )
}

function CountedTextareaField() {
  return (
    <Frame code={`<CountedTextarea value={text} onChange={onChange} left={200 - text.length} aria-label="Bio" />`}>
      <CountedTextareaSpecimen />
    </Frame>
  )
}

function CoverTileSizes() {
  return (
    <Frame code={`<CoverTile picture={cover} />
<CoverTile logo={logo} className="size-14 rounded-2xl" />
<CoverTile />`}>
      <CoverTileSpecimen />
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
    <Frame code={`<Tabs value={view} onValueChange={setView}>
  <TabsList>
    <TabsTrigger value="rules">Rules</TabsTrigger>
    <TabsTrigger value="players">Players</TabsTrigger>
  </TabsList>
</Tabs>`}>
      <Tabs defaultValue="rules">
        <TabsList>
          <TabsTrigger value="rules">Rules</TabsTrigger>
          <TabsTrigger value="players">Players</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>
      </Tabs>
    </Frame>
  )
}

function ToggleGroupSegmented() {
  return (
    <Frame
      className="flex max-w-md flex-col gap-4"
      code={`<ToggleGroup type="single" variant="segmented" defaultValue="normal" aria-label="Speed">
  <ToggleGroupItem value="none" fit aria-label="No timer" title="No timer" className="w-12 px-0">
    <HugeiconsIcon icon={InfinityIcon} strokeWidth={2} />
  </ToggleGroupItem>
  <ToggleGroupItem value="slow">Slow</ToggleGroupItem>
  <ToggleGroupItem value="normal">Normal</ToggleGroupItem>
  <ToggleGroupItem value="fast">Fast</ToggleGroupItem>
</ToggleGroup>`}
    >
      <ToggleGroup type="single" variant="segmented" defaultValue="normal" aria-label="Speed">
        <ToggleGroupItem value="none" fit aria-label="No timer" title="No timer" className="w-12 px-0">
          <HugeiconsIcon icon={InfinityIcon} strokeWidth={2} />
        </ToggleGroupItem>
        <ToggleGroupItem value="slow">Slow</ToggleGroupItem>
        <ToggleGroupItem value="normal">Normal</ToggleGroupItem>
        <ToggleGroupItem value="fast">Fast</ToggleGroupItem>
      </ToggleGroup>
    </Frame>
  )
}

function ToggleGroupSingle() {
  return (
    <Frame code={`<ToggleGroup type="single" defaultValue="4" aria-label="Number of players">
  <ToggleGroupItem value="3">3</ToggleGroupItem>
  <ToggleGroupItem value="4">4</ToggleGroupItem>
  <ToggleGroupItem value="5">5</ToggleGroupItem>
</ToggleGroup>`}>
      <ToggleGroup type="single" defaultValue="4" aria-label="Number of players">
        {["1", "2", "3", "4", "5", "6", "7", "8+"].map((count) => (
          <ToggleGroupItem key={count} value={count}>
            {count}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </Frame>
  )
}

function CollapsibleOpenAndClosed() {
  const rows = ["Marly, Zoé and Tom", "Hervé, Lina and Sam", "Max and Inès"]
  return (
    <Frame
      className="grid items-start gap-6 md:grid-cols-2"
      code={`<Collapsible>
  <CollapsibleTrigger asChild>
    <button className="group/trigger …">
      Show more
      <HugeiconsIcon icon={ArrowDown01Icon} className="group-data-[state=open]/trigger:rotate-180" />
    </button>
  </CollapsibleTrigger>
  <CollapsibleContent>…</CollapsibleContent>
</Collapsible>`}
    >
      {[false, true].map((open) => (
        <Collapsible key={String(open)} defaultOpen={open} className="overflow-hidden rounded-3xl border">
          <CollapsibleTrigger className="group/trigger flex w-full items-center justify-between gap-3 px-6 py-4 text-left outline-none hover:bg-secondary focus-visible:ring-3 focus-visible:ring-ring/30 focus-visible:ring-inset">
            {open ? "Open when it is drawn" : "Closed when it is drawn"}
            <span aria-hidden className="text-muted-foreground transition-transform duration-base ease-standard group-data-[state=open]/trigger:rotate-180">
              ⌄
            </span>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <ul className="border-t">
              {rows.map((row) => (
                <li key={row} className="border-b px-6 py-3 text-sm text-muted-foreground last:border-b-0">
                  {row}
                </li>
              ))}
            </ul>
          </CollapsibleContent>
        </Collapsible>
      ))}
    </Frame>
  )
}

export const controlsSpecimens: Specimens = {
  "button-variants": ButtonVariants,
  "button-sizes": ButtonSizes,
  "button-icon-buttons": ButtonIconButtons,
  "toggle-group-segmented": ToggleGroupSegmented,
  "button-with-an-icon": ButtonWithAnIcon,
  "button-states-and-as-a-link": ButtonStatesAndAsALink,
  "badge-variants": BadgeVariants,
  "badge-with-an-icon-and-as-a-link": BadgeWithAnIconAndAsALink,
  "input-and-textarea": InputAndTextarea,
  "input-field": InputField,
  "input-group-addons": InputGroupAddons,
  "password-input": PasswordInputStates,
  "input-otp": InputOtpCode,
  "checkbox-states": CheckboxStates,
  "switch-states": SwitchStates,
  "select-default-and-small": SelectDefaultAndSmall,
  "combobox-in-a-popover": ComboboxInAPopover,
  "search-select": SearchSelectInAField,
  "search-select-remote": SearchSelectFromAServer,
  "multi-select": MultiSelectLimited,
  "counted-textarea": CountedTextareaField,
  "cover-tile": CoverTileSizes,
  "inline-edit-row": InlineEditRow,
  "radio-group-states": RadioGroupStates,
  "inline-edit-fields": InlineEditFields,
  "slider-one-thumb": SliderOneThumb,
  "meter-levels": MeterLevels,
  "meter-never-empty": MeterNeverEmpty,
  "tabs-default": TabsDefault,
  "toggle-group-single": ToggleGroupSingle,
  "collapsible-open-and-closed": CollapsibleOpenAndClosed,
}
