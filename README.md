# Game Club — Find and explore games

Game Club lets you search for games, view details, and discover where to buy or watch trailers. Powered by the RAWG API.

## Features
- ✅ Search games by ID — fetch store links and trailers for a specific game
- ✅ Input validation — only positive integer IDs are accepted for game search

## Quickstart

Clone and run with Docker:

```bash
git clone <repo-url>
cd game-club
docker compose up
```

## Documentation
- [Getting Started](docs/getting-started.md)
- [Configuration](docs/configuration.md)

## API Reference

### GET `/api/games/search/[id]`

Fetches store links and trailers for a game by its ID.

**Input requirements:**
- `id` must be a positive integer (e.g., `42`).
- Non-integer, negative, zero, decimal, or empty IDs return HTTP 400 with `{ error: "Invalid id" }`.

**Example:**

```bash
curl /api/games/search/42
```

**Error responses:**
- 400: Invalid id
- 401: Unauthorized
- 500: RAWG API key missing or upstream error

## Status
- Game search endpoint: **stable**
- Input validation: **stable**
- Store/movie fetching: **stable**

## Contributing
See [CONTRIBUTING.md](CONTRIBUTING.md).

## License
MIT — see [LICENSE](LICENSE).
