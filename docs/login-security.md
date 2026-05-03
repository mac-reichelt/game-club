# Login Security

## Session Management

When you log in, the app issues a session token stored in a secure, HTTP-only cookie. Sessions expire after 30 days.

## Password Change and Session Invalidation

When you change your password:

- **All existing sessions for your account are immediately invalidated.** This includes sessions on other devices and browsers.
- **A new session is issued for your current device.** You stay logged in after changing your password, but all other devices are logged out.
- **Sessions created before your password change cannot be used.** If an attacker had a session token, it becomes invalid as soon as you change your password.

This protects your account if your session token is ever leaked or stolen.

## Minimum Version

Session invalidation on password change is available in version NEXT (after PR #70).
