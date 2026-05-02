# Login & Signup Security

## Username Availability

When you attempt to sign up or change your profile name, the API checks if the requested username is available. If the name is already in use, the API responds with:

- **Status:** `400 Bad Request`
- **Error message:** `That name is not available`

The response does **not** indicate that the name is taken. This prevents attackers from probing which usernames exist.

> **Note:** Previous versions returned `409 Conflict` and the error message `That name is already taken`. This has changed as of vNEXT.

## Rationale

By returning a generic error and status code, the app avoids leaking information about which usernames are registered. This is a common security practice to reduce the risk of enumeration attacks.

## Related Endpoints

- [`POST /api/auth/signup`](reference/api.md#post-apiauthsignup)
- [`PATCH /api/auth/profile`](reference/api.md#patch-apiauthprofile)

## Minimum Version

This behavior is present in vNEXT and later.