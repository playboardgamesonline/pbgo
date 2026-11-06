# Input and fields

Module: `@pbgo/ui/platform/field`, `@pbgo/ui/platform/input`, `@pbgo/ui/platform/textarea`, `@pbgo/ui/platform/input-group`

Text entry is `Input` and `Textarea`. In a form, wrap each in a `Field` with its label, help and error. `InputGroup` adds an icon, a prefix or a button to the edge of an input. Inputs are `text-base` on a phone, so that iOS does not zoom in on focus.

## Input and textarea

Pass `aria-invalid` for the error state: the field turns red and its ring follows.

```specimen
input-and-textarea
```

## Field

`Field` stacks a label, a control, a description and an error, and `FieldGroup` spaces several of them. Set `data-invalid` on the field so its text turns red too.

```specimen
input-field
```

## Input group

The addon sits inside the same rounded frame as the input, so focus and error states cover both.

```specimen
input-group-addons
```
