# Superseded dashboard (pre-FastAPI)

These 17 files are the original dashboard, which read from **Supabase**. They
were sitting loose in the repository root, where VS Code Live Server serves
them at `/index.html` — one path away from the current dashboard at
`/dashboard/index.html`, with nothing recording which was correct. Opening the
wrong one gives a Supabase login, an empty report list and a blank
"Why Sanketak Flagged This" panel.

Moved here rather than deleted, so nothing is lost while the ambiguity is.

**The live dashboard is `dashboard/`.** Use that one.

Why this copy is not the one you want:

| | this copy | `dashboard/` |
|---|---|---|
| last commit | `5250fb4` 2026-09-14, "Connect dashboard to Supabase realtime" | `d403c75` 2026-09-15, "complete dashboard integration" |
| `fetch()` calls to the FastAPI backend | 0 | 4 |
| Supabase references | 42 | 6, all comments |
| `taxonomy-labels.js` | absent, so taxonomy ids render unlabelled | present |

Every file here has a counterpart in `dashboard/`; nothing is unique to this
directory. It can be deleted once nobody needs the reference.
