# Game Club — Track, vote, and play games with your club

Game Club helps your group organize, vote on, and record board/video game sessions. Manage members, run elections, and keep a history of what you've played.

![Game Club screenshot](docs/assets/screenshot.png)

## Features
- ✅ Member management — Sign up, edit profile, delete/deactivate account
- ✅ Secure login — Password hashing, session invalidation, account deactivation
- ✅ Game tracking — Add, vote, and record play sessions
- ✅ Elections — Run ranked-choice votes for what to play next

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
- [Configuration](docs/configuration.md)
- [Login & Security](docs/login-security.md)

## Status
| Feature                | Status   |
|------------------------|----------|
| Member sign-up/login   | Stable   |
| Account deletion       | Beta     |
| Game tracking          | Stable   |
| Elections              | Stable   |
| API docs               | Planned  |

## Contributing
See [CONTRIBUTING.md](CONTRIBUTING.md).

## License
MIT — see [LICENSE](LICENSE).
