# Game Club — Play, Vote, and Track Your Favorite Games

Game Club lets you organize game nights, vote on what to play, and track your club's favorites. Simple signup, emoji avatars, and secure profiles.

## Features
- ✅ Game voting — everyone picks, top votes win
- ✅ Emoji avatars — choose your vibe
- ✅ Secure signup — minimum 12-character password, common passwords blocked
- ✅ Profile editing — update your avatar and password

## Quickstart

Clone and run with Docker Compose:

```bash
git clone <repo-url>
cd game-club
docker compose up
```

Then visit [http://localhost:3000](http://localhost:3000).

### Signup Requirements
- **Password must be at least 12 characters**
- **Common passwords (e.g., 'password', '123456', 'qwerty') are not allowed**
- If your password is rejected, try a longer and more unique phrase

## Documentation
- [Getting Started](docs/getting-started.md)
- [Configuration](docs/configuration.md)

## Status
| Feature         | Status   |
|-----------------|----------|
| Game voting     | Stable   |
| Emoji avatars   | Stable   |
| Secure signup   | Stable   |
| Profile editing | Stable   |
| Password rules  | Stable   |

## Contributing
See [CONTRIBUTING.md](CONTRIBUTING.md).

## License
MIT — see [LICENSE](LICENSE).
