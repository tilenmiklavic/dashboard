A calm, neutral-first system for monitoring servers: grey surfaces, ink type, monospaced figures, and a single green that marks what matters. Light and dark are equal citizens — every screen must work in both.

## Principles

- **Numbers first.** Each card leads with one figure set in a `metric-*` style (Geist Mono, tabular). Everything else on the card supports that number.
- **One signal colour.** `accent` green marks the current series, the selected bar, the gauge fill — never decoration, never text. Everything else is greyscale.
- **Good/bad, not up/down.** Delta tone follows meaning: a rising error rate is `negative` even though it went up. Every state carries a sign, a word or an arrow besides its colour.
- **Flat panels.** Cards are `bg-surface` floating on `bg-canvas` with `radius-lg`; no borders, no shadows. Only floating layers (tooltips, menus, the date picker) use `shadow-pop`.

## Content

- Sentence case everywhere: "Requests / sec", "Help & support", "Restart service".
- Card descriptions state the finding in plain words: "Egress up 7%, ingress down 12%". Footnotes say the period: "Up 11% this week".
- Format numbers before display: thousands separators ("2,792"), units after a space ("857 ms", "4.78 GB/s"), signs on every delta ("+7%", "-12%"), an em dash for no data ("—").
- Name infrastructure by its real identifiers (`eu-central-1`, deploy `#4182`); don't prettify them.
- The assistant answers in second person, bolds only the decisive figures and entities, and ends with one concrete follow-up question. No emoji.

## Colour

- Page: `bg-canvas`. Panels: `bg-surface`. Hover, active nav, user chat bubbles, in-range days: `bg-subtle`. Committing actions and selections: `bg-inverse` with `text-inverse`.
- Text: `text` for values, headings and body; `text-muted` for card labels, axis labels, captions and column headers. `text-disabled` only for disabled controls.
- Deltas and states: `positive-text` on `positive-subtle`, `negative-text` on `negative-subtle`, `warning-text` on `warning-subtle`. All pairs clear 4.5:1 in both themes.
- Charts: current period `accent`, comparison and inactive bars `chart-muted`; categories `chart-1` … `chart-5` in order, always with a label or legend.
- Hairlines: `border` for dividers and control outlines; `border-strong` for dashed gridlines and hover outlines.

## Type

- Interface text is **Geist**; figures are **Geist Mono** (both from Google Fonts).
- `page-title` once per screen. Card labels in `label` with `text-muted`. Body and chat in `body`. Footnotes and axes in `caption`. Badges in `micro`.
- KPI values in `metric-lg`, headline chart figures and gauge centres in `metric-xl`, table numbers in `metric-sm`.

## Space, radius, layout

- Desktop: a 220px `Sidebar` panel and a main column, both on `bg-canvas` with 8px (`space-2`) of canvas between panels and 24px (`space-6`) around the main column.
- Main column: header row (`page-title` left; time-range Select then scope Select right), then a row of 4–5 StatCards, then chart cards in a 2:1 or 1:1 grid — all with `space-2` gaps.
- Cards pad `space-4`. Radii: `radius-sm` badges and day cells, `radius-md` controls and chips, `radius-lg` cards, `radius-xl` the outer shell, `radius-full` primary buttons and dots.
- Mobile: single column, sidebar collapses to a menu button, StatCards pair up two per row with the first spanning full width.

## States and focus

- Hover: `bg-subtle` on transparent controls, `border-strong` on outlined ones, 88% opacity on `bg-inverse`.
- Focus: a solid 2px `focus` ring at 2px offset on every interactive element.
- Selected: `bg-inverse` fill (chips, calendar range ends) or `bg-subtle` (nav, menu options).

## Iconography

- Line icons on a 24px grid, 1.6px round stroke, `currentColor` — use the `Icon` component (`Icon.names` lists the set).
- The references' exact icon set was not available as files; the bundled icons are a close substitute drawn to match. Swap in your own SVGs by keeping the same grid and stroke.
- No logo is defined: the product name is set in plain `label` weight 500 in the Sidebar.
