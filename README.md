# Game Club — Play, Vote, and Discover Together

Game Club lets your group nominate, vote, and track games to play together. Manage members, run elections, and keep your club's gaming history organized.

## Features
- ✅ Member management — add, disable, and authenticate users
- ✅ Game nomination and voting — run elections to pick the next game
- ✅ Login security — per-account lockout and per-IP throttling to prevent brute-force attacks
- ✅ Session management — secure login with session tokens

## Quickstart

Clone and run with Docker Compose:

```bash
git clone https://github.com/<your-org>/game-club.git
cd game-club
docker compose up
```

## Documentation
- [Getting Started](docs/getting-started.md)
- [Configuration](docs/configuration.md)
- [Login Security](docs/login-security.md)

## Status
| Feature                | Status   |
|------------------------|----------|
| Member management      | Stable   |
| Game nomination/voting | Stable   |
| Login security         | Beta     |
| Election history       | Planned  |

## Contributing
See [CONTRIBUTING.md](CONTRIBUTING.md).

## License
MIT — see [LICENSE](LICENSE).
