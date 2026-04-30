# Login Security

Game Club implements multiple safeguards to protect user accounts from brute-force and enumeration attacks.

## Account Lockout

- **Threshold:** After 10 failed login attempts for a single account within a 10-minute window, further attempts are locked out for that account.
- **Reset:** Successful login resets the failed-attempt counter for that account.

## IP Throttling

- **Threshold:** After 30 login attempts (regardless of outcome) from a single IP address within a 5-minute window, further attempts from that IP are rejected.
- **Purpose:** Limits mass brute-force attempts from a single source.

## Attempt Tracking

- All failed login attempts are recorded in the `login_attempts` table.
- Both account and IP attempts are tracked separately.
- Old records (older than 1 hour) are periodically cleaned up to keep the table small.

## Timing-Safe Username Checks

- When a login references a non-existent account, password verification is still performed against a dummy hash to ensure response timing is consistent.
- This prevents attackers from enumerating valid usernames via timing differences.

## Deployment Note: Trusted Proxy Required

- **IP throttling relies on the `X-Forwarded-For` header.**
- Deploy Game Club behind a trusted reverse proxy (e.g., Traefik, Nginx, or a cloud load-balancer) that sets `X-Forwarded-For`.
- If deployed without a proxy, clients can spoof their IP and bypass throttling.

## Configuration

The thresholds and windows are currently hardcoded:

| Setting                | Value         |
|------------------------|--------------|
| Account lock threshold | 10 attempts   |
| Account window         | 10 minutes    |
| IP throttle threshold  | 30 attempts   |
| IP window              | 5 minutes     |
| Cleanup age            | 60 minutes    |

## Schema

The `login_attempts` table:

```sql
CREATE TABLE login_attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  identifier TEXT NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('account', 'ip')),
  attempted_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_login_attempts_lookup ON login_attempts(identifier, type, attempted_at);
```

## Minimum Version

Login security features require Game Club v0.1.0 or later.
