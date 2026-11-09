# Inline edit

Module: `@pbgo/ui/platform/inline-edit`

A row of a list that is edited where it stands. It says what it holds and has an edit button; the button turns the row into its form, and Save changes or Cancel turns it back. No window opens: a [dialog](../03-overlays/01-dialog.md) is for a change that needs words of its own, like an address or a password.

- `InlineEdit` is the row: `open` and `onOpenChange` are the caller's, `title` and `value` are what it shows closed, `editLabel` names the icon button, and `canSave`, `pending` and `error` come from the form.
- Save changes stays off until the entry is valid and is not what the row holds. Enter saves, Escape cancels, and a save in flight cannot be pressed twice.
- The cursor goes into the first field when the row opens, and back to the edit button when it closes. A control that says `data-autoselect` opens with its text selected, so a number is typed over.
- The row holds what it saved and says it at once; the caller refreshes the page for the rest of the site.

```specimen
inline-edit-row
```

## Fields

`InlineField` is what is typed in while a row is open: its label small above, a note at the top right (`aside`, the characters that are left), the focus ring and the error colour round the whole surface, and what is wrong under it (`error`, with the id `<htmlFor>-error` for `aria-describedby`).

- `InlineFieldInput` and `InlineFieldSelectTrigger` are the controls to put inside: the field is their surface, so they wear none.
- Several controls can share one field, as the three numbers of a date do.

```specimen
inline-edit-fields
```
