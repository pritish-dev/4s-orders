# 4S Interiors — Orders app

## LOCKED: the order-form logo must never change on its own

The showroom logo shown on the generated order-form PDF is **locked**. Do **not**
modify it — for any reason — unless the showroom owner (Pritish) explicitly
asks for that specific change in the current request. This includes:

- The `interio-logo.png` "interio by Godrej" mark and the `fs-logo.png` store
  mark (do not replace, recolor, resize, or regenerate these PNGs).
- The order-form header rendering: `drawHeaderBand` and `_interioText` inside
  `generatePDF` in both `index.html` and `mobile-app/www/index.html`. Do not add
  labels (e.g. "Patia"), re-style, re-position, or otherwise alter how the logo
  is drawn.

"Refactoring", "cleanup", "improving branding", or a vaguely related task is
**not** permission to touch the logo. If a change seems to require touching it,
stop and ask first.

Keep `index.html` and `mobile-app/www/index.html` in sync when a genuinely
requested change does touch shared code.
