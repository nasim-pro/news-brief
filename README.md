# News Brief MVP

A small TypeScript/Express backend that reads reliable public RSS feeds, stores article metadata in local MongoDB, asks an AI model to identify consequential developments, and serves the latest important stories. India-specific feeds are first-class inputs rather than an afterthought.

## Prerequisites

- Node.js 20 or newer
- A locally running MongoDB instance (the default database is `news-brief`)
- Ollama running locally

Install dependencies and create local configuration:

```bash
npm install
cp .env.example .env
```

Start MongoDB using your normal local installation. The default connection is `mongodb://localhost:27017/news-brief`; change `MONGODB_URI` in `.env` if needed.

AI processing uses only local Ollama—no cloud account or API payment is required. Start Ollama, then install the configured model:

```bash
ollama pull qwen2.5:7b
```

Keep `AI_PROVIDER=ollama` in `.env`. Configure the running server and any installed model through `OLLAMA_BASE_URL` and `OLLAMA_MODEL`; the application does not hard-code a model name. `AI_SELECTION_BATCH_SIZE` (default `15`) limits each selection request; `AI_MAX_SELECTION_INPUT_CHARS` adds a hard 10,000-character budget per selection request; and `AI_MAX_DESCRIPTION_CHARS` / `AI_MAX_CONTENT_CHARS` cap every field sent to the model. Selection sends metadata only—never article bodies or URLs—and summaries run only for selected stories. Before processing, the app verifies the configured model through Ollama's local `/api/tags` endpoint. Unavailable Ollama, absent models, timeouts, empty or invalid JSON responses are reported clearly and leave collected articles pending for the next run.

## Run it

```bash
npm run dev          # API with file watching
npm run build && npm start
npm run news:run     # one complete ingestion + processing run
npm test
```

The API endpoints are:

```bash
curl http://localhost:3000/api/health
curl 'http://localhost:3000/api/news/latest?limit=20'
```

`/api/news/latest` returns at most 50 selected stories, newest first, with only the public story fields and source links.

## Sources

Source configuration lives in `src/config/sources.ts`. It currently enables public feeds from The Hindu, Indian Express, PIB, RBI, BBC and NASA. Reuters is disabled because it does not maintain a universal public RSS catalog; set `REUTERS_FEED_URL` to a currently verified permissible URL to activate it. ISRO is also represented but disabled because its former public RSS path currently returns 404; use `ISRO_FEED_URL` only after verifying a replacement. Feeds are fetched independently, so a failed or malformed source is logged without stopping the rest of the run. The system stores metadata, URLs and limited RSS content only; it does not scrape pages or bypass access restrictions.

To add a source, add an enabled `SourceConfig` entry with a verified, permitted RSS/Atom URL and one of the supported categories. No pipeline changes are needed.

## Architecture

- `src/sources`: RSS adapter and shared normalized article types.
- `src/services/NewsPipeline.ts`: fetches, validates, normalizes URLs, deduplicates, persists and processes articles.
- `src/ai/AiNewsAnalyzer.ts`: provider-neutral contract used by the pipeline.
- `src/ai/OllamaNewsAnalyzer.ts`: local `/api/tags` and `/api/chat` implementation with structured JSON validation and one retry for malformed model output.
- `src/ai/createAiNewsAnalyzer.ts`: factory that selects the configured provider. Only `ollama` is supported today; future cloud providers can implement the same interface without changing ingestion, storage, processing, or the API.
- `src/models`: `NewsArticle` retains source material and `NewsStory` exposes concise selected developments with source references.
- `src/routes` and `src/controllers`: small Express API layer.

The pipeline uses exact normalized URLs plus a deliberately conservative near-title check. It does not perform semantic clustering yet, so different outlets covering the same event can still form separate stories. Scheduling is intentionally external for this MVP: run `npm run news:run` from cron every 15–30 minutes when ready. MongoDB and AI failures leave already collected data intact; articles whose summary call fails remain pending for a later run.
