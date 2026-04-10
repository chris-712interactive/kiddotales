# Art Style Catalog Spec

This document defines KiddoTales' illustration style catalog and why each style is included.

Implementation source of truth lives in `src/lib/art-style-catalog.ts`.

## Goals

- Provide styles that stay safe and age-appropriate for children's stories.
- Keep illustrations readable on mobile and printable for keepsake books.
- Improve consistency across 8-page generations with style-specific direction.
- Support product tiering with a broad premium catalog while keeping a simpler free subset.

## Style Entries

| ID | Label | Why it works |
| --- | --- | --- |
| `whimsical-watercolor` | Whimsical Watercolor | Gentle bedtime tone and forgiving painterly texture. |
| `pixar-3d` | Pixar-style 3D | High emotional clarity and cinematic scene energy. |
| `hand-drawn-classic` | Hand-drawn Classic | Timeless picture-book look and strong print feel. |
| `vibrant-cartoon` | Vibrant Cartoon | Bold shapes and high readability on small screens. |
| `photo-realistic` | Photo Realistic | Premium realistic option for families who prefer lifelike imagery. |
| `soft-storybook-watercolor` | Soft Storybook Watercolor | Calm, cozy style with reliable cross-page consistency. |
| `flat-vector-cartoon` | Flat Vector Cartoon | Clean forms and very strong visual clarity. |
| `crayon-hand-drawn` | Crayon Hand-Drawn | Child-made, playful energy for early learning themes. |
| `cut-paper-collage` | Cut-Paper Collage | Distinctive handcrafted look and strong layered silhouettes. |
| `classic-fairytale-illustration` | Classic Fairytale | Rich magical style for fantasy-heavy story prompts. |
| `pastel-kawaii` | Pastel Kawaii | Soft emotional tone and high younger-kid appeal. |
| `bold-comic-panel` | Bold Comic Panel | Dynamic action readability for adventure stories. |
| `claymation-3d` | Claymation 3D | Premium tactile depth without uncanny realism. |
| `simple-anime-kids` | Simple Anime Kids | Expressive character emotion for older-kid tastes. |
| `nature-sketch-wash` | Nature Sketch + Wash | Excellent for animal and nature educational themes. |
| `retro-picture-book` | Retro Picture-Book | Distinctive nostalgic brand style parents also enjoy. |

## Prompting Contract

Each style includes:

- `description`: short user-facing summary in selection UIs
- `whyItWorks`: product rationale for UX and editorial alignment
- `promptDescriptor`: generation direction appended to cover/page image prompts

## Wiring

- Create flow style picker: `src/app/create/page.tsx`
- Correction modal style selector: `src/components/correction-modal.tsx`
- Validation allowlist: `src/lib/validation.ts`
- Story/user prompt style language + image suffixes: `src/lib/constants.ts`
- Tier style entitlements: `src/lib/entitlements.ts`

