# Input and fields

Module: `@pbgo/ui/platform/field`, `@pbgo/ui/platform/input`, `@pbgo/ui/platform/textarea`, `@pbgo/ui/platform/input-group`, `@pbgo/ui/platform/password-input`, `@pbgo/ui/platform/input-otp`

Text entry is `Input` and `Textarea`. In a form, wrap each in a `Field` with its label, help and error. `InputGroup` adds an icon, a prefix or a button to the edge of an input. `PasswordInput` is every password and `InputOTP` every code that is sent to a visitor. Inputs are `text-base` on a phone, so that iOS does not zoom in on focus.

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

## Password

`PasswordInput` is an input with a button that shows or hides what is typed. It takes the props of an input, `aria-invalid` turns the whole field red, and `defaultShown` opens it showing the password.

```specimen
password-input
```

## Code

`InputOTP` is a code typed one character at a time, a slot for each. One real input sits under the slots, so a code that is pasted or filled in from a message lands in all of them, and `onComplete` fires on the last character. Name the input with `aria-label`, restrict it with `pattern` (`REGEXP_ONLY_DIGITS`), and `aria-invalid` turns the slots red. The digits are masked in session recordings.

```specimen
input-otp
```
