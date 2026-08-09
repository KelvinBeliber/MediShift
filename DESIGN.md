---
name: MediShift
description: AI-powered workforce management for healthcare teams.
colors:
  navy-950: '#000820'
  navy-800: '#13253A'
  navy-700: '#213147'
  navy-500: '#05192D'
  navy-100: '#072543'
  brand-navy: '#05192D'
  brand-navy-700: '#213147'
  brand-green: '#10B981'
  brand-green-press: '#059669'
  brand-green-deep: '#047857'
  brand-green-deep-press: '#065F46'
  brand-teal: '#049597'
  brand-teal-deep: '#047B7D'
  brand-teal-press: '#036467'
  shift-morning: '#049597'
  shift-afternoon: '#198AC1'
  shift-night: '#6B5FD6'
  slate: '#454E56'
  muted: '#5B6672'
  mist: '#E3EAFA'
  mist-50: '#F4F7FD'
  surface: '#FCFDFE'
  hairline: '#DDE3ED'
  danger: '#B3261E'
typography:
  display:
    fontFamily: 'Manrope Variable, Manrope, ui-sans-serif, system-ui, sans-serif'
    fontSize: '1.875rem'
    fontWeight: 600
    lineHeight: 1.15
    letterSpacing: '-0.021em'
  title:
    fontFamily: 'Manrope Variable, Manrope, ui-sans-serif, system-ui, sans-serif'
    fontSize: '1.125rem'
    fontWeight: 600
    lineHeight: 1.35
    letterSpacing: '-0.012em'
  body:
    fontFamily: 'Manrope Variable, Manrope, ui-sans-serif, system-ui, sans-serif'
    fontSize: '0.9375rem'
    fontWeight: 400
    lineHeight: 1.6
    letterSpacing: 'normal'
  label:
    fontFamily: 'Manrope Variable, Manrope, ui-sans-serif, system-ui, sans-serif'
    fontSize: '0.875rem'
    fontWeight: 500
    lineHeight: 1.3
    letterSpacing: 'normal'
  kicker:
    fontFamily: 'Manrope Variable, Manrope, ui-sans-serif, system-ui, sans-serif'
    fontSize: '0.6875rem'
    fontWeight: 600
    lineHeight: 1
    letterSpacing: '0.08em'
  data:
    fontFamily: 'Manrope Variable, Manrope, ui-sans-serif, system-ui, sans-serif'
    fontSize: '0.6875rem'
    fontWeight: 500
    lineHeight: 1
    letterSpacing: '0.02em'
    fontFeature: "'tnum' 1, 'cv11' 1"
rounded:
  sm: '4px'
  md: '8px'
  lg: '12px'
  xl: '16px'
  2xl: '20px'
  full: '9999px'
spacing:
  xs: '0.25rem'
  sm: '0.5rem'
  md: '1rem'
  lg: '1.5rem'
  xl: '2.5rem'
  '2xl': '4rem'
components:
  button-primary:
    backgroundColor: '{colors.brand-green}'
    textColor: '{colors.brand-navy}'
    fontWeight: 700
    typography: '{typography.label}'
    rounded: '{rounded.sm}'
    height: '2.75rem'
    padding: '0 1.25rem'
  button-primary-hover:
    backgroundColor: '{colors.brand-green-press}'
  button-ghost:
    backgroundColor: 'transparent'
    textColor: '{colors.brand-navy}'
    rounded: '{rounded.sm}'
    height: '2.75rem'
  link-inline:
    textColor: '{colors.brand-green-deep}'
    typography: '{typography.label}'
  input-field:
    backgroundColor: '#FFFFFF'
    textColor: '{colors.brand-navy}'
    rounded: '{rounded.md}'
    height: '2.75rem'
    padding: '0 0.875rem'
  alert-error:
    backgroundColor: '#FDF2F1'
    textColor: '{colors.danger}'
    rounded: '{rounded.md}'
    padding: '0.75rem 0.875rem'
  shift-band:
    textColor: '{colors.muted}'
    typography: '{typography.kicker}'
---

# Design System: MediShift

## Overview

**Creative North Star: "The Ward Clock"**

