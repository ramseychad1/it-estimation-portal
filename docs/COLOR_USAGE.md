# Color usage

The brand color discipline for the IT Estimation Portal. This is a hard rule, not a guideline.

The visual language is grounded in a small palette: white surfaces, near-black text, warm-gray neutrals, one workhorse accent (deep teal-blue) for actions and selection, and semantic state colors for status. Cardinal Red is a brand signature, not a UI workhorse.

Pull tokens from `frontend/src/styles/tokens.css`. Never hard-code hex values into a component.

> **Revised in UX-1 (July 2026).** The original system had no non-destructive color at all — every screen rendered grey-on-white, and the only color appearing at scale (red "Required" badges) read as warnings. UX-1 added the accent family and semantic soft fills below. Cardinal Red's job is unchanged, except the active-nav bar moved to accent.

---

## Palette

| Token | Hex | Role |
| --- | --- | --- |
| `--color-cardinal-red` | `#E41F35` | Brand mark, destructive actions, errors, critical-status indicators, required-field asterisks |
| `--color-cardinal-red-hover` | `#C91A2D` | Destructive button hover only |
| `--color-accent` | `#1F6787` | **Workhorse accent**: primary buttons, links, selected states, focus rings, active nav, in-flight status badges |
| `--color-accent-hover` | `#17536D` | Accent button hover |
| `--color-accent-soft` | `#E9F1F5` | Selected/active backgrounds, in-flight badge fills |
| `--color-accent-border` | `#A8C8D6` | Borders on accent-soft surfaces |
| `--color-near-black` | `#27251F` | Primary text |
| `--color-warm-gray-med` | `#948A85` | Secondary text, muted icons |
| `--color-warm-gray-light` | `#EFEFEF` | Surfaces, row hover, section background, neutral badge fills |
| `--color-light-blue` | `#BBDDE6` | Pale end of the accent family: soft info tints, text selection, system badge |
| `--color-white` | `#FFFFFF` | Default surface |
| `--color-success` / `-soft` / `-border` | `#2F6B4A` / `#E9F2ED` / `#BFDACB` | Approved / done — soft fill + dark text |
| `--color-warning` / `-soft` / `-border` | `#9A6C08` / `#F7F0DC` / `#E2D1A4` | Partial / needs-attention — soft fill + dark text |
| `--color-danger-soft` / `-border` | `#FCEDEE` / `#F2C0C6` | Fills/borders behind Cardinal Red text on error states |
| `--color-border` | `#E5E5E2` | Hairline borders and dividers |

The accent hue is deliberately the saturated end of the original light-blue family, so pre-existing pale-blue tints read as the soft end of one family rather than a second hue. To rebrand, change `--color-accent*` here and in `tailwind.config.js` — nothing else.

---

## Cardinal Red — allowed uses

- The product brand mark in the top bar
- Destructive actions (Delete buttons, destructive confirmations)
- Error states and validation errors
- Critical-status indicators (Rejected, Needs revision, Failed, Inactive Admin)
- Required-field asterisks next to input labels
- "Important" warnings (e.g., a confirmation when granting Admin role)

## Cardinal Red — forbidden uses

- Primary action buttons — those are accent-filled with white text
- Links and download links — those are accent
- The active-nav bar/background — accent (changed in UX-1; red bar was the old rule)
- Decorative accents
- Default selected/highlighted rows — use `--color-accent-soft`
- Default badges, chips, or status pills — including "Required" **badges**, which are metadata, not warnings (ink on warm-gray fill)

If you find yourself reaching for Cardinal Red and the use isn't on the allowed list, use the accent or neutral palette instead.

---

## Status color semantics

| State family | Fill | Text | Examples |
| --- | --- | --- | --- |
| In flight | `--color-accent-soft` | `--color-accent` | Active, Submitted, In review |
| Positive terminal | `--color-success-soft` | `--color-success` | Approved |
| Needs attention | `--color-warning-soft` | `--color-warning` | Partially approved, Clarification needed, Pricing review |
| Negative / error | `--color-danger-soft` (or white outline) | `--color-cardinal-red` | Rejected, Needs revision |
| Muted / receded | `--color-warm-gray-light` | `--fg-1` / `--fg-2` | Draft, Inactive, Recalled |

---

## Button hierarchy

| Variant | Background | Text | Border | Hover |
| --- | --- | --- | --- | --- |
| Primary | `--color-accent` | white | same as bg | bg → `--color-accent-hover` |
| Secondary | white | `--color-near-black` | `--color-border` | bg → `--color-warm-gray-light` |
| Tertiary / ghost | transparent | `--color-near-black` | none | bg → `--color-warm-gray-light` |
| Destructive | white | `--color-cardinal-red` | `--color-cardinal-red` | bg → `--color-cardinal-red`, text → white |

All buttons share the same height (32px) and 6px corner radius. Focus state is a 2px accent outline with 2px offset.

---

## Backgrounds

Plain only. White or `#EFEFEF`. No gradients, no images, no patterns, no textures. Full-bleed imagery does not appear in the product.

---

## Why this matters

Overusing the signature color devalues it. The healthcare IT audience expects calm and professional, not loud. When color carries meaning everywhere, it stops carrying meaning anywhere — and when nothing carries color, status stops being readable at a glance. One accent for action, semantic families for state, red for the moments that deserve it.
