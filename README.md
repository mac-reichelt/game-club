# Game Club — <one-line tagline>

<2–3 sentence what + why. Hero screenshot/GIF if visual.>

## Features
- ✅ <feature> — <one-line>
- ✅ <feature> — <one-line>
- ✅ Built-in HTTP security headers — Enforces Content Security Policy, HSTS, Referrer Policy, Permissions Policy, and other headers for secure deployment

## Quickstart

<5 minutes from clone to running. Exact commands.>

```bash
git clone ...
cd game-club
docker compose up
```

## Documentation
- [Getting Started](docs/getting-started.md)
- [Configuration](docs/configuration.md)

## Security Headers

When running Game Club, the server automatically applies several HTTP security headers to all routes:

- **Content-Security-Policy**: Restricts sources for scripts, styles, images, and other content. Note: `style-src` includes `'unsafe-inline'` to support Next.js runtime CSS injection.
- **Strict-Transport-Security**: Enforces HTTPS for one year, including subdomains.
- **Referrer-Policy**: Uses `strict-origin-when-cross-origin` for privacy.
- **Permissions-Policy**: Disables geolocation, camera, microphone, and payment APIs.
- **X-Frame-Options**: Denies all framing.
- **X-Content-Type-Options**: Prevents MIME type sniffing.

These headers are set in [`next.config.ts`](next.config.ts) and apply to all routes. If you customize deployment or add new routes, review these settings for compatibility.

## Status
<table or paragraph: which features are stable, beta, planned>

## Contributing
See [CONTRIBUTING.md](CONTRIBUTING.md).

## License
<SPDX identifier> — see [LICENSE](LICENSE).