MediShift looks like the instruments a hospital already trusts: a legible board on a wall, a chart clipped to a bed, a clock you can read from across a corridor. It is not a consumer app trying to feel friendly, and it is not enterprise software trying to feel serious. It is a working instrument for people who are mid-shift, on their feet, and reading fast.

The whole system runs on **one family, two colors, and a lot of white**. Deep navy carries every word and grounds the sidebar and top bar; a single green carries every action. Everything else is a neutral, including the brand teal, which stays scoped to identity marks and data-viz rather than competing with green for "action". Colour is scarce on purpose, because on a schedule screen colour has to mean something — a state, a shift, a conflict — and a palette that decorates cannot also inform.

Depth is almost absent. Surfaces are separated by 1px hairlines and tonal shifts, not shadows, because a dense schedule grid stacked with drop-shadows becomes noise at exactly the moment it needs to be scannable. The one place the system permits expression is the brand surface at the front door, where the supplied illustration runs at full poster scale against a form that stays completely quiet.

**Key Characteristics:**
- One typeface (Manrope) across headings, labels, controls, and data
- A navy ground for every inverted surface (sidebar, top bar) and a single green accent, reserved for actions and state — never decoration
- Flat by default: hairlines and tone instead of shadows
- Fixed rem type scale, not fluid clamps — this is product UI at consistent DPI
- 44px form controls, for shared ward tablets
- The logo ring's teal → blue → violet becomes the morning → afternoon → night scale

## Colors

A cool, clinical palette pulled directly from the wordmark and logo ring by sampling stroke interiors — not approximated by eye — plus a navy scale and an action green layered in for the chrome.

### Primary
- **Navy 500** (`{colors.brand-navy}`): every heading, every line of body copy, and the default foreground. At 13.5:1 on white it is the most legible ink in the system, and it is the exact navy of the "Medi" in the wordmark. Also the ground for inverted surfaces — the sidebar and the top bar both sit on it, not just the rail.

  **The navigation rail and the top bar are the inverted surfaces.** From screen 6 the app sidebar is a solid Navy 500 panel with white type; the top bar (added when the shell was reworked to stop the header reading as an unstyled white strip) shares the same ground, so the two form one continuous dark frame around the light working area rather than a themed panel floating on white. Selected nav items and the top bar's own primary action take the bright `brand-green` with navy text — the same pairing as the primary button, so "selected"/"primary action" reads identically everywhere it appears. Hover surfaces take Navy 700, so hover and selected/active are never confusable. Tokens live in `--sidebar-*` and `--topbar-*` in `index.css`; nothing should hardcode navy in sidebar or top-bar markup. The wider scale — `navy-950` (deepest), `navy-800`, `navy-700` (hover/border step), `navy-100` — is available for any other dark surface that needs it; see the Navy Scale.
- **Brand Green Deep** (`{colors.brand-green-deep}`): the action colour for everything that is not the primary button's own fill — inline links, focus rings, selected state on the sidebar's ring, default badges. At 5.4:1 against white it is dark enough to read as text and to carry white text as a fill. See the Two-Green Rule.
- **Brand Green** (`{colors.brand-green}`): the primary button's fill, always paired with navy text, never white — see the Two-Green Rule and Components > Buttons.

### Secondary
- **Wordmark Teal** (`{colors.brand-teal}`): the literal brand teal from "Shift". At 3.7:1 it is an **identity colour, not a text colour** — dots, 1px rules, icon strokes, large display type, and the morning shift marker. Never small text; never a fill behind white text. Untouched by the navy/green refresh: teal still owns data-viz, chips, and the shift scale.
- **Brand Teal Deep** (`{colors.brand-teal-deep}`): the text-safe teal for the identity uses above — chart lines, chip text, the "today" marker in the schedule calendar. No longer the app's action colour; that role moved to `brand-green-deep`.

