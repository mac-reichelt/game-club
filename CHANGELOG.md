# Changelog

## [Unreleased]

### Added
- Session invalidation on password change: When a user changes their password, all existing sessions are deleted and a new session is issued for the current device. This logs out all other devices and protects against session theft. See [docs/login-security.md](docs/login-security.md).
