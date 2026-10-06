# Clarity Check — Design

## UCKG.org adaptation

Use UCKG.org writer-tool language throughout: HelpCentre, church, meeting, programme and faith-topic pages. Keep all 15 checks and the existing scoring logic. The sample is explicitly illustrative, not published UCKG information. Add an always-visible bottom explanation of scoring, the six bands, human sign-off and local content handling, inspired by the Draft Verifier.

A single-page, client-side landing-page auditor (web only). The user pastes HTML source or plain
text, names the entity and subject, and gets a report plus a 15-item scored checklist across five
dimensions: Entity, Subject, Evidence, Relationships, Usefulness. Nothing is fetched; nothing is
stored on a server. The visual direction is **editorial instrument**: a single left-aligned column
of numbered steps, hairline rules instead of cards-with-shadows, serif headings against plain sans
UI text, monospace reserved for literal character matching.

## Brand & Colors

CSS custom properties in `packages/web/src/web/styles.css`. Light/dark is driven by
`prefers-color-scheme` only (no toggle, no `.dark` class switching at runtime).

| Token | Light | Dark | Use |
|-------|-------|------|-----|
| `--paper` | `#F3F3EF` cool bone | `#101214` | Page background |
| `--surface` | `#FCFCFA` | `#171A1D` | Insets, table rows, textarea |
| `--ink` | `#14171A` | `#E9E9E4` | Primary text |
| `--ink-soft` | `#5A6068` | `#9DA4AC` | Secondary text, captions |
| `--rule` | `#D3D3CB` | `#2A2F34` | Hairlines (1px), borders |
| `--rule-strong` | `#A8A8A0` | `#3C434A` | Active/step borders |
| `--signal` | `#1F5F5B` deep pine | `#6FD3C6` | Accent: pass state, links, focus ring |
| `--caution` | `#8A5A00` amber ink | `#D9A441` | Flags: thin content, long meta |
| `--alarm` | `#9E2B25` oxide | `#F08076` | Fails: vague claims, zero mentions |

Deliberately avoided: cream+terracotta, purple gradients, soft drop shadows, all-caps tracked
eyebrow labels.

## Typography

- **Display** — Newsreader (serif, self-hosted, `public/fonts/`): page title, step headings,
  dimension group names, score band. Tight leading, normal case, no letter-spacing tricks.
- **Body/UI** — IBM Plex Sans: paragraphs, labels, buttons, checklist rows.
- **Mono** — IBM Plex Mono: only the mention-count table and matched-phrase chips, where exact
  character matching is the point.

Fonts load via `<link rel="stylesheet" href="/fonts/fonts.css">` in `packages/web/index.html`.

## Layout

- Single column, `max-width: 780px`, left aligned, generous top/bottom rhythm.
- Four numbered steps (`01`–`04`), each opened by a serif numeral in the left margin (collapses
  inline under 640px) and closed by a hairline rule.
- Hero: inline SVG — five labelled nodes (Entity, Subject, Evidence, Relationships, Usefulness)
  around a central "this page" node, joined by thin lines. Literal diagram, not decoration.
- Report cards: 2–3 column hairline grid, 2px radius, flat — no shadows, no per-card background
  tint except for flagged values.
- Checklist: grouped by dimension; auto rows locked (read-only, showing PASS / FAIL / N/A),
  manual rows are real checkboxes.

## Accessibility & Motion

- Visible `:focus-visible` outline (2px `--signal`, 2px offset) on every interactive element.
- Auto checklist rows use `aria-readonly`/`disabled` with text state, never color alone.
- One staggered reveal on results; all transitions disabled under
  `@media (prefers-reduced-motion: reduce)`.

## Pages & Modules

- **Web — Home** (`packages/web/src/web/pages/index.tsx`) — the whole app: inputs, run, report,
  checklist, score band.
- `lib/analyze.ts` — DOMParser/plain-text detection, counts, vague-claim scan, specific details,
  links, JSON-LD.
- `lib/checklist.ts` — the 15 items, applicability, confirmation, and the six-band score.
- `components/` — `hero-diagram`, `step`, `report-cards`, `vague-scan`, `mention-table`,
  `checklist-panel`, `score-band`.

## Key User Flow

1. Paste HTML source (or upload `.html/.htm/.txt/.md`) into the single textarea.
2. Name entity aliases + the subject; optionally the reader outcome and the page URL (URL is used
   only for local hostname comparison).
3. Run the check — everything computes in the browser.
4. Read the report, tick the three-per-dimension manual items, watch the band update.

## File and live-URL loading

Step 01 offers file upload, an explicit URL loader and direct paste. The server fetches public HTTP/HTTPS source only, validates and pins public IPv4 addresses at every redirect, imposes a 2 MB/20-second limit and stores no content in the database. Source is returned to the same editable textarea. Analysis still runs in the browser. File and URL errors use an inline live status. URL loading populates the final URL for link classification and clears stale results. Privacy copy distinguishes local file analysis from server URL fetching.