### Navy Scale
Five steps, sampled to sit together as one dark family rather than derived from a single hue-rotation: `navy-950` `#000820` (deepest — reserved for surfaces that need to read as pure ink), `navy-500` `#05192D` (`brand-navy` — the primary dark navy, sidebar and top-bar ground, default foreground), `navy-800` `#13253A` and `navy-700` `#213147` (`brand-navy-700` — lighter slate-navy steps used for hover and border on the two dark surfaces), `navy-100` `#072543` (a secondary dark surface, for anything nested one level inside a navy panel). Use the named roles (`brand-navy`, `sidebar-*`, `topbar-*`) where one exists; reach for the raw `navy-*` scale directly only for a new dark surface those roles don't cover.

### The Two-Green Rule
Same shape as the Two-Teal Rule, for the same reason: one bright colour and one that's dark enough to be legible as text, and they are not interchangeable. `brand-green` is the primary button's fill and nothing else — it is bright enough that only dark (navy) text reads on it, so it may never sit behind white text and never carries text itself. `brand-green-deep` is every other action use — links, focus rings, the sidebar's selected-state ring, default badges — dark enough to work both as text on white and as a fill behind white text. Reaching for the bright green anywhere text sits directly on it (other than the primary button, with navy text) is the single easiest way to fail contrast in this half of the system.

### Tertiary
- **Ring Blue** (`{colors.shift-afternoon}`) and **Ring Violet** (`{colors.shift-night}`): the second and third stops of the logo ring's gradient, reassigned as the afternoon and night shift markers. They exist to encode a state, and appear nowhere else.

### Neutral
- **Ward Slate** (`{colors.slate}`): secondary text and quiet labels where 8.5:1 is wanted.
- **Corridor Grey** (`{colors.muted}`): the muted-foreground role — helper text, placeholders, timestamps. 5.9:1, the floor for anything a user actually has to read.
- **Mist** (`{colors.mist}`) and **Mist 50** (`{colors.mist-50}`): the pale periwinkle sampled from the illustration's own ground. Panel tints, section bands, and the mobile wordmark band. Never behind body text without a foreground check.
- **Hairline** (`{colors.hairline}`): every border, divider, and input stroke in the system, at 1px.
- **Paper** (`{colors.surface}`): the near-white working surface, a half-step off pure white so that true white cards read as lifted without a shadow.

### Named Rules

**The Two-Teal Rule.** There are two teals and they are not interchangeable, though their job narrowed when the action colour moved to green (see the Two-Green Rule above). `brand-teal` is who MediShift *is* — it may never carry text or sit behind white text. `brand-teal-deep` is teal's own text-safe half — chart lines, chip text, the schedule calendar's "today" marker. Reaching for the bright one anywhere text sits on it is the single easiest way to fail contrast in this system.

**The Scarcity Rule.** The accent covers under 10% of any screen. If a surface has more than one teal element competing for the eye, one of them is decoration and should be navy or grey.

**The Shift Scale Rule.** Teal, blue, violet mean morning, afternoon, night. In that order, always. They are never used as a generic categorical palette, because a user who learns the mapping on the login screen must be able to trust it on the schedule.

## Typography

**Single Font:** Manrope Variable (fallback `ui-sans-serif, system-ui, sans-serif`), self-hosted via `@fontsource-variable/manrope`.

**Character:** A semi-geometric grotesk with open apertures, tall x-height, and unusually even colour at small sizes — it stays legible at 13px on a mid-brightness ward monitor, which is where most of this app is read. Its slightly squared terminals echo the wordmark's geometry without imitating it. Weights 400 / 500 / 600 / 700 only.

**No display face.** Product UI does not need a pairing, and a second family on a schedule screen would fight the data.

### Hierarchy
- **Display** (600, 30px / 1.15, -0.021em): page and screen titles. One per screen.
- **Metric** (600, 28px / 1, -0.02em, `tnum`): the single figure in a stat card. Added on screen 6. It sits deliberately *below* Display so that a row of stat cards never out-shouts the page title, and it belongs to **numbers only** — a metric-sized word is a heading that has escaped its scale.
- **Title** (600, 18px / 1.35, -0.012em): card and section headings, dialog titles.
- **Body** (400, 15px / 1.6): all prose and field values. Prose measure capped at 65–75ch.
- **Label** (500, 14px / 1.3): form labels, button text, inline links, table headers, nav items. **One size.** A 13px link sitting beside a 14px label on the same row reads as drift, not hierarchy — if a label needs de-emphasis, change its colour, not its size.
- **Kicker** (600, 11px / 1, +0.08em, uppercase): the shift band and other state markers.
- **Data** (500, 11px, `tnum`): clock times and numeric columns.

