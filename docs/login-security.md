_Last updated: vNEXT_

This page documents the login throttling and lockout logic for Game Club.

## Overview

To protect against brute-force attacks, the login system enforces two types of rate limits:

- **Per-account lockout**: Too many failed login attempts for a given account **from a single IP address** will temporarily lock out further attempts for that (username, IP) pair.
- **Per-IP throttling**: Too many failed attempts from a single IP address (across any accounts) will throttle further attempts from that IP.

## Per-Account Lockout (by Username and IP)

- If there are **10 or more failed login attempts** for the same username **from the same IP address** within a 10-minute window, further login attempts for that (username, IP) pair are locked out for 10 minutes.
- **Lockout is scoped to the (username, IP) tuple.**
  - Example: If an attacker from IP `9.9.9.9` fails to log in as `alice` 10 times, only attempts to log in as `alice` from `9.9.9.9` are locked out. Legitimate users logging in as `alice` from other IPs are unaffected.
  - This prevents attackers from locking out legitimate users by failing logins from their own IP.
- A successful login for a (username, IP) pair **resets the failed-attempt counter for that pair only**.

## Per-IP Throttling

- If there are **30 or more failed login attempts** from the same IP address (across any usernames) within a 10-minute window, further login attempts from that IP are throttled.
- This is independent of the per-account lockout.

## Implementation Details

- The lockout and throttling logic is enforced in the login API route.
- Failed attempts are recorded with an identifier:
  - For account lockout: the identifier is the username and IP, separated by a null byte (`\x00`).
  - For IP throttling: the identifier is the IP address.
- On successful login, only the failed-attempt records for the (username, IP) pair are cleared. IP-based records remain.

## Example Scenarios

| Username | IP         | Failed Attempts | Locked Out? |
|----------|------------|----------------|-------------|
| alice    | 1.2.3.4    | 10             | Yes         |
| alice    | 5.6.7.8    | 0              | No          |
| bob      | 1.2.3.4    | 0              | No          |
| alice    | 9.9.9.9    | 10             | Yes         |
| alice    | 1.2.3.4    | 0              | No          |

## Version

- This logic applies as of vNEXT (see [CHANGELOG.md](../CHANGELOG.md)).

## Username Availability

When you attempt to sign up or change your profile name, the API checks if the requested username is available. If the name is already in use, the API responds with:

- **Status:** `400 Bad Request`
- **Error message:** `That name is not available`

The response does **not** indicate that the name is taken. This prevents attackers from probing which usernames exist.

> **Note:** Previous versions returned `409 Conflict` and the error message `That name is already taken`. This has changed as of vNEXT.

### Rationale

By returning a generic error and status code, the app avoids leaking information about which usernames are registered. This is a common security practice to reduce the risk of enumeration attacks.

### Related Endpoints

- [`POST /api/auth/signup`](reference/api.md#post-apiauthsignup)
- [`PATCH /api/auth/profile`](reference/api.md#patch-apiauthprofile)
