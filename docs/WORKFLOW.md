# WORKFLOW

Entry point: [AGENTS.md](../AGENTS.md). Current state: [STATUS.md](STATUS.md). Commands: [README.md](../README.md). Intent is recognized by meaning, not exact phrase.

## Plan the day
("what do we do today?", "where did we stop?")
1. Use AGENTS.md and STATUS.md without rereading what is already in context.
2. Run `git status --short`; consult commits or history only if needed.
3. Present current state, verifiable pending work, and up to three next steps.
4. Wait for a choice only if the user has not already picked a task.

## Resume uncommitted work
1. Check `git status --short` and relevant diffs before editing. Today everything is untracked: comparing `site/` with `site_original_backup/` shows what changed.
2. Tell complete work from partial by evidence; preserve all existing changes.
3. Use STATUS.md and `site/CHANGES.md` only to understand intent.
4. Reconstruct the objective, previous validation, and safest next step; continue and validate.
5. Ask only if plausible interpretations lead to different outcomes.

## Close the day
1. Finish checks proportional to the authorized work.
2. Review `git status --short` and diffs.
3. Update STATUS.md (result, evidence, pending work, next step; max 80 lines).
4. Update permanent documentation only if it became outdated (including `site/CHANGES.md` if behavior changed).
5. Record durable decisions only when useful.
6. Summarize changed files, validation, risks, and pending work.
7. Evaluate the commit policy below.

## Execute a concrete task
If the user already said what to do, the task takes priority over the ritual: inspect context, implement, validate, and deliver, without offering options for a choice already made.

## Language
Write all documentation in English. Keep the product UI in pt-BR.

## Validation
No automated tests. For a visual or behavior change: serve `site/` locally (see README) and check the affected screen and the browser console. Documentation-only change: review paths, links, and the diff. Mocks do not prove real Supabase behavior.

## Git
No commit message convention yet; suggested: a short imperative message, consistent in one language. Treat pre-existing changes as the user's. Never commit `.env`. `git add/commit/push` only with authorization (commit permission does not imply push).

## Commit checkpoint policy
Evaluate after completing a coherent unit, before switching objectives or a broad refactor, and when preparing a handoff. Do not use time or file count as the criterion.
1. Inspect status, diffs, and intended untracked files; identify the exact files of the commit.
2. Confirm the unit is complete and passed applicable checks (docs: consistency, links, formatting).
3. Exclude others' work, secrets, and temporary artifacts; if several units are ready, suggest separate commits and their order without changing the index.

Give one concise recommendation: why it is a good checkpoint, scope, proposed message, and validation/limits. If checks failed or the unit is incomplete, say what remains. A clean tree needs no suggestion. Suggest once per checkpoint; do not repeat if the user defers. It is not a blocking step.

First expected checkpoint: `.gitignore` (with `.env`) + docs; then the rebranded `site/` and the backup, in separate commits.
