# Progress, spinner, skeleton

Module: `@pbgo/ui/platform/progress`

Three ways to say that something is on its way. A progress bar when the share is known, a spinner when it is not, a skeleton to hold the shape of content that is loading. Spinner and skeleton are `@pbgo/ui/platform/spinner` and `@pbgo/ui/platform/skeleton`.

## Progress

`value` is the share done.

```specimen
progress-bar
```

## Spinner

It is an icon: size it with `size-*`. Inside a button, give it `data-icon` and the button pads for it.

```specimen
progress-spinner
```

## Skeleton

A pulsing `bg-muted` block. Size and round it to match the content it stands for.

```specimen
progress-skeleton
```
