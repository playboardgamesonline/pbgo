# Pager

Module: `@pbgo/ui/platform/pager`

A list that scrolls sideways one page at a time, with a dot under it for each page. It takes the height it is given and its pages are as tall as it is, so the caller decides how much a page holds from that height.

```specimen
pager-pages-and-dots
```

- A page is as wide as the pager and snaps to its start. It scrolls with the pointer, a trackpad, a swipe or the keyboard: the pager takes the focus and the arrow keys move it. No scrollbar is drawn.
- A press on a dot goes to its page, and jumps when less motion is asked for. The current dot is the page in view.
- The dots are there from two pages on, and their row keeps its height with one, so that what is above does not move when pages come or go.
