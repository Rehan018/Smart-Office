# Backend POC Plan (Python)

## Goal

Build a minimal, offline-first backend that can store, retrieve, update, and template documents over a LAN without any external services.

## Scope (POC)

- REST API for documents and templates
- Local persistence (SQLite + filesystem for assets)
- Version-based conflict detection
- LAN-only deployment

## Tech Stack

- Python 3.11+
- FastAPI + Uvicorn
- SQLite (local file)
- Pydantic for schemas
- Pytest for basic API tests

## API Contract (POC)

- `GET /api/documents` -> list documents (id, title, last_modified, is_template); supports `?q=search&limit=20`
- `GET /api/documents/:id` -> fetch document (id, title, content, version)
- `POST /api/documents` -> create document (title, content)
- `PUT /api/documents/:id` -> update (content, base_version) -> returns new version or 409
- `DELETE /api/documents/:id` -> delete
- `POST /api/documents/:id/lock` -> acquire lock (returns lock holder + expiry)
- `POST /api/documents/:id/unlock` -> release lock

Templates:

- `GET /api/templates` -> list templates
- `POST /api/templates` -> create template
- `POST /api/documents/from-template/:templateId` -> instantiate doc from template; accepts `{user_variables: { ... } }`

Real-time:

- `WS /ws/documents/:id` -> presence + lock events (`user_joined`, `user_left`, `lock_acquired`, `lock_released`)

Assets (optional):

- `POST /api/documents/:id/assets` -> store images/files on disk and return local URL

## Data Model (SQLite)

- `documents` table:
  - `id` (text, primary key)
  - `title` (text)
  - `content_json` (text or blob; Quill Delta or AST)
  - `version` (integer)
  - `is_template` (boolean)
  - `last_modified_at` (datetime)
  - `locked_by` (text, nullable)

## Implementation Steps

1. Initialize FastAPI app structure and settings
2. Define Pydantic schemas for requests/responses
3. Add SQLite connection and repository layer
4. Implement CRUD routes for documents
5. Implement template creation + instantiation
6. Add optimistic concurrency checks (409 on conflict)
7. Add basic asset upload storage (filesystem)
8. Write minimal pytest coverage for create/get/update/conflict
9. Document run steps and LAN usage

## Offline + LAN Guarantees

- No external calls or telemetry
- Bind server to `0.0.0.0`
- Keep all data on local disk

## Real-Time Capabilities (Presence + Locking)

- WebSocket channel broadcasts who is viewing/editing a document.
- Locking can be acquired/released via REST endpoints or automatically via WebSocket connect/disconnect.
- The API should return the current lock holder on `GET /api/documents/:id` so the UI can display “Locked by Jane”.

## Suggestions For Improvement

- CORS configuration: add explicit CORS middleware to allow the LAN UI origin (or `*` during POC) when the frontend runs on a different port.
- Asset serving: mount a static files route in FastAPI (e.g., `/static`) so stored images can be retrieved by the frontend.
- Discovery: consider mDNS advertising of the HTTP service (e.g., via `zeroconf`) to avoid typing IP addresses.

## Optional AI Frameworks (Future Only)

These are NOT required for the POC. Use only if/when you add AI later.

- **LangGraph**: Best for stateful, multi-step workflows and human-in-the-loop approvals.
- **LangChain**: Broad integration ecosystem; useful if you need many connectors.
- **LlamaIndex**: Strong for RAG over stored documents.
- **Haystack**: Solid for retrieval pipelines and agent-style flows.

## Recommendation

For this POC, skip AI frameworks to keep the system deterministic and offline. If you add AI later, prefer **LangGraph** for workflow control or **LlamaIndex** for document-centric RAG.
