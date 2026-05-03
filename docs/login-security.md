# Login and Signup Security

## Rate Limiting

Both the login and signup endpoints enforce per-IP rate limiting to prevent brute-force attacks and bulk account creation.

- **Shared throttle:** The login and signup endpoints use a shared `login_attempts` table and thresholds. Abuse on either endpoint contributes to the same IP counter.
- **Threshold:** If an IP exceeds the allowed number of attempts within a time window, further requests are rejected with HTTP 429 (Too Many Requests).
- **Cleanup:** Old login attempts are periodically cleaned up.

### How IPs are determined

The app extracts the real client IP using trusted headers set by the Traefik reverse proxy:

- `X-Real-Ip` is used if present.
- Otherwise, the rightmost entry in `X-Forwarded-For` is used.

This prevents attackers from spoofing IPs via headers.

## Signup Invite Code

Signup requires a valid invite code. If the invite code is invalid, the throttle is not checked.

## Username Enumeration Protection

When a signup attempt fails due to a taken username, the attempt is recorded against the IP, contributing to the throttle.

## Minimum Version

This behavior is present in v0.1.0 and later.
