---
name: customize-ai-office
description: Customise this AI Office 3D Starter Kit for a company — name, brand colours, logo, the four AI role titles, room names and captions, in English and Arabic — by editing office.config.ts, then run the checks and show the result. Use when the user wants to brand, rename, translate or personalise the 3D office, or asks to "make it ours". Arabic triggers: خصّص المكتب، غيّر اسم الشركة، أضف شعاري، ترجم.
---

# Customise the AI Office 3D Starter Kit

Talk to the user in the language they write in (English or Arabic). Keep it short and friendly; they may not be a developer.

## Rules

- Edit only `office.config.ts`, and add files to `public/brand/`. Do not change `src/`, `tests/` or `tools/` unless the user explicitly asks.
- Every `Text` in the config has `en` and `ar`. If the user gives one language, write a natural, professional translation for the other and show it for approval. Arabic: Modern Standard Arabic, no diacritics except where they prevent misreading.
- Keep the disclosure honest (`disclosure`, `closingLine`, `captions.teamMeetingSub`, `captions.meetingSub`): the figures follow a fixed script and do no real work. Never reword them into a claim of live, real-time or real AI activity. Role titles always keep the AI tag (it is added automatically from `aiTag`).
- Do not install packages, create accounts or publish anything.

## Steps

1. Read `office.config.ts` (its comments explain every field) and the "Make it yours" section of `README.md`.
2. Ask in **one** message for: company name; two brand colours (dark `primary`, highlight `accent`, hex) or their website to suggest them; logo files (a light full logo and a square mark) or "keep the placeholder"; the four AI role titles or "keep the defaults"; room names to change; default language.
3. Apply the answers:
   - `company.name`, `company.headquarters` (both languages).
   - `brand.primary` must be dark enough for white text; `brand.accent` should contrast with it.
   - Logo: copy the files into `public/brand/` and set `brand.logo` / `brand.mark` to `/brand/<file>`. The full logo must be a light version (it sits on `primary`). PNG with transparency at least 600 px tall, or SVG with `width` and `height`. If they only have a dark logo, say so and ask for a light one (or offer to keep the placeholder).
   - `roles.<slot>`: `title` and `short` in both languages; a different `character` per role; distinct, non-green `color`s. The slots keep their ids (`coo`, `marketing`, `admissions`, `bizdev`); explain which office each slot sits in if the user asks (see the comment above `RoleSlot`).
   - Room names in `rooms` that relate to a renamed role should be renamed too (for example `admissions_office`, `admissions_library`), in both languages.
   - `language.default`.
4. Run `npm install` if `node_modules/` is missing, then `npm run check`. Fix any reported config problem and re-run until it passes. Report the real result.
5. Run `npm run dev` in the background and give both links: `http://127.0.0.1:5173/?lang=en` and `http://127.0.0.1:5173/?lang=ar`. If you can open a browser, look at both and check that no label or caption is cut off; long titles may need a shorter `short` form.
6. Optional, if Chrome is installed: `npm run build && npm run check:browser`, then look at a few screenshots in `check-output/`.
7. Finish with a short summary of the changes and the recording address `http://127.0.0.1:5173/?lang=<lang>&autoplay=short&clean=1` (add `&frame=9x16` for vertical video). Remind them to keep the disclosure line visible in any video.
