# Sanketak — Architecture Note (On-Prem / Self-Hosted Framing)

## Core claim

Sanketak runs primarily on infrastructure OIL controls. Core reporting, analysis, and dashboard
functions require no third-party cloud service and run entirely within OIL's own network. One
module (NLP fingerprint extraction) currently depends on an external LLM API, disclosed below.

## What runs where

| Component                                           | Runs on                                     | External calls?                          |
| --------------------------------------------------- | ------------------------------------------- | ---------------------------------------- |
| FastAPI backend                                     | OIL's server (Docker container)             | None                                     |
| PostgreSQL + pgvector                               | OIL's server (Docker container)             | None                                     |
| JWT auth (HSE login)                                | OIL's server, self-signed tokens            | None                                     |
| SIF prediction model (TF-IDF + Logistic Regression) | OIL's server, runs locally via scikit-learn | None                                     |
| NLP fingerprint extraction (LLM-based)              | OIL's server calls out to LLM provider      | Yes — requires internet + OpenAI API key |

## Data flow

1. Worker submits a report (text, any language) → stored directly in OIL's own Postgres database.
2. Report text is analysed by the SIF model → result (risk probability, risk level) written back to the same database.
3. Report text is also analysed by the NLP fingerprint extractor (via an external LLM API call) → structured safety data (activity, hazard, barrier failures) written back to the same database.
4. HSE staff log in with JWT-authenticated accounts stored in the same database, and view/query reports, patterns, and precedent matches — all served from local data, no external lookups.
5. Worker can check status anytime using only their anonymous token — no login, no PII stored.

## What data never leaves the OIL network

- Raw report text (potentially sensitive incident descriptions) — except the portion sent to the external LLM API for fingerprint extraction, per the disclosed exception above
- Worker anonymous tokens
- HSE user credentials (hashed, never stored in plain text)
- Risk scores, patterns, and corrective action records

## How HSE staff can edit rules without redeploying code

Currently, detection categories (barrier categories, equipment tags) are defined in the
backend service layer (`app/services/analysis.py`). A future `/rules` CRUD endpoint (planned)
would move these into the database, so HSE admins can add/edit detection rules through the
API/dashboard without any code change or redeployment — directly demonstrating the
"rules editable by OIL's HSE team" capability live.

## Deployment

The entire stack (API + database) starts with a single command: `docker-compose up --build`

An OpenAI API key must be provided via environment variable for the NLP fingerprint extraction
module to function; all other functionality works without it.

## Open item

The SIF prediction model (Member 2, TF-IDF + Logistic Regression) has been confirmed to run
entirely locally within the same infrastructure — no external API calls, verified through
direct integration and testing.

The NLP fingerprint extraction module (Member 3) uses an external LLM API (OpenAI) for text
understanding, and therefore requires internet access and an API key to function. This is a
disclosed exception to the fully self-hosted architecture, and will be explained transparently
during demo Q&A if raised. The core reporting, analysis, and dashboard functions remain fully
self-hosted regardless of this module's availability.
