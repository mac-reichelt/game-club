# Changelog

## [Unreleased]

### Added
- Added `POST /api/games/[id]/refresh` API endpoint to refresh a game's `image_url` and store links from the configured gamedb. This endpoint requires authentication and only works if `GAMEDB_URL` is set. Returns 401 if unauthenticated, 503 if gamedb is not configured, 400 for invalid IDs, 404 if the game or gamedb entry is missing, and 200 on success.
- Added a "Refresh" button to the nominations list UI for each game, allowing users to manually trigger a refresh of game info from gamedb. The button is disabled if gamedb is not configured or the game is not linked.