### Named Rules

**The Tabular Rule.** Anything that is a time, a duration, an hour count, or a currency figure sets `font-variant-numeric: tabular-nums`. Numbers that shift horizontally as they tick are a defect in a scheduling product.

**The One Kicker Rule.** The uppercase tracked style belongs to *state* — the shift band, a status chip. It is not a section eyebrow. An eyebrow over every section is grammar nobody chose.

**Fixed, not fluid.** Type sizes are fixed rem steps at a ~1.2 ratio. No `clamp()` on UI text: a heading that shrinks inside a sidebar looks broken, not responsive.

## Layout

A 4px base grid, with the `spacing` scale above as the working steps. Content columns cap at **384px** for single-field forms and 65–75ch for prose; tables and calendars are permitted to run to full width and scroll horizontally in their own container.

Density is deliberate: comfortable on entry surfaces, compact on data surfaces. Vertical rhythm always puts **more space above a heading than below it**, so a heading binds to the content it introduces.

Responsive behaviour is **structural, not fluid** — panels collapse, columns drop, tables switch to stacked rows, the sidebar becomes a sheet. Type does not scale with the viewport. Breakpoints follow Tailwind defaults; `lg` (1024px) is the meaningful one, where two-panel layouts become one.

Full-height surfaces use `100dvh`, not `100vh`, so mobile browser chrome does not clip the primary action.

## Elevation & Depth

**Revised on screen 6.** The original rule was "this system is flat — hairlines and tone, never shadow." Built out, it produced a metrics screen with no visual hierarchy: eleven white rectangles separated by 1px lines, which read as unstyled text rather than as restraint. The rule was right about *schedule grids* and wrong about *data surfaces*.

### The rule that replaced it

**Shadow carries hierarchy, never decoration.** A panel's elevation states how important it is. A screen has exactly one focal panel; two focal panels is zero focal panels. Shadows are tinted with the brand navy rather than neutral black, so they read cool like the rest of the palette.

| Level | Treatment | Used for |
|---|---|---|
| **Flat** | 1px `Hairline`, no shadow | blocks nested *inside* a panel |
| **Recessed** | `Paper` ground, 1px dashed `Hairline` | empty states, "nothing here yet" |
| **Resting** | white ground, hairline, `--shadow-card` | every normal panel |
| **Focal** | `Mist 50 → white` gradient, hairline, `--shadow-focal` | the one anchor panel per screen |
| **Interactive** | resting, lifting 2px to `--shadow-card-hover` | panels that are themselves links |

Nested surfaces never stack shadows — that is how "cards are never nested" survives the change.

Overlays keep their own, heavier vocabulary (`--shadow-overlay`): dropdowns, popovers, dialogs, toasts, and the mobile nav sheet.

**The 2px lift on interactive panels is the one exception to "nothing moves on hover".** It applies to whole panels that navigate somewhere, never to buttons — a button that lifts is still a marketing button.

Encoded in `frontend/src/components/dashboard-primitives/Panel.tsx`. The vendored shadcn `Card` has fixed padding and its own `shadow-sm`, which is why `Panel` exists rather than screens un-styling `Card` each time.

### Shadow Vocabulary
- **Overlay** (`box-shadow: 0 12px 32px -8px rgb(1 45 98 / 0.18), 0 2px 6px -2px rgb(1 45 98 / 0.10)`): dropdowns, popovers, dialogs. Tinted with the brand navy rather than neutral black, so shadows read cool like the rest of the palette.

### Named Rules

**The Flat-At-Rest Rule.** If an element is not currently floating above the document, it has no shadow. A card with a resting drop-shadow is decoration; use a hairline.

**The No-Halo Rule.** Focus is a 2px `brand-teal-deep` ring at 2px offset. It is never a zero-offset coloured glow, and never a `box-shadow` spread standing in for a border.

## Shapes

