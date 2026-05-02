# Login and Signup Security

This app implements per-IP rate limiting and lockout for both login and signup endpoints to prevent brute-force attacks, bulk account creation, and username enumeration.

## Per-IP Throttling

Both `/api/auth/login` and `/api/auth/signup` endpoints share a common IP-based throttle. Abuse on either endpoint contributes to the same IP counter. If an IP exceeds the configured threshold, further requests are rejected with HTTP 429:

```json
{
  "error": "Too many requests. Please try again later."
}
```

### IP Extraction

The app extracts the real client IP using trusted headers set by the Traefik reverse proxy:

- `X-Real-Ip` is always trustworthy when set by Traefik.
- The rightmost entry of `X-Forwarded-For` is the one Traefik added; earlier entries may be attacker-supplied and are ignored.

### When Throttling Applies

- **Login:** Every failed login attempt increments the IP counter. If the IP is throttled, login is blocked.
- **Signup:** Every failed signup attempt (e.g., username already taken) increments the IP counter. If the IP is throttled, signup is blocked.
- **Invite Code:** Throttling is not checked until after the invite code is validated. Invalid invite codes do not increment the IP counter.

### Housekeeping

Both endpoints periodically clean up old login attempts from the database.

## Username Enumeration Protection

When a signup attempt fails due to a username collision, the IP attempt is recorded. This prevents attackers from enumerating valid usernames without triggering the throttle.

## Minimum Version

This behavior is present in v0.1.0 and later.
