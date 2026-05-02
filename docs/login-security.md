# Login and Signup Security

## Per-IP Throttling

Both the **login** and **signup** endpoints implement per-IP rate limiting to prevent brute-force attacks, bulk account creation, and username enumeration. The throttle logic uses a shared `login_attempts` table and thresholds, so abuse on either endpoint contributes to the same IP counter.

- **Login:** If an IP exceeds the allowed number of failed login attempts, further requests return HTTP 429 (Too Many Requests).
- **Signup:** If an IP exceeds the allowed number of signup attempts (including username collisions), further requests return HTTP 429 (Too Many Requests).

### How IPs Are Determined

The app extracts the real client IP using trusted headers:

- `X-Real-Ip` (set by Traefik reverse proxy) is always used if present.
- Otherwise, the rightmost entry in `X-Forwarded-For` is used (also set by Traefik).

Earlier entries in `X-Forwarded-For` are ignored, as they may be attacker-supplied.

### Throttle Behavior

- **Signup throttle is only checked after invite code validation.** If the invite code is invalid, the throttle logic is not triggered.
- **Username collisions:** If a signup attempt fails because the username is already taken, the IP attempt is recorded and contributes to the throttle.

### Housekeeping

Both endpoints periodically clean up old login attempts from the database.

## Minimum Version

This behavior is present in Game Club version 0.1.0 and later.
