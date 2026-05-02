# Login & Security

## Session Management

Game Club uses session tokens to authenticate users. Each login creates a new session, which is stored in the database and associated with the user's account.

### Session Invalidation on Password Change

**Version:** vNEXT (after PR #70)

When you change your password, Game Club:

- **Invalidates all existing sessions** for your account, including those on other devices.
- **Issues a fresh session token** for your current device, so you stay logged in.
- **Removes all session tokens** that were created before the password change. This prevents attackers from using old sessions if your password was compromised.

#### Technical Details

- The `members` table now includes a `password_changed_at` timestamp.
- Session validation checks that the session's `created_at` is **after** `password_changed_at`. Sessions created before a password change are rejected.
- When you update your password, the backend:
  - Updates `password_hash` and sets `password_changed_at` to the current time.
  - Deletes all sessions for your user ID.
  - Creates a new session token for your current device.

#### Example

If you change your password at 12:00pm:

- Any session created before 12:00pm is invalidated.
- Only sessions created at or after 12:00pm are valid.

## Security Implications

- **Immediate session revocation:** If an attacker has a session token, changing your password will log them out everywhere.
- **Current device stays logged in:** You won't be logged out on the device where you changed your password.

## Related Topics

- [Password Requirements](./passwords.md)
- [Session Tokens](./sessions.md)

## Username Availability

When you attempt to sign up or change your profile name, the API checks if the requested username is available. If the name is already in use, the API responds with:

- **Status:** `400 Bad Request`
- **Error message:** `That name is not available`

The response does **not** indicate that the name is taken. This prevents attackers from probing which usernames exist.

> **Note:** Previous versions returned `409 Conflict` and the error message `That name is already taken`. This has changed as of vNEXT.

### Related Endpoints

- [`POST /api/auth/signup`](reference/api.md#post-apiauthsignup)
- [`PATCH /api/auth/profile`](reference/api.md#patch-apiauthprofile)
