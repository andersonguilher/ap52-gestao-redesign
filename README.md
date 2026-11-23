# AP5.2 — Gestão Estratégica

A UI/UX transformation project for the existing web system for personnel and operations control of the AP5.2 Coordination, using the Rio de Janeiro City Hall visual identity (Brand Manual 2025). Its only goal is to demonstrate the new UI/UX to the developers of the original system (https://ap52gestaoestrategica.pages.dev/); it does not replace the original. This repository holds the local rebranded copy, the backup of the original, and the color migration scripts.

## Available today
- Static site in `site/` (modules: dashboard, employees, demands, schedules, warehouse, contracts, map, RVL, Asfaltinho). The UI is in pt-BR.
- Color rebrand and UX layer (`site/brand-rio.css`, `site/brand-ux.*`). Details in [site/README-ALTERACOES.md](site/README-ALTERACOES.md).

## Planned / pending
- Host the demo for the developers (option: Cloudflare Pages in a project separate from the original; user's decision, nothing has been published).
- Hand them a summary of the changes (currently `site/README-ALTERACOES.md`).
- License/@font-face for the Cera Pro font (currently Figtree).
- Validate the map after publishing (it did not load on localhost).

## Prerequisites
- Python 3 (used to serve locally and run the scripts; verified version: 3.12.10).
- A modern browser and internet access (Supabase, jsDelivr, and Google Fonts load from CDNs).

## Run locally
```powershell
cd site
python -m http.server 8765
# open http://localhost:8765/
```
Command taken from `site/README-ALTERACOES.md`; **not executed** during initialization.

## Color scripts (not executed during initialization)
- `rebrand.py` — reapplies the palette migration (run inside the site folder that contains the `*.css`/`*.js` files).
- `recolor_green.py` — recolors greens in `site/demandas*.css` and `site/asfaltinho-*.css` (run from the repo root). Both rewrite files: review the diff afterwards.

## Configuration
- The client uses the project's Supabase with a public key embedded in `site/index.html`.
- `.env` (root) contains `user` and `pwd`; it is a secret and must not be versioned. No site code reads it (not confirmed for other uses).

## Tests and build
There are no test suites, `package.json`, or build step. Verification is manual in the browser. Suggested first check: the login screen opens with no console errors.

## Git state
Public repository: https://github.com/andersonguilher/ap52-gestao-redesign. `site_original_backup/` and the brand manual PDF are kept local only (see `.gitignore`). Workflow: [docs/WORKFLOW.md](docs/WORKFLOW.md).

See also [AGENTS.md](AGENTS.md) and [docs/STATUS.md](docs/STATUS.md).
