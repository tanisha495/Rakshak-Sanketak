# Sanketak

An anonymous, multilingual worker safety reporting system that flags reports
with genuine fatal potential (SIF precursors) instead of leaving a human to
triage them by hand. Built for SIH 2026, problem statement SIH26165.

A worker files a report from the phone app. The backend scores it, extracts a
structured **SIF Fingerprint** from the free text, matches it against
historical precedents, and an HSE officer sees the result on the dashboard —
including the exact quoted words that justified the flag.

---

## Quick start

Requires Docker, and Node 18+ only if you want to run the phone app.

```bash
git clone <this repo>
cd Sanketak-
git checkout working_ver

./scripts/setup.sh          # creates .env and mobile/.env
# now edit .env and put in a real OPENAI_API_KEY

docker compose up -d --build
```

That is the whole backend. Migrations run automatically on boot.

| What | Where |
|---|---|
| **HSE dashboard** | <http://localhost:8000/dashboard/> |
| API docs (Swagger) | <http://localhost:8000/docs> |
| Health check | <http://localhost:8000/health> |

The dashboard is served by the API itself. No web server or editor plugin
is needed.

### Log in to the dashboard

There are no default credentials. Create an account:

```bash
curl -X POST "http://localhost:8000/auth/register?email=you@example.com&password=yourpassword&role=admin"
```

Then sign in at <http://localhost:8000/dashboard/> with that email and password.

### Seed the historical corpus

The intelligence features (barrier drift, emerging risk, precedent matching)
need history to detect anything. 500 real extracted reports ship with the repo:

```bash
docker compose exec api python seed_reports_from_predictions.py
```

These are written with `source="seed"`, which keeps them out of the HSE triage
queue while remaining visible to the intelligence engine. Live worker
submissions are `source="live"`. Add `?include_seed=true` to a listing endpoint
to see both.

---

## The phone app

```bash
cd mobile
npm install --legacy-peer-deps     # see "Known issues" for the flag
npx expo start --lan
```

Open **Expo Go** on a phone **on the same Wi-Fi**, and scan the QR code.

`scripts/setup.sh` already wrote your machine's LAN IP into `mobile/.env`.
This matters: `localhost` on a phone means *the phone*, not your laptop. If
your IP changes, delete `mobile/.env` and re-run the script.

If the app cannot reach the backend, check in this order:

1. Phone and laptop on the same network, with AP/client isolation off
2. `curl http://<your-lan-ip>:8000/health` from the laptop returns `{"status":"ok"}`
3. `EXPO_PUBLIC_API_BASE_URL` in `mobile/.env` matches that IP
   (it is baked into the JS bundle at build time — restart Expo after editing)

---

## Layout

```
app/              FastAPI backend (routers, models, services)
alembic/          database migrations, run automatically on boot
nlp/              SIF Fingerprint extraction: taxonomy, loader, extractor
  taxonomy/       122 ids across 10 sections, grounded in IOGP Report 459
  data/           gold set + 500-report prediction corpus
intelligence/     barrier drift, emerging risk, precedent matching
dashboard/        HSE dashboard (plain HTML/JS, served at /dashboard/)
mobile/           the worker's phone app (Expo / React Native)
src/              SIF classifier training and evaluation
scripts/          setup.sh
dashboard-legacy.superseded/   old Supabase dashboard, kept for reference only
```

Note `app/` is the Python backend and `mobile/app/` is the app's screen
router. They are different things that happen to share a name.

---

## Tests

```bash
cd nlp && PYTHONPATH=src python3 -m pytest tests -q      # 70 passed, 1 skipped
python3 -m pytest intelligence/tests/test_emerging_rate_ratio.py \
                 intelligence/tests/test_analyze_report_contract.py -q
cd mobile && npx tsc --noEmit
```

The `nlp` suite needs `PYTHONPATH=src`; plain `pytest` from the repo root
fails on imports.

---

## Known issues

Things that are broken or fake. Read before demoing.

| Issue | Effect |
|---|---|
| **Photo reports fail to submit** | The backend has no photo parameter or storage. Submission errors out rather than dropping the image quietly. Use text reports. |
| **`site` is fabricated** | The worker's chosen site is never sent; the backend derives `site_tag` from a hash of the report text (`site-1`..`site-5`). Risk Radar groups by this. |
| **No `area` field** | Risk Radar's site+area grouping collapses to one row per site. |
| **`extraction_status: "failed"` is overloaded** | Means both "provider error" and "no barrier failure found". A report with no SIF precursor looks like a crash. |
| **Status values are unvalidated** | `PATCH /reports/{id}/status` accepts any string and returns 200. |
| **`npm ci` fails in `mobile/`** | Pre-existing `react` / `react-dom` peer conflict. Use `npm install --legacy-peer-deps`. |
| **CORS is `allow_origins=["*"]` with credentials** | Invalid per spec and wrong for an authenticated API. Fine locally, not for deployment. |
| **Voice transcription still uses Supabase** | `EXPO_PUBLIC_USE_MOCK_VOICE_API=true` in `mobile/.env` avoids it. Text reports never touch Supabase. |

---

## How a report flows

```
phone app  --POST /reports/?raw_text&language-->  FastAPI
                                                    |
                            SIF classifier (TF-IDF + logistic regression)
                                                    |
                            NLP extractor -> SIF Fingerprint (LLM)
                                                    |
                            embedding (all-MiniLM-L6-v2) -> pgvector
                                                    |
                                                 Postgres
                                                    |
                          dashboard  <--GET /reports/, /intelligence/{id}
```

Every barrier failure carries an `evidence_span` that is verified to appear
character-for-character in the original report. A span that cannot be found is
dropped rather than shown. That is what the dashboard's "Why Sanketak Flagged
This" panel displays, and it is a structural guarantee rather than a measured
rate.
