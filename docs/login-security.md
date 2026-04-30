# Login Security

This page documents the authentication and login security mechanisms for Game Club.

## Password Hashing

**Minimum version:** vNEXT (PR #45)

Game Club uses the [scrypt](https://en.wikipedia.org/wiki/Scrypt) key derivation function to securely hash user passwords. This protects against brute-force and GPU-based attacks.

- **Format:** `scrypt:<hex-salt>:<hex-hash>`
- **Salt:** 16 bytes (32 hex chars), randomly generated per password
- **Hash:** 64 bytes (128 hex chars), scrypt output
- **Parameters:**
  - N = 16384
  - r = 8
  - p = 1
  - Key length = 64 bytes

All password hashing and verification is **asynchronous** and does not block the event loop.

### Legacy Hash Migration

If a user account's password is still stored in the legacy SHA-256 format (`<salt>:<hash>`), the system will:

1. Accept the password if it matches the legacy hash.
2. **Immediately upgrade** the stored hash to scrypt on the next successful login.

This migration is transparent to users. No action is required.

### Timing Attack Mitigation

- All login attempts (including for non-existent accounts) run the full scrypt verification path using a dummy hash. This prevents attackers from distinguishing valid usernames by timing differences.

- The dummy hash is in scrypt format and is guaranteed to fail, but takes the same time to verify as a real hash.

## Login Throttling and Lockout

- **Per-IP throttle:** Limits the number of login attempts from a single IP in a rolling window.
- **Per-account lockout:** Temporarily locks accounts after too many failed attempts.
- **Housekeeping:** Old login attempt records are cleaned up periodically (on ~5% of login requests).

See [API Reference](reference/api.md#auth) for endpoint details.

## Changing Your Password

- Password changes always use the latest scrypt hashing scheme.
- The current password is verified before allowing a change.

## Version Compatibility

- scrypt-based hashes require Node.js 10+ (for `crypto.scrypt`).
- Legacy SHA-256 hashes are supported for migration only.

---

**See also:**
- [Getting Started](getting-started.md)
- [API Reference](reference/api.md)
