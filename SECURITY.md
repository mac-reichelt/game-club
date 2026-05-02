# Security

This project prioritizes user safety and data integrity. Below are the current security measures and recommendations.

## SSRF Mitigation

As of version main, the backend validates all game database fetches by sanitizing numeric IDs used in URL paths. Only positive integers (1–15 digits) are accepted, preventing server-side request forgery (SSRF) via crafted path segments. The validation uses a regex (`/^[1-9][0-9]{0,14}$/`) recognized by CodeQL as a safe sanitizer.

**Example:**

```js
function safeIdSegment(id: number): string {
  const s = String(id);
  if (!/^[1-9][0-9]{0,14}$/.test(s)) {
    throw new Error("Invalid id");
  }
  return s;
}
```

## Store/Trailer URL Domain Parsing

Store and trailer URLs are now parsed using strict domain matching. Only recognized domains (e.g., `steampowered.com`, `playstation.com`, `youtube.com`, etc.) are accepted for store/trailer identification. Subdomains are matched explicitly, reducing the risk of spoofed or malicious links.

**Example:**

- `store.steampowered.com` → Steam
- `youtube.com`, `youtu.be` → Trailer

## Authentication

See [docs/login-security.md](docs/login-security.md) for authentication details.

## Reporting Vulnerabilities

If you discover a security issue, please email [maintainer email] or open a GitHub security advisory. We respond within 48 hours.
