# Slider

Module: `@pbgo/ui/platform/slider`

A slider for a value along a scale: a thumb, and a track that fills from the start to it.

It is Radix's `Slider` with one change: the thumb has no size of its own, so its centre is exactly where the fill and the pointer put it, and the handle is drawn around that centre. The handles stick out of the track by half their width at each end, so leave that room around the slider (`mx-1`). A screen reader hears the number of the thumb; `valueText` says what it stands for, and `thumbLabels` what the thumb is.

```specimen
slider-one-thumb
```
