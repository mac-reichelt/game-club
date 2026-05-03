# Login Security

_Last updated: vNEXT_

This document describes the login security and throttling mechanisms in Game Club.

## Throttling and Lockout

Game Club implements two main protections against brute-force login attempts:

- **Per-IP throttling**: Limits the number of failed login attempts from a single IP address.
- **Per-account lockout**: Limits the number of failed login attempts for a specific account **from a specific IP address**.

### Per-IP Throttling

- If an IP address exceeds the allowed number of failed login attempts within a time window, further attempts from that IP are temporarily blocked.

### Per-Account Lockout (by Username and IP)

- If there are too many failed login attempts for a given username **from the same IP address** within a 10-minute window, further attempts for that (username, IP) pair are locked out for a period.
- **Lockouts are now scoped to the (username, IP) tuple.** This means that an attacker cannot lock out a legitimate user by failing logins from a different IP address.
- A legitimate user can still log in from their own IP even if an attacker is trying to brute-force their account from another IP.

#### Example

- Attacker from IP `9.9.9.9` fails to log in as `alice` 10 times: only `alice` from `9.9.9.9` is locked out.
- `alice` from her own IP `1.2.3.4` can still log in.

### Resetting Lockouts

- A successful login resets the failed-attempt counter for that (username, IP) pair only.
- Failed attempts from other IPs remain unaffected.

### Implementation Notes

- The lockout identifier is the concatenation of username and IP, separated by a null byte (`\x00`).
- This prevents attackers from causing a denial-of-service for other users.

## Version

- This behavior is present in Game Club vNEXT and later.
