# AP5.2 — Rio City Hall Rebrand + UX (local copy)

This folder (`site/`) is a COPY of the site. The original is in `../site_original_backup/`.
To view: run `python -m http.server 8765` inside `site/` → http://localhost:8765/
To publish: upload the contents of `site/` to Cloudflare Pages (you decide when).

## What changed
- Palette migrated to the Brand Manual 2025 (#13335a, #2a688f, #42b9eb, #eceded); green/amber/red only for status.
- `brand-rio.css` (loaded last): tokens, typography (Figtree ≈ Cera Pro), visible focus, buttons, cards, forms, login, brand triangle in headers, fixed sidebar, KPIs without clipped text, reduced-motion.
- Action Center: fixed panel only at ≥1600px; below that it becomes a drawer (more room for content).
- Font floors (10→11.5px etc.), PWA manifest/icons (192/512/apple) and brand theme-color.
- The color migration was done with one-off scripts that have since been removed; the results are in this folder.

## Information density (brand-ux.css / brand-ux.js)
- Dashboard: 5,094px -> ~1,600px. KPIs in one row; "Attention needed" shows only items with occurrences; "Alerts" shows 5 + "Show all"; analytical sections (quick reports, distribution, management units, trend, stability, movements) become closed accordions (state saved in the browser).
- Employees: 22 repetitive cards -> one-line list per person; filters collapsed behind a "Filters" button; side panel became a drawer (opens on clicking a person or "Summary and priorities").
- Removed what repeated: unit pill at the top (already in the sidebar/breadcrumb), eyebrow/subtitle in headers, descriptions under section titles, repeated "22ª GC"/"Local" labels.
- No business rule or data was changed; JS only shows/hides and regroups.

## RVL — Inspection Report
- Wine/red -> brand blue (red only on the remove-row button).
- 5,500px scrolling form -> 6-step wizard (one step at a time) with Back/Next; the top stepper remains clickable. Step 6 = preview + Generate PDF.
- Side column: only "Quick view" and "Review"; "Follow-up" and "Shortcuts" repeated information.
- Fixed in the copy: the crest (rvl-crest.png) and foto.jpg had not been downloaded.
- Files: brand-ux.css (RVL section) and brand-ux.js (wizard block). The original functions rvlIrEtapa/rvlIrPrevia are replaced by versions that show one step at a time.

## Pending / attention
- Cera Pro is a commercial font: if the City Hall has a license, add @font-face to brand-rio.css.
- The map did not load on localhost (likely an origin restriction); validate after publishing.

Note: UI labels quoted above are translated for this document; the site UI itself remains in pt-BR.
