## [Unreleased]

### Security
- Login lockout is now scoped to the (username, IP address) tuple, not just username. This prevents attackers from locking out legitimate users by failing logins from a different IP. A successful login only resets the failed-attempt counter for that (username, IP) pair.