Gently rounded, never soft: **12px (`{rounded.lg}`)** on panels and cards, **20px (`{rounded.2xl}`)** on the rare surface that wants to read as softer than a panel, **8px (`{rounded.md}`)** on inputs and alerts, **4px (`{rounded.sm}`)** on buttons and small chips/badges — tight enough to read as an instrument control rather than a soft pill — and full round only on status dots and avatars.

Borders are always 1px `Hairline`. A coloured border wider than 1px on a card, list item, or alert is not part of this system — an alert states its severity with an icon, its text colour, and a tinted ground, not with a thick coloured bar down its left edge.

## Components

### Buttons
- **Shape:** 4px radius, 44px tall (`h-11`), full-width in single-column forms, auto width elsewhere.
- **Primary:** `brand-green` fill, **navy** text (not white — see the Two-Green Rule), 700 weight, 13px. High-contrast and punchy by design. No gradient, no inner highlight, no shadow.
- **Hover / active:** darkens to `brand-green-press` over 150ms. Nothing moves — a button that lifts on hover is a marketing button.
- **Focus:** the 2px offset green ring from the No-Halo Rule.
- **Disabled:** 45% opacity, `cursor-not-allowed`, no colour change.
- **Loading:** the label is replaced by a spinner plus a present-participle verb ("Signing in…"), the button keeps its width, and it is `aria-busy` and disabled.
- **Ghost / secondary:** transparent with navy text; hover fills `Mist 50`.

### Inputs / Fields
- **Style:** white ground, 1px `Hairline` stroke, 8px radius, 44px tall, 15px navy value text, `Corridor Grey` placeholder.
- **Label:** 13px / 500 navy, sitting 6px above the field. Always a real `<label>`, never a placeholder standing in for one.
- **Focus:** stroke goes `brand-teal-deep` and the 2px offset ring appears.
- **Error:** stroke and message go `danger`, `aria-invalid` is set, and the message sits directly under the field naming both the problem and the fix.
- **Disabled:** `Mist 50` ground, `Corridor Grey` text.

### Alerts
- Tinted ground, matching foreground, a 16px icon, 8px radius, `role="alert"`. Error uses `danger` on `#FDF2F1`. No left border bar.

### Cards / Containers
- White or `Paper` ground, 1px `Hairline`, 10px radius, 20–24px internal padding, no shadow. **Cards are never nested.**

### Signature Component: The Shift Band

A single line of `kicker` type marking which shift is on the floor and how long it has left, derived from the client clock against the real shift windows in `backend/src/services/scheduling/constraintBuilder.ts:11`:

```
● NIGHT SHIFT · 23:00–07:00 · hands over in 4h 12m
```

A 6px dot coloured by the Shift Scale Rule, the shift name, the window in tabular figures, then the countdown — separated by middots in `Hairline`. It is quiet (`Corridor Grey`, 11px) and it never animates. It appears at the top of entry surfaces and anywhere the current shift is context rather than data; it is **off** on terminal result screens, where the reader is finishing a one-off task rather than starting a shift.

**The Live Figure Rule.** The countdown is not garnish, it is the proof. A shift name changes three times a day, so on any single visit it is indistinguishable from a hardcoded string no matter how it is wired — and it is also the less useful number to someone reading this mid-shift. Any state display that cannot be told apart from static copy within one viewing needs a figure that visibly moves.

The band exists because the product's whole subject is what time it is on the ward, and because those windows are real backend constants rather than invention. **If those constants change, this changes.** That coupling is deliberate and mirrored in `frontend/src/lib/shifts.ts`.

### Signature Component: The Ward Panel

The brand surface on entry screens: the supplied poster, `object-contain` so nothing crops, matted by a scaled and blurred copy of itself at 70% opacity. Because the matting is the poster's own colours, it never seams at any aspect ratio.

The panel is **stateful**, not an image slot. A wash of the current shift's colour at 25% rises from the foot of the panel, and a 3px rail of that colour runs the seam where the two halves meet. That is what earns the panel its 50%: the left half is the ward's state, the right half is the task. A brand image alone would be the same pixels at 03:00 and 11:00.

