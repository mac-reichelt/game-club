# Login Security

## Brute-force Protection

Game Club implements multiple layers of brute-force protection for login attempts.

### Per-IP Throttling
- If an IP address makes too many failed login attempts in a short window, further attempts from that IP are temporarily blocked.
- Default: 30 failed attempts per 10 minutes per IP.

### Per-Account Lockout (Scoped by IP)
- If there are too many failed login attempts for a given username **from a single IP address**, further attempts for that (username, IP) pair are temporarily locked out.
- Default: 10 failed attempts per 10 minutes **per (username, IP) tuple**.
- **Note:** This prevents an attacker from locking out a target account globally by failing logins from their own IP. Only the (username, IP) pair that exceeded the threshold is locked out; other users (or the same user from a different IP) are unaffected.

### Lockout Reset
- A successful login for a (username, IP) pair resets the failed-attempt counter for that pair.
- IP-based throttling is not reset by a successful login.

### Implementation Details
- The lockout identifier for account lockouts is the concatenation of the username and IP address, separated by a null byte (`\x00`).
- All lockout windows and thresholds are configurable in the code.

## Version
- This behavior is accurate as of vNEXT (after PR #67).
