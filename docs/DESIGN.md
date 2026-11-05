# Design — Muayana

Direction: **"Site tape"** — chosen autonomously 2026-11-05 (see build-log decisions/foundation.md).
The app lives in a dusty hand on a bright site, often one-handed, often in the sun. It should feel like
the tools of the trade: hazard tape, marker on concrete, a clipboard with a stamp. Bold, high-contrast,
confident — not a soft SaaS dashboard.

## Feel
- **Heavy and legible.** Big tap targets (min 48px), heavy weights for numbers and titles, strong
  contrast that survives sunlight.
- **Tape and stamps.** The brand accent is safety yellow on ink. Status chips read like stamped labels
  (uppercase in English, solid fill, slight letter-spacing); issue numbers set in mono like a stencil (#14).
- **Photo first.** Defect photos are the content: large, edge to edge in the sort inbox and issue page,
  rounded slightly, never tiny thumbnails where a decision is made.
- **One-thumb reach.** Primary actions live in a bottom bar or a fixed bottom action area; the capture
  button is the biggest thing on the phone (a round shutter in the bottom nav centre).

## Colour roles (tokens, light + dark)
- `background` — light: warm concrete paper; dark: deep graphite ink.
- `foreground` — ink / chalk.
- `primary` — safety yellow; `primary-foreground` — ink (never white on yellow).
- `card`, `muted`, `border` — concrete greys with a warm tint.
- `destructive` — signal red. `success` — site green. `info` — blueprint blue.
- **Status colours** — one token per status (`status-new`, `status-unassigned`, …, `status-cancelled`),
  each with a matching `-foreground`, used for chips, dots and the dashboard bars.
- A **hazard stripe** (yellow/ink diagonal) is a decorative pattern used sparingly: the offline queue
  banner, the inbox header, empty states. Never behind body text.

## Type
- One family for Arabic and Latin: **Readex Pro** (variable, Arabic + Latin), weights 400/500/700/800.
- Mono for numbers, dates and phone numbers: **IBM Plex Mono** (Latin digits, tabular).
- Scale: display 32/800 · title 22/700 · heading 18/700 · body 16/400 · small 14/500 · micro 12/600.

## Motion
- Short and physical: 120ms press feedback (scale 0.97), 200ms sheet/page transitions, a shutter
  flash on capture, a stamp-in (scale + fade) when a status changes. Respect reduced motion.

## Avoid
- Purple/blue gradient SaaS look, glassmorphism, pastel everything.
- Small grey text on grey; thin weights; icon-only buttons without labels on primary actions.
- White text on yellow. Status shown by colour alone (always a label too).
- Desktop-first tables on the phone — lists are cards on mobile, tables only from `md` up.