**The Real-Absence Rule.** Brand imagery on a breakpoint that does not show it is *not rendered*, never `hidden`. `display: none` does not stop a browser downloading an `<img>` source — verified in this project, a 375px viewport was fetching the 1024px poster. Gate on `useMediaQuery`, not a utility class.

## Motion

Added on screen 6 (Dashboard), which was the first surface where the absence of any transition became a defect rather than a discipline: cards swapping from skeleton to figure with no transition read as a flicker.

**The Surfaces-Arrive, Content-Doesn't Rule.** A panel may perform one short entrance — 8px rise, 220ms, 40ms after its previous sibling, **once**. What the panel *contains* never animates in. The test: if a user waiting on a number waits longer because of the motion, it is decoration and it goes.

The stagger caps at 6 siblings. Twelve cards at 40ms is already half a second of arrival, and a twentieth card must not wait 800ms to exist.

### Timing

| Token | Duration | Easing | For |
|---|---|---|---|
| `instant` | 150ms | — | hover, press, colour, border |
| `enter` | 220ms | `cubic-bezier(0.16, 1, 0.3, 1)` | a surface arriving |
| `exit` | 150ms | `cubic-bezier(0.16, 1, 0.3, 1)` | a surface leaving |
| `layout` | 280ms | `cubic-bezier(0.65, 0, 0.35, 1)` | reflow when a permission-gated section appears |

Exits run shorter than entrances: nobody waits to watch something leave. Expo-out on entrances gives a surface that has largely arrived by the time the eye reaches it.

All four live in `frontend/src/lib/motion.ts` and are never typed at a call site. Reduced motion is handled once, globally, by `<MotionConfig reducedMotion="user">` in `app/providers.tsx` — no screen implements it itself.

**Counters animate on change, not on mount.** A figure rolling up from zero every time the dashboard opens is precisely the page-load animation the rule above exists to prevent. Movement in a number should mean the number moved.

## Do's and Don'ts

### Do:
- **Do** use `brand-green` (with navy text) for the primary button's fill and `brand-green-deep` for every other interactive colour — links, focus rings, selected state — per the Two-Green Rule. Reserve `brand-teal`/`brand-teal-deep` for identity marks and data-viz, per the Two-Teal Rule.
- **Do** set `tabular-nums` on every time, duration, hour count, and currency figure.
- **Do** separate surfaces with 1px `Hairline` and tone, and keep shadows for genuinely floating elements.
- **Do** put more space above a heading than below it.
- **Do** give every interactive element all seven states: default, hover, focus, active, disabled, loading, error.
- **Do** surface the backend's own error copy verbatim — it names specific, actionable causes.
- **Do** set form controls — inputs, selects, and a form's submit button — to 44px (`h-11`) for shared ward tablets. Inline and table-row controls may be smaller, but must keep a 44px touch target through padding.
- **Do** hide, rather than disable, controls the user's permissions do not allow.

### Don't:
- **Don't** put `brand-teal` behind white text or on text under 18px. It is 3.7:1 and it will fail.
- **Don't** add a second font family. Manrope carries the whole system.
- **Don't** use `clamp()` for UI type sizes.
- **Don't** use gradient text, gradient button fills, or glassmorphism. The one gradient in the brand is the logo ring, and it stays in the logo.
- **Don't** put a shadow on an input, or stack a shadow on a panel nested inside another panel. Resting elevation on a top-level panel is now correct — see Elevation & Depth.
- **Don't** use a coloured left-border bar on alerts or callouts.
- **Don't** use the uppercase tracked kicker as a section eyebrow — it means state.
- **Don't** animate **content** on page load. No figure, table row, or line of copy is ever withheld behind a timeline — users arrive already in a task. *Amended on screen 6:* a **surface** may arrive. See Motion below.
- **Don't** invent shift times, staffing rules, or any other product fact to fill a layout.
- **Don't** hide brand imagery with `hidden` — see the Real-Absence Rule.
- **Don't** write recovery copy for a capability the backend does not have. "Ask your administrator to resend it" is a dead instruction when no resend endpoint exists, and is no better than a dead button. Name the wall, then say what still works.
- **Don't** round a backend limit down in copy. The auth limiter's window is 15 minutes; "try again in a few minutes" earns the user a second 429.
