# Color usage

The brand color discipline for the IT Estimation Portal. This is a hard rule, not a guideline.

The visual language is grounded in a small palette: white surfaces, near-black text and primary actions, warm-gray neutrals, and one accent (light blue) for selection and focus. Cardinal Red is a brand signature, not a UI workhorse.

Pull tokens from `frontend/src/styles/tokens.css`. Never hard-code hex values into a component.

---

## Palette

| Token | Hex | Role |
| --- | --- | --- |
| `--color-cardinal-red` | `#E41F35` | Brand mark, destructive actions, errors, critical-status indicators, active-nav left bar, required-field asterisks |
| `--color-cardinal-red-hover` | `#C91A2D` | Destructive button hover only |
| `--color-near-black` | `#27251F` | Primary text, primary button fill |
| `--color-near-black-hover` | `#3A372E` | Primary button hover |
| `--color-warm-gray-med` | `#948A85` | Secondary text, muted icons |
| `--color-warm-gray-light` | `#EFEFEF` | Surfaces, row hover, section background, separation |
| `--color-light-blue` | `#BBDDE6` | Selected state, info, focus ring tint |
| `--color-white` | `#FFFFFF` | Default surface |
| `--color-success` | `#2F6B4A` | Muted forest — text/icon only, never a fill |
| `--color-warning` | `#B8860B` | Muted amber — text/icon only, never a fill |
| `--color-border` | `#E5E5E2` | Hairline borders and dividers |

---

## Cardinal Red — allowed uses

- The product brand mark in the top bar
- Destructive actions (Delete buttons, destructive confirmations)
- Error states and validation errors
- Critical-status indicators (Inactive Admin, Failed, Overdue, etc.)
- The 3px left bar on the active nav item — **the bar only**, not a red row background
- Required-field asterisks
- "Important" warnings (e.g., a confirmation when granting Admin role)

## Cardinal Red — forbidden uses

- Primary action buttons — those are Near-Black filled with white text
- Links — links are Near-Black; underline appears on hover
- Decorative accents
- Default selected/highlighted rows — use Light Blue tint instead
- Default badges, chips, or status pills

If you find yourself reaching for Cardinal Red and the use isn't on the allowed list, pick from the neutral palette (Near-Black, Warm Gray, Light Blue) instead.

---

## Button hierarchy

| Variant | Background | Text | Border | Hover |
| --- | --- | --- | --- | --- |
| Primary | `--color-near-black` | white | same as bg | bg → `--color-near-black-hover` |
| Secondary | white | `--color-near-black` | `--color-border` | bg → `--color-warm-gray-light` |
| Tertiary / ghost | transparent | `--color-near-black` | none | bg → `--color-warm-gray-light` |
| Destructive | white | `--color-cardinal-red` | `--color-cardinal-red` | bg → `--color-cardinal-red`, text → white |

All buttons share the same height (32px) and 6px corner radius. Focus state is a 2px Light Blue outline with 2px offset.

---

## Backgrounds

Plain only. White or `#EFEFEF`. No gradients, no images, no patterns, no textures. Full-bleed imagery does not appear in the product.

---

## Why this matters

Overusing the signature color devalues it. The healthcare IT audience expects calm and professional, not loud. When color carries meaning everywhere, it stops carrying meaning anywhere.
