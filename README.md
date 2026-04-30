# Game Club — Play, Vote, and Track Your Board Game Nights

Game Club helps your group pick, play, and remember board games. Organize sessions, vote on what to play, and keep track of winners—all in one place.

![Screenshot](docs/assets/screenshot.png)

## Features
- ✅ Secure login with scrypt password hashing (auto-migrates old accounts)
- ✅ Per-IP and per-account login throttling
- ✅ Session management with secure cookies
- ✅ Track games, sessions, and player stats

## Quickstart

Clone and run with Docker Compose:

```bash
git clone https://github.com/your-org/game-club.git
cd game-club
docker compose up
```

Then visit [http://localhost:3000](http://localhost:3000).

## Documentation
- [Getting Started](docs/getting-started.md)
- [Login Security](docs/login-security.md)
- [Configuration](docs/configuration.md)
- [API Reference](docs/reference/api.md)

## Status
| Feature                | Status   |
|------------------------|----------|
| Login & Auth           | Stable   |
| Game Tracking          | Beta     |
| Voting                 | Planned  |

## Contributing
See [CONTRIBUTING.md](CONTRIBUTING.md).

## License
MIT — see [LICENSE](LICENSE).
