# Button

Module: `@pbgo/ui/platform/button`

Every action is a `Button`. The variant says how much an action weighs, the size how dense its surroundings are. It is rounded by the control step (smaller for the small sizes, see [Radius](../../02-foundations/03-radius.md)) and set in one weight.

## Button variants

`default` is the one main action of a screen, `outline` and `secondary` the others. `ghost` lives in toolbars and `destructive` is for what cannot be undone.

```specimen
button-variants
```

## Sizes

Use `sm` and `xs` inside dense UI (tables, toolbars, the gamemaster), `lg` for a hero action and `xl` for the one or two buttons that a page is for.

```specimen
button-sizes
```

## Icon buttons

Square, one per size. Give each an `aria-label`: there is no text to name it.

```specimen
button-icon-buttons
```

## With an icon

Mark the icon `data-icon="inline-start"` or `inline-end`: the button trims the padding on that side.

```specimen
button-with-an-icon
```

## States, and as a link

A disabled button fades and ignores the pointer. `asChild` gives the button look to the element you pass, here an anchor.

```specimen
button-states-and-as-a-link
```
