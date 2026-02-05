# Backend POC Game Plan (Python)

## The Goal

We need to whip up a solid, offline-first backend. Ideally, it should handle storing, retrieving, and updating documents over the local network (LAN) without needing to phone home to the cloud. Think of it as a "local cloud" for the office.

## What's in the Box (POC Scope)

For this Proof of Concept, we're keeping it lean but functional:

* **REST API**: Standard endpoints to manage docs and templates.
* **Local Storage**: We'll stick to SQLite for data and the local filesystem for any images/assets. Simple and reliable.
* **Conflict Handling**: We'll use version numbers to detect if two people try to save at the same time.
* **LAN Only**: The server just binds to the local network IP. No internet required.

## The Tech Stack

We're going with a robust Python setup:

* **Python 3.11+**: Modern and fast.
* **FastAPI + Uvicorn**: Great for building APIs quickly with auto-generated docs (Swagger UI).
* **SQLite**: It's built right into Python, so no external database server to manage.
* **Pydantic**: Keeps our data validation strict and sanity-checked.
* **Pytest**: For making sure our endpoints actually work before we ship.

## API Cheat Sheet

Here are the main endpoints we're building:

### Documents

* `GET /api/documents` - Grabs a list of all docs. Supports basic search (`?q=...`) if you need it.
* `GET /api/documents/:id` - Gets the full document content.
* `POST /api/documents` - Creates a fresh new document.
* `PUT /api/documents/:id` - Updates a doc. **Heads up:** This checks the `base_version` to prevent overwriting someone else's work. Returns `409 Conflict` if you're out of date.
* `DELETE /api/documents/:id` - Zaps a document.
* `POST /api/documents/:id/lock` & `unlock` - Manually locks a file so others know you're editing it.

### Templates

* `GET /api/templates` - Lists available templates.
* `POST /api/templates` - Creates a new template.
* `POST /api/documents/from-template/:templateId` - The magic endpoint. You send it variables (like `{ "name": "Rehan" }`), and it spits out a new document with those values filled in.

### Real-time Stuff

* `WS /ws/documents/:id` - The WebSocket channel. This is where the live action happens—knowing who else is in the document and seeing lock updates instantly.

## The Data Model (SQLite)

We're keeping the database schema dead simple:

* `id`: Unique string (UUID).
* `title`: The name of the doc.
* `content_json`: The actual text (Quill Delta format), stored as a JSON string.
* `version`: An integer that bumps up (`1`, `2`, `3`...) on every save.
* `locked_by`: Who currently "owns" the edit rights.

## How We'll Build It

1. **Setup**: Get the FastAPI skeleton running.
2. **Database**: Wire up SQLite and defines the models.
3. **CRUD**: Build the basic create/read/update endpoints.
4. **Templates**: Add the logic to swap `{{variables}}` for real text.
5. **Safety**: Implement that version check (Optimistic Locking) so users don't overwrite each other.
6. **Assets**: Allow uploading images to a local folder.
7. **Tests**: Write a few sanity checks with Pytest.

## A Note on "Offline" & LAN

Since this runs on a local machine (likely a designated "server" PC):

* We bind to `0.0.0.0` so anyone on the WiFi can hit the API.
* We strictly avoid any external API calls. Everything stays in the building.

## Future Ideas (Not for POC)

If we want to get fancy later:

* **mDNS/Zeroconf**: So users can go to `http://smartoffice.local` instead of typing IP addresses.
* **AI Integration**: If we add AI later, we'd probably look at **LangGraph** for workflows or **LlamaIndex** for searching through docs, but let's keep it 100% deterministic for now.

That's the plan! Let's get coding. 🚀
