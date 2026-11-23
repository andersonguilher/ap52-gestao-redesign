# AGENTS.md — AP5.2 Gestão Estratégica

Scope: this folder (`apagar/`). The `AGENTS.md` in `Downloads/` is about ACE Studio and does not apply to this project.

## Nature of the project
A UI/UX transformation of an existing system (rebrand + reduced information density). The original's behavior, business rules, and data must remain intact; only presentation and visual organization change.

Purpose: a demonstration/proposal of a new UI/UX for the developers of the original system, which is live at https://ap52gestaoestrategica.pages.dev/ (not verified by the agent). This repository is not the official source and does not replace the original; changes here are input for them to adopt. Keep changes easy to review and reapply (`brand-*` CSS/JS layer, diffs against the backup).

## Language
All documentation is written in English. The product UI stays in pt-BR (user-facing strings are not translated).

## Product
Web system for personnel and operations management of the AP5.2 Coordination (Rio de Janeiro City Hall): dashboard, employees, demands, schedules, warehouse, contracts, map, RVL (inspection report), Asfaltinho.

## Stack (confirmed in code)
- Static site: `site/index.html` (~1.8 MB, inline CSS/JS) plus `*.css`/`*.js` modules it loads. No `package.json`, no build.
- Backend: Supabase (`supabase-js@2.116.0` client via jsDelivr CDN), accessed directly from the browser (`from(...)` tables and `rpc(...)` functions).
- Figtree font (Google Fonts); PWA via `site/manifest.json` (no service worker).
- The original is hosted on Cloudflare Pages (URL above). Publishing this demo is the user's decision; never publish over the original.

## Repository map
- `site/` — working copy (rebrand + UX). See `site/CHANGES.md` (canonical record of what changed).
- `site_original_backup/` — pre-rebrand original. Read-only baseline for diffs. Git-ignored (local only; do not publish).
- `site/index.original.html` — preserved original HTML.
- `identidade_visual.pdf` — Brand Manual 2025 (palette: #13335a, #2a688f, #42b9eb, #eceded).

## Conventions
- Edit `site/`, never `site_original_backup/`. Do not change business rules or data in visual tasks; the `brand-*.css/js` layer only shows/hides and restyles.
- `brand-rio.css` loads last; brand adjustments go there or in `brand-ux.*`.
- Green/amber/red are semantic status colors; do not recolor them.
- `index.html` is large: use search and excerpts, not full reads.

## Security
- `.env` holds credentials: never read values, print them, or commit them. There is no `.gitignore`; ignore `.env` before any commit.
- The browser may only use the Supabase public (publishable/anon) key; `service_role` keys never go in the client, the repository, or prompts. Real authorization depends on RLS/RPC in Supabase (not verifiable from this repository).
- The site points at the original's production Supabase project; a hosted demo acts on real data unless a separate backend is used.
- Use synthetic data for tests; do not export employee data.

## Documents
- [README.md](README.md) — local run and commands.
- [docs/STATUS.md](docs/STATUS.md) — current state (max 80 lines).
- [docs/WORKFLOW.md](docs/WORKFLOW.md) — start, resume, and close routines, and commit policy.

## Commits
Proactively suggest commits at validated milestones, following the policy in [docs/WORKFLOW.md](docs/WORKFLOW.md#commit-checkpoint-policy). Never run `git add/commit/push` without authorization.

## Source priority
User instructions > this file > `site/CHANGES.md` > observed code. Discrepancies between code and intent are recorded, not silently "fixed".
