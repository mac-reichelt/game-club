# Login Security

## Account Lockout and Throttling

**Minimum version: vNEXT**

Game Club implements multiple layers of protection against brute-force login attempts:

### Per-Account Lockout (by Username and IP)

- After **10 failed login attempts** for the same **(username, IP address) pair** within a 10-minute window, further login attempts for that pair are locked out for 10 minutes.
- This means an attacker cannot lock out a user from all locations; only the specific (username, IP) pair is affected.
- Legitimate users can still log in from other IP addresses even if an attacker triggers a lockout from their own IP.

### Per-IP Throttling

- After **30 failed login attempts** from the same IP address (across all usernames) within a 10-minute window, all further login attempts from that IP are throttled for 10 minutes.

### Reset on Success

- A successful login **resets the failed-attempt counter** for that (username, IP) pair only. Other pairs remain unaffected.

### Implementation Notes

- The lockout identifier is the concatenation of the username and IP address, separated by a null byte (`\x00`).
- This prevents attackers from locking out legitimate users by failing logins from a different IP.

## Example Scenarios

- **Attacker from IP A fails 10 times for user alice:** Only (alice, IP A) is locked out. Alice can still log in from IP B.
- **Attacker from IP A fails 30 times for any usernames:** All logins from IP A are throttled.
- **Alice logs in successfully from IP B:** Only (alice, IP B) counter resets. (alice, IP A) remains locked if previously triggered.

## See Also
- [Authentication API Reference](reference/api.md#login)
- [Security Overview](../SECURITY.md)
