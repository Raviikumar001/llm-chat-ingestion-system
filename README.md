# SignalChat

SignalChat is my submission for the Ollive take-home assignment. I built it as a single application that combines the four required parts of the prompt: a chat app, an internal LLM wrapper, an ingestion pipeline, and database-backed storage for both chat history and inference logs.

## What It Includes

- Multi-turn chatbot UI with streaming responses
- Conversation list, resume, and rename support
- Provider/model switching in the UI
- Internal LLM gateway that captures provider, model, latency, token usage, timestamps, previews, status, and errors
- Ingestion pipeline that validates and persists normalized inference events
- PostgreSQL schema for conversations, chat messages, and inference logs
- Dedicated observability page for latency, throughput, error rate, and token metrics

## Architecture Overview

```mermaid
flowchart LR
  U["User"]
  W["Next.js Web App<br/>Chat UI + Conversation List + Observability"]
  A["Fastify API<br/>Chat + Conversations + Ingestion + Metrics"]
  G["LLM Gateway / Wrapper<br/>Provider adapters + metadata capture"]
  P["LLM Providers<br/>Cerebras + Gemini"]
  I["Ingestion Pipeline<br/>Validate + normalize + persist"]
  D["PostgreSQL<br/>conversations + messages + inference_logs"]

  U --> W
  W --> A
  A --> G
  G --> P
  G --> I
  A --> D
  I --> D
```

I kept the project as one application, but split the responsibilities cleanly so each requirement is still easy to point to.

### How The Four Required Parts Fit Here

1. `Chatbot Application`
The `Next.js` app is the user-facing chat product. It supports multi-turn conversations, provider/model switching, conversation list/resume, rename, streaming responses, and an observability page.

2. `Lightweight SDK / Wrapper`
The internal `llm-gateway` package sits between the API and the model providers. Every LLM call goes through it. It normalizes provider behavior, captures inference metadata, and emits lifecycle events.

3. `Ingestion Pipeline`
The `Fastify` API exposes a dedicated ingestion endpoint. It receives normalized inference events from the gateway, validates them, merges lifecycle updates, and persists them.

4. `Database Storage`
`PostgreSQL` stores conversations, chat messages, and inference logs in separate but linked tables.

### Project Layout

- `apps/web`
  Chat UI, conversation sidebar, rename flow, provider/model selector, streaming request states, and `/observability`.
- `apps/api`
  Fastify server for conversations, chat, cancellation, ingestion, metrics, and health checks.
- `packages/llm-gateway`
  Provider adapters plus normalized inference instrumentation and ingestion transport.
- `packages/shared`
  Shared Zod schemas, types, and provider/model catalog.
- `PostgreSQL`
  Durable storage for conversations, messages, and inference logs.

## Tech Stack

| Layer | Technology |
|-------|------------|
| Language | TypeScript |
| Monorepo | pnpm workspaces |
| Frontend | Next.js 16, React 19, Tailwind CSS 4 |
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

The backend uses `DEFAULT_PROVIDER` and `DEFAULT_MODEL` as its defaults, but the UI can switch provider/model per request.

## Setup Instructions

Create either `.env.local` or `.env` in the repo root. I used `.env.local` for local development.

```bash
cp .env.example .env.local
```

Minimum required values:

```bash
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/signalchat

CEREBRAS_API_KEY=your_cerebras_key
GEMINI_API_KEY=your_gemini_key

DEFAULT_PROVIDER=cerebras
DEFAULT_MODEL=gpt-oss-120b
```

## Run Locally

```bash
pnpm install

docker run -d --name signalchat-postgres \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=signalchat \
  -p 5432:5432 postgres:16-alpine

pnpm db:migrate
pnpm dev
```

Open:

- Web: `http://localhost:3000`
- Observability: `http://localhost:3000/observability`
- API health: `http://localhost:3001/health`

## One-Command Docker Compose

There is also a one-command Docker Compose setup. It reads the repo-root `.env.local` or `.env` file if present.

From the repo root:

```bash
docker compose -f infrastructure/docker/docker-compose.yml up --build
```

Or from the docker directory:

```bash
cd infrastructure/docker
docker compose up --build
```

Open:

- Web: `http://localhost:3000`
- Observability: `http://localhost:3000/observability`
- API: `http://localhost:3001`

