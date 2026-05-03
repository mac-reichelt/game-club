# Changelog

## [Unreleased]

### Security
- **Login lockout is now scoped to (username, IP) pairs.**
  - Previously, too many failed login attempts for a username from any IP would lock out that account for all users.
  - Now, lockouts only apply to the (username, IP) tuple. This prevents attackers from locking out legitimate users by failing logins from a different IP address.
  - A successful login only resets the failed-attempt counter for that (username, IP) pair.

