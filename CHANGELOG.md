## [Unreleased]

### Added
- **Account deletion:** Users can now deactivate and anonymize their own account via the profile page. This sets the account as inactive, anonymizes the name, and logs the user out. ([#106](https://github.com/your-org/game-club/pull/106))
- **API:** `DELETE /api/auth/profile` endpoint to deactivate/anonymize the current user's account. Requires current password and confirmation.
- Introduced `getOpenElectionData` API for fetching the current open election, its games, and voter information.
- Election voting UI now appears directly on the Elections and Dashboard pages, instead of the Nominations page.

### Changed
- **Login security:** Login and session validation now reject accounts that are deactivated (`active = 0`).
- **Database:** `members` table now includes `active` (default 1) and `deactivated_at` columns. Existing accounts are considered active by default.
- **Members API:** `/api/members` now only returns active members.
- Ballot casting is now integrated into the Elections and Dashboard pages. The Nominations page no longer displays the ballot form for active elections.

### Migration
- Existing deployments will auto-migrate the `members` table to add `active` and `deactivated_at` columns on next start.
