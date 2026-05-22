# Ollive

A lightweight but production-minded inference logging and ingestion system for an LLM chatbot.

## Problem Statement

Build a chatbot application that:
1. Provides a multi-turn conversational UI
2. Wraps LLM calls to capture inference metadata (latency, tokens, errors, etc.)
3. Receives, validates, parses, and stores logs through an ingestion pipeline
4. Persists conversations, messages, and inference logs in PostgreSQL

## Architecture Overview

```
User Browser → Web UI (Next.js) → API (Fastify) → LLM Gateway → Provider API
                                              ↓
                                        Ingestion Pipeline → PostgreSQL
```

### Components

- **Web UI** (`apps/web`): Next.js chat application with streaming, conversation sidebar, and error states
- **API** (`apps/api`): Fastify backend with health checks, conversation CRUD, chat endpoints, and ingestion
- **LLM Gateway** (`packages/llm-gateway`): Thin wrapper around Cerebras and Gemini that normalizes responses and captures metadata
- **Shared Types** (`packages/shared`): Zod schemas and TypeScript types used across the monorepo
- **PostgreSQL**: Stores conversations, messages, and inference logs

## Stack

| Layer | Technology |
|-------|-----------|
| Language | TypeScript |
| Monorepo | pnpm workspaces |
| Frontend | Next.js 14, Tailwind CSS |
| Backend | Fastify 4 |
| Database | PostgreSQL 16 |
| ORM | Drizzle ORM |
| Validation | Zod |
| Testing | Vitest |
| Containerization | Docker Compose |

## Local Setup

### Prerequisites

- Node.js 20+
- pnpm 9+
- PostgreSQL (or Docker)

### Environment Variables

```bash
# Copy the example file
cp .env.example .env

# Edit .env and add your API keys
# CEREBRAS_API_KEY=your_key_here
# GEMINI_API_KEY=your_key_here (optional)
```

### Running Locally

```bash
# Install dependencies
pnpm install

# Start PostgreSQL (if not running)
docker run -d --name ollive-postgres \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=ollive \
  -p 5432:5432 postgres:16-alpine

# Run database migrations
pnpm db:migrate

# Start both web and API
pnpm dev
```

### Docker Compose (One Command)

```bash
# Start the full stack
cd infrastructure/docker
docker-compose up

# The app will be available at:
# - Web UI: http://localhost:3000
# - API: http://localhost:3001
```

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check |
| `/ready` | GET | Readiness check (includes DB) |
| `/api/v1/conversations` | POST | Create conversation |
| `/api/v1/conversations` | GET | List conversations |
| `/api/v1/conversations/:id` | GET | Get conversation with messages |
| `/api/v1/chat` | POST | Send message (non-streaming) |
| `/api/v1/chat/stream` | POST | Send message (SSE streaming) |
| `/api/v1/chat/:id/cancel` | POST | Cancel active inference |
| `/api/v1/ingestion/inference-logs` | POST | Submit inference log |

## Schema Design Decisions

### Conversations
- One row per chat thread
- Tracks status (active, completed, errored, cancelled)
- Indexed on `updated_at` and `status` for fast listing

### Messages
- One row per message
- Includes `content_preview` for UI display without loading full content
- Enforced valid role values (system, user, assistant)
- Unique constraint on `(conversation_id, sequence_number)` to prevent race conditions

### Inference Logs
- One row per LLM invocation
- Comprehensive metadata: timing, tokens, finish reason, previews, errors
- `raw_metadata` as JSONB for provider-specific fields
- Check constraints prevent negative token counts and latency values
- Deduplication via `event_id` and lifecycle updates via `request_id`

## How Logging and Ingestion Work

1. The LLM Gateway wraps every provider call
2. It emits lifecycle events: `started` → `completed`/`failed`/`cancelled`
3. The ingestion service normalizes payloads and persists them to PostgreSQL
4. Duplicate `event_id`s are rejected idempotently
5. Lifecycle events update existing rows by `request_id`
6. Chat flow continues even if ingestion fails (graceful degradation)

## Failure Handling

- **Provider timeout**: Returns clean error to UI, stores `timed_out` status
- **Rate limit**: Returns `rate_limit` error with retry guidance
- **DB unavailable during chat**: Fails before provider call (no wasted tokens)
- **Ingestion failure**: Chat response still returned, error logged server-side
- **Invalid payload**: Returns 400/422 with specific error codes

## Provider Support

### Primary: Cerebras
- Model: `gpt-oss-120b`
- Full streaming support
- Native token usage metadata

### Secondary: Gemini
- Model: `gemini-2.5-flash`
- Fallback: `gemini-2.5-flash-lite`
- Switch via `DEFAULT_PROVIDER` env var

## Tradeoffs

1. **In-process ingestion**: No message broker for simplicity. In a production system, this would be an async queue.
2. **Short context window**: Last 8 messages max (~7K chars). Sufficient for the assignment; summarization could be added later.
3. **No PII redaction**: Mentioned as explicitly out of scope.
4. **Config-based provider switching**: No UI toggle to keep the interface simple.
5. **No authentication**: Single-user demo app.

## Improvements with More Time

1. Add conversation summarization for long threads
2. Implement async ingestion with a message queue (Redis/RabbitMQ)
3. Add basic metrics dashboard
4. Implement PII redaction
5. Add conversation search
6. Multi-user authentication
7. Function calling / tool use
8. Response caching

## Testing

```bash
# Run all tests
pnpm test

# Run API tests specifically
pnpm --filter api test
```

## Demo

To demonstrate the system:
1. Start the app with `docker-compose up`
2. Open http://localhost:3000
3. Create a conversation and send messages
4. Check stored logs via the database or API
5. Try switching providers via the `DEFAULT_PROVIDER` env var
