# Smart Office Backend (POC)

## Run
From `smart-office-poc/backend`:

```bash
source venv/bin/activate
uvicorn src.main:app --host 0.0.0.0 --port 8000 --reload
```

## API (POC)
Base URL: `http://<LAN-IP>:8000`

### Documents
- `GET /api/documents` -> list documents
  - Query params: `q` (search), `skip`, `limit`
- `GET /api/documents/:id` -> fetch document
- `POST /api/documents` -> create
- `PUT /api/documents/:id` -> update (expects `base_version`)
- `DELETE /api/documents/:id` -> delete

### Locks
- `POST /api/documents/:id/lock?user=NAME` -> acquire lock (5 min ttl)
- `POST /api/documents/:id/unlock?user=NAME` -> release lock
  - If `user` provided and does not match current holder, returns `423`

### Templates
- `GET /api/templates`
- `POST /api/templates`
- `POST /api/templates/instantiate/:templateId` -> accepts:
  - `{ "user_variables": { "recipient": "John" } }`

### Assets
- `POST /api/documents/:id/assets` -> multipart upload
  - Returns `{ url: "/static/assets/:id/filename" }`
- Assets served from `/static/assets/...`

### WebSockets (Presence + Events)
- `WS /ws/documents/:id?user=NAME`
- Broadcasts:
  - `presence` -> `{ type, count, users }`
  - `user_joined` / `user_left` -> `{ type, user, count, users }`

## Notes
- Offline-first: no external calls, data stored locally in SQLite.
- Designed for LAN: bind to `0.0.0.0` and access via local IP.
- Locking is POC-level (no auth). In production you would enforce identities.

