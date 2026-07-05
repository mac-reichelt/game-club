# Login & Account Security

_Last updated: vNEXT_

## Authentication

- Passwords are hashed using scrypt.
- Sessions are stored server-side and validated on each request.
- Changing your password invalidates all previous sessions.

## Account Deactivation & Deletion

### Deactivating your account

You can deactivate and anonymize your account from the profile page:

1. Go to **Profile** > **Delete Account**.
2. Enter your current password and type `DELETE` to confirm.
3. Your account will be:
   - Marked as inactive (`active = 0`)
   - Name changed to `Deleted User #<id>`
   - Avatar reset to default
   - `deactivated_at` timestamp set
   - All sessions invalidated and you will be logged out

This preserves club history (e.g., past games and votes) but removes your name and access.

### API: DELETE /api/auth/profile

- **Request:**
  - Method: `DELETE`
  - Body: `{ "currentPassword": "..." }`
  - Cookie: `session_token`
- **Response:**
  - `200 OK` on success (JSON `{ success: true }`)
  - `401 Unauthorized` if not logged in or password incorrect
  - `400 Bad Request` if password missing

### Login and Sessions

- Deactivated accounts (`active = 0`) cannot log in. Login returns `403` with an error message.
- Existing sessions for deactivated accounts are invalidated and cannot be used.
- The `/api/members` endpoint only returns active members.

## Database Schema Changes

- `members` table now includes:
  - `active INTEGER NOT NULL DEFAULT 1` — 0 if deactivated
  - `deactivated_at TEXT` — timestamp of deactivation

Existing deployments auto-migrate these columns on next start.
