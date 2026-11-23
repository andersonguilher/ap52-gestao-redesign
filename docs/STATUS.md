# STATUS — 2026-11-23

## Current objective
Demonstrate a new UI/UX (Brand Manual 2025 rebrand + lower information density) to the developers of the original system (https://ap52gestaoestrategica.pages.dev/). Work is local in `site/`; nothing published.

## Observed state (evidence: files and Git)
- Git: branch `main`, **no commits**; everything untracked (`.env`, `INIT.md`, `identidade_visual.pdf`, `rebrand.py`, `recolor_green.py`, `site/`, `site_original_backup/`).
- `site/` has 74 entries; `site_original_backup/` has 63 files (original).
- Change log: `site/README-ALTERACOES.md` (palette, `brand-rio.css`, `brand-ux.*`, 6-step RVL wizard, PWA).
- Green recoloring in `demandas*`/`asfaltinho-*` CSS done by `recolor_green.py` (script exists).

## Session summary (2026-11-23)
- Initialized per INIT.md: created AGENTS.md, README.md, docs/STATUS.md, docs/WORKFLOW.md; translated `site/README-ALTERACOES.md` to English. No site code changed.

## Validated
- Manual check of the site by the user (2026-11-23): "ok". Screens covered not detailed; no automated tests.
- The agent executed nothing during initialization (reading and documentation only).

## Pending
- Create `.gitignore` (include `.env`) before the first commit.
- Validate the map after publishing (it failed on localhost, likely an origin restriction).
- Cera Pro: confirm license or keep Figtree.
- Confirm RLS/permissions in Supabase (outside the repository; not verified).
- Demo points at the original's production Supabase: decide on a separate/read-only backend or get the developers' agreement before hosting.
- How to deliver the demo to the developers (hosting separate from the original, or package/diff): awaiting user decision.

## Suggested next step
Make the first commit checkpoint (`.gitignore` with `.env` + docs, then `site/` and the backup) and decide how to deliver the demo to the developers.

## Evidence limits
No automated tests. README commands come from existing documentation, not from execution in this session.
