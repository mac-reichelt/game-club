# API Reference

## POST /api/games/[id]/refresh

**Version:** Added in vNEXT

Refreshes the local game fields (`image_url`, `stores_json`) from the configured gamedb for the specified game ID.

- **Authentication:** Required. Must be logged in.
- **GAMEDB_URL:** Must be set in configuration. Otherwise returns 503.

### Request

- **Method:** POST
- **Path parameter:** `id` — integer game ID

### Response

- `200 OK` — `{ success: true }` on successful refresh
- `401 Unauthorized` — `{ error: "Unauthorized" }` if not logged in
- `503 Service Unavailable` — `{ error: "Game refresh is not configured (missing GAMEDB_URL)" }` if gamedb is not configured
- `400 Bad Request` — `{ error: "Invalid id" }` for invalid game ID
- `404 Not Found` — `{ error: "Game not found" }` if the game does not exist
- `400 Bad Request` — `{ error: "Game is not linked to gamedb" }` if the game has no `gamedb_id`
- `404 Not Found` — `{ error: "Game not found in gamedb" }` if the gamedb entry is missing
- `500 Internal Server Error` — `{ error: "Failed to refresh game data" }` on unexpected errors

### Example

```bash
curl -X POST --cookie "session_token=..." https://yourhost/api/games/12/refresh
```

### UI Integration

If `GAMEDB_URL` is configured and a game is linked to gamedb, a "Refresh" button appears in the nominations list. Clicking it triggers this endpoint and updates the game info in the UI.

---

## [Other endpoints...]
