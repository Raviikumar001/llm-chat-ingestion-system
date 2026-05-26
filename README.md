# Ollive

Lightweight inference logging and ingestion system for an LLM chatbot. The project is built as a small monorepo with a web chat app, an API layer, an internal LLM gateway, and PostgreSQL-backed storage for conversations, messages, and inference logs.

## What It Includes

- Multi-turn chatbot UI with conversation list and resume support
- Provider/model switching in the UI
- Internal LLM gateway that captures provider, model, latency, token usage, timestamps, previews, status, and errors
- Ingestion pipeline that validates and persists normalized inference events
- PostgreSQL schema for conversations, chat messages, and inference logs



## Architecture
live: https://excalidraw.com/#json=_xEEbchOmTbrIHPwRXEvq,QRzegfyf2qIlEcYmmRaOGg
![architecture](image.png)

```text
Browser
  -> Next.js web app
  -> Fastify API
      -> LLM gateway
          -> Cerebras or Gemini
      -> ingestion service
          -> PostgreSQL
```

### Components

- `apps/web`
  Chat UI, conversation sidebar, provider/model selector, request states, and resume flow.
- `apps/api`
  Fastify server for conversations, chat, health checks, and ingestion.
- `packages/llm-gateway`
  Thin provider adapters plus normalized inference instrumentation.
- `packages/shared`
  Shared Zod schemas, types, and provider/model catalog.
- `PostgreSQL`
  Durable storage for conversations, messages, and inference logs.

## Tech Stack

| Layer | Technology |
|-------|------------|
| Language | TypeScript |
| Monorepo | pnpm workspaces |
| Frontend | Next.js 14, React 18, Tailwind CSS |
| Backend | Fastify 4 |
| Database | PostgreSQL 16 |
| ORM | Drizzle ORM |
| Validation | Zod |
| Testing | Vitest |
| Containers | Docker Compose |

## Supported Providers

### Cerebras

- `gpt-oss-120b`
- `llama3.1-8b`
- `qwen-3-235b-a22b-instruct-2507`
- `zai-glm-4.7`

### Gemini

- `gemini-3.1-flash-lite`
- `gemini-3-flash-preview`

The server default comes from `DEFAULT_PROVIDER` and `DEFAULT_MODEL`, and the UI can override them per request.

## Environment Setup

Create either `.env.local` or `.env` in the repo root. `.env.local` is recommended for local development.

```bash
cp .env.example .env.local
```

Required values:

```bash
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/ollive

CEREBRAS_API_KEY=your_cerebras_key
GEMINI_API_KEY=your_gemini_key

DEFAULT_PROVIDER=cerebras
DEFAULT_MODEL=gpt-oss-120b
```

## Run Locally

```bash
pnpm install

docker run -d --name ollive-postgres \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=ollive \
  -p 5432:5432 postgres:16-alpine

pnpm db:migrate
pnpm dev
```

Open:

- Web: `http://localhost:3000`
- API health: `http://localhost:3001/health`

## One-Command Docker Compose

The compose stack reads repo-root `.env.local` or `.env` if present.

```bash
cd infrastructure/docker
docker compose up --build
```

Open:

- Web: `http://localhost:3000`
- API: `http://localhost:3001`

## Main API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/health` | GET | Liveness check |
| `/ready` | GET | Readiness check with DB probe |
| `/api/v1/conversations` | POST | Create a conversation |
| `/api/v1/conversations` | GET | List conversations |
| `/api/v1/conversations/:id` | GET | Fetch a conversation and its messages |
| `/api/v1/chat/options` | GET | Available providers, models, and defaults |
| `/api/v1/chat` | POST | Send a chat message using stable request/response flow |
| `/api/v1/chat/stream` | POST | Experimental SSE streaming endpoint |
| `/api/v1/chat/:id/cancel` | POST | Cancel active streaming inference |
| `/api/v1/ingestion/inference-logs` | POST | Ingest normalized inference events |

## Schema Design Decisions

### `conversations`

- One row per chat thread
- Stores status, timestamps, and last-message activity markers
- Indexed for recent-first listing and status filtering

### `messages`

- One row per user or assistant message
- Stores full content plus `content_preview` for list views
- Uses `(conversation_id, sequence_number)` uniqueness to keep order stable
- Constrained roles: `system`, `user`, `assistant`

### `inference_logs`

- One row per logical LLM request lifecycle
- Stores provider, model, status, timing, token counts, finish reason, request/response previews, and provider-specific metadata
- Uses `request_id` to merge lifecycle updates across `started` and terminal events
- Uses `event_id` dedupe for direct duplicate submissions
- Links to both the user message and assistant message where available

## Logging And Ingestion Flow

1. The API persists the user message.
2. The chat route builds a short context window from recent messages.
3. The LLM gateway calls the selected provider and emits normalized inference lifecycle events.
4. The ingestion service validates the payload and stores or updates the corresponding `inference_logs` row.
5. The API persists the assistant message and links it back to the inference log row.

## Failure Handling Assumptions

- Provider auth, rate-limit, timeout, and network failures are normalized and surfaced cleanly to the UI.
- Ingestion failures should not crash the chat request path.
- Lifecycle updates are merged by `request_id`, and terminal rows are protected from stale `started` retries regressing the stored state.
- Database availability is required for normal chat because messages are persisted as part of the main request flow.

## Scaling Considerations

- The current ingestion path is in-process for simplicity.
- A production version would move ingestion to an async queue or event bus.
- Conversation reads can be optimized further with denormalized metadata or query-side joins instead of per-conversation lookups.
- Multi-node deployments would benefit from centralized cancellation/state coordination instead of in-memory request tracking.

## Tradeoffs

1. The primary UI path uses non-streaming chat because it is the most reliable path for the take-home core requirements.
2. Streaming is still present as a bonus endpoint, but it is not the main UX path.
3. Ingestion is synchronous and in-process rather than queue-backed.
4. There is no authentication because this is a single-user demo submission.
5. PII redaction and dashboards are intentionally left for later phases or bonus scope.

## What I Would Improve With More Time

1. Add a proper metrics dashboard for latency, throughput, and error rates.
2. Move ingestion to a durable async pipeline.
3. Add stronger integration tests around the DB-backed chat and ingestion paths.
4. Harden streaming and make it a first-class UI mode again.
5. Add conversation search, auth, and multi-user support.
6. Add PII redaction before log persistence.

## Testing

```bash
pnpm lint
pnpm test
pnpm build
```

Useful focused commands:

```bash
pnpm --filter @ollive/api test
pnpm --filter @ollive/api lint
pnpm --filter @ollive/web lint
```

## Demo Checklist

1. Start the app.
2. Create a new conversation.
3. Send multiple turns in the same thread.
4. Switch between `cerebras` and `gemini` in the header.
5. Resume an older conversation from the sidebar.
6. Inspect stored inference logs in PostgreSQL to confirm metadata persistence.