## Main API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/health` | GET | Liveness check |
| `/ready` | GET | Readiness check with DB probe |
| `/api/v1/conversations` | POST | Create a conversation |
| `/api/v1/conversations` | GET | List conversations |
| `/api/v1/conversations/:id` | GET | Fetch a conversation and its messages |
| `/api/v1/conversations/:id` | PATCH | Rename a conversation |
| `/api/v1/chat/options` | GET | Available providers, models, and defaults |
| `/api/v1/chat` | POST | Non-streaming chat endpoint |
| `/api/v1/chat/stream` | POST | Primary SSE streaming chat endpoint |
| `/api/v1/chat/:id/cancel` | POST | Cancel active streaming inference |
| `/api/v1/ingestion/inference-logs` | POST | Ingest normalized inference events |
| `/api/v1/metrics/overview` | GET | Aggregate latency, throughput, error, and token metrics |

## Schema Design Decisions

### `conversations`

- One row per chat thread
- Stores title, status, timestamps, and last-message activity markers
- Indexed for recent-first listing and status filtering

### `messages`

- One row per user or assistant message
- Stores full content plus `content_preview` for list views
- Uses `(conversation_id, sequence_number)` uniqueness to keep order stable
- Constrained roles: `system`, `user`, `assistant`
- Tracks message status so cancelled or failed assistant generations are visible

### `inference_logs`

- One row per logical LLM request lifecycle
- Stores provider, model, status, timing, token counts, finish reason, request/response previews, and provider-specific metadata
- Uses `request_id` to merge lifecycle updates across `started` and terminal events
- Uses `event_id` dedupe for direct duplicate submissions
- Links to both the user message and assistant message where available

The main idea behind the schema was to keep chat history and inference telemetry separate, but still link them closely enough that I can trace a single user prompt all the way through provider execution and ingestion.

## Logging And Ingestion Flow

1. The API persists the user message.
2. The chat route builds a short context window from recent messages in the same conversation.
3. The LLM gateway calls the selected provider and captures normalized inference metadata.
4. The gateway sends lifecycle events to `/api/v1/ingestion/inference-logs` in near real time.
5. The ingestion service validates, normalizes, merges, and persists the corresponding `inference_logs` row.
6. The API streams or persists the assistant response and links the final assistant message back to the inference log row.

## Failure Handling Assumptions

- Provider auth, rate-limit, timeout, and network failures are normalized and surfaced cleanly to the UI.
- Ingestion failures should not crash the chat request path.
- Lifecycle updates are merged by `request_id`, and terminal rows are protected from stale `started` retries regressing the stored state.
- Database availability is required for normal chat because messages are persisted as part of the main request flow.
- Streaming cancellation is best-effort and is coordinated per active in-flight request.

## Scaling Considerations

I kept the current version intentionally simple, but if I were pushing this further I would change a few things:

- The ingestion path currently posts to a synchronous HTTP endpoint. For a higher-volume system I would move this to a durable queue or event bus.
- Conversation reads can be optimized further with denormalized metadata or fewer per-conversation lookups.
- Multi-node deployments would need centralized cancellation/state coordination instead of in-memory request tracking.
- Metrics aggregation could move to rollup tables or a dedicated analytics store once request volume grows.

## Tradeoffs Made

1. I kept the project single-user and unauthenticated so I could spend time on inference logging and ingestion instead of account management.
2. I used direct HTTP ingestion plus PostgreSQL persistence instead of adding a queue, mainly to keep the flow easy to inspect during a demo.
3. The observability page reads from the primary database tables rather than a separate time-series system. That is simpler, but it would not be my long-term choice for a larger deployment.
4. Cancellation is coordinated in-process, which works for a single-node demo but would need redesign in a distributed setup.
5. I limited provider support to Cerebras and Gemini so the wrapper stays small while still proving the multi-provider design.

## What I Would Improve With More Time

1. Move ingestion onto a durable async queue or event bus.
2. Add stronger integration tests around end-to-end streaming, cancellation, and log persistence.
3. Add authentication, multi-user support, and per-user conversation isolation.
4. Add PII redaction and retention controls before log persistence.
5. Improve observability with time-bucketed charts, filtering, and drill-down views per provider or conversation.
6. Add search across conversations and richer analytics over token/cost trends.

## Testing

```bash
pnpm lint
pnpm test
pnpm build
```

Useful focused commands:

```bash
pnpm --filter ./apps/api test
pnpm --filter ./apps/api lint
pnpm --filter ./apps/web lint
pnpm --filter ./packages/llm-gateway lint
```

## Demo Checklist

1. Start the app.
2. Create a new conversation.
3. Send multiple turns in the same thread to show short-context multi-turn behavior.
4. Switch between `cerebras` and `gemini` in the header.
5. Resume and rename an older conversation from the sidebar/header.
6. Open `/observability` to show latency, throughput, errors, and token metrics.
7. Inspect stored inference logs in PostgreSQL to confirm metadata persistence.
