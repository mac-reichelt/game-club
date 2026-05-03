# Changelog

## [Unreleased]

### Added
- Per-IP rate limiting for the signup endpoint. Signup requests now use the same throttle and login_attempts table as login, preventing bulk account creation and username enumeration attacks. If an IP exceeds the limit, signup returns HTTP 429 (Too Many Requests).

### Changed
- The login and signup endpoints now share rate-limiting logic and cleanup routines.

