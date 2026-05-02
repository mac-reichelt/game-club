# Login Security

This page documents the login attempt throttling and account lockout mechanisms used by Game Club.

## Account Lockout and Throttling

Game Club protects against brute-force login attempts by tracking failed login attempts per account and per IP address. If too many failed attempts occur within a short window, further login attempts are blocked.

### Per-Account Lockout

- The app tracks failed login attempts for each account.
- If an account exceeds the maximum allowed failed attempts within a configured window (e.g., 10 attempts in 15 minutes), it is temporarily locked out.
- The lockout prevents further login attempts until the window expires.

### Per-IP Throttling

- Failed login attempts are also tracked per IP address.
- If an IP exceeds its threshold, further attempts from that IP are throttled.

## Atomic Attempt Recording

**Since vNEXT**, the login handler uses an atomic function (`checkAndRecordAttempt`) to record failed login attempts:

- The function checks the current count of failed attempts for the account within the lockout window.
- If the count is below the threshold, it records both the account and IP attempt in a single exclusive transaction.
- If the count is at or above the threshold, it does not record a new attempt.
- This prevents race conditions where concurrent requests could bypass the lockout by both checking before inserting.

**Security Note:**
- The login handler always responds with a generic "Invalid credentials" error, regardless of whether the account is locked, to prevent account enumeration.

## Implementation Details

- The `checkAndRecordAttempt` function ensures that only one request can increment the attempt count at a time, eliminating TOCTOU (time-of-check-to-time-of-use) races.
- See [`src/lib/auth.ts`](../src/lib/auth.ts) for implementation.

## Minimum Version

- Atomic lockout logic is available in Game Club vNEXT and later.

## Related
- [SECURITY.md](../SECURITY.md)
- [README.md](../README.md)
