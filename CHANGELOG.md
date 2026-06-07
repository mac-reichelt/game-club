## [Unreleased]

### Added
- **Account deletion:** Users can now deactivate and anonymize their own account via the profile page. This sets the account as inactive, anonymizes the name, and logs the user out. ([#106](https://github.com/your-org/game-club/pull/106))
- **API:** `DELETE /api/auth/profile` endpoint to deactivate/anonymize the current user's account. Requires current password and confirmation.

### Changed
- **Login security:** Login and session validation now reject accounts that are deactivated (`active = 0`).
- **Database:** `members` table now includes `active` (default 1) and `deactivated_at` columns. Existing accounts are considered active by default.
- **Members API:** `/api/members` now only returns active members.

### Migration
- Existing deployments will auto-migrate the `members` table to add `active` and `deactivated_at` columns on next start.
