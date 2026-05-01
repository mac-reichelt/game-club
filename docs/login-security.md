# Login Security

## Client IP Extraction (v0.1.0+)

When a user logs in, the app extracts the client IP address for rate-limiting and security checks. The extraction logic depends on trusted proxy headers:

- **Traefik** (our reverse proxy) sets `X-Real-Ip` to the actual connecting peer.
- Traefik **appends** the connecting peer to `X-Forwarded-For` (rightmost entry), rather than replacing it.

### Extraction Logic

1. **If `X-Real-Ip` is present:**
   - The app trusts this value as the real client IP.
2. **If `X-Real-Ip` is absent but `X-Forwarded-For` is present:**
   - The app uses the **rightmost** entry in `X-Forwarded-For` (the one Traefik appended).
3. **If neither header is present:**
   - The app falls back to `unknown`.

> **Note:** Earlier entries in `X-Forwarded-For` may be attacker-supplied and are **not trusted**.

### Security Implications

- **Trusted Proxy Required:**
  - The app must be deployed behind a trusted reverse proxy (e.g., Traefik, Nginx, or a cloud load-balancer) that sets these headers.
  - Without a trusted proxy, an attacker can spoof headers and bypass per-IP throttling.
- **Do not trust leftmost `X-Forwarded-For`:**
  - Picking the leftmost entry (common in client-trusted scenarios) would let attackers rotate spoofed values per request and defeat throttling.

### Example

```
X-Forwarded-For: 203.0.113.1, 198.51.100.2
X-Real-Ip: 198.51.100.2
```

- `X-Real-Ip` is trusted: `198.51.100.2`
- If `X-Real-Ip` is missing, use rightmost `X-Forwarded-For`: `198.51.100.2`

---

**Minimum compatible version:** v0.1.0
