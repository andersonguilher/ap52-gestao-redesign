# STATUS — 2026-11-23

## Current objective
Demonstrate a new UI/UX (Brand Manual 2025 rebrand + lower information density) to the developers of the original system (https://ap52gestaoestrategica.pages.dev/). Live demo: https://andersonguilher.github.io/ap52-gestao-redesign/ (GitHub Pages, deployed from `main`).

## Observed state (evidence: files and Git)
- Git: branch `main`, commits pushed to the public repo https://github.com/andersonguilher/ap52-gestao-redesign. Ignored (local only): `.env`, `site_original_backup/`, `identidade_visual.pdf`.
- GitHub Pages is enabled (source: GitHub Actions) via `.github/workflows/pages.yml`; every push to `main` redeploys `site/`.
- The former `site/.git` (1 commit) was moved to `../site-nested-git-backup` (outside the repo).
- `site/` has 74 entries; `site_original_backup/` has 63 files (original).
- Change log: `site/CHANGES.md` (palette, `brand-rio.css`, `brand-ux.*`, 6-step RVL wizard, PWA).
- The one-off color migration scripts (`rebrand.py`, `recolor_green.py`) were deleted; their results are already in `site/`.

## Session summary (2026-11-23)
- Initialized project docs; published the demo to GitHub Pages; fixed weekend color vs. Falta; removed one-off color scripts; renamed the change log to `site/CHANGES.md` (English).

## Validated
- Manual check of the site by the user (2026-11-23): "ok". Screens covered not detailed; no automated tests.
- Deploy workflow runs succeeded; the hosted page was not opened in a browser by the agent.

## Pending
- Validate the map after publishing (it failed on localhost, likely an origin restriction).
- Cera Pro: confirm license or keep Figtree.
- Confirm RLS/permissions in Supabase (outside the repository; not verified).
- Demo points at the original's production Supabase: decide on a separate/read-only backend or get the developers' agreement before hosting.
- How to deliver the demo to the developers (hosting separate from the original, or package/diff): awaiting user decision.

## Suggested next step
Enable GitHub Pages, then share the URL with the developers once the backend question is settled.

## Evidence limits
No automated tests. README commands come from existing documentation, not from execution in this session.
