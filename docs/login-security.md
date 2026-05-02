# Login & Security

This document describes the security headers and login-related protections in Game Club.

## Content Security Policy (CSP)

Game Club sets a strict [Content Security Policy (CSP)](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP) header on all responses to mitigate XSS and related attacks.

### Directives

The CSP includes the following directives:

- `default-src 'self'`
- `img-src 'self' https://media.rawg.io data:`
- `script-src 'self'`
- `style-src 'self' 'unsafe-inline'` — Next.js injects critical CSS at runtime; a nonce-based approach is tracked as a follow-up improvement.
- `connect-src 'self'`
- `frame-ancestors 'none'`
- `form-action 'self'`
- `base-uri 'self'`
- `upgrade-insecure-requests` — **only in production**

### Environment Differences

- In **production** (`NODE_ENV=production`), the `upgrade-insecure-requests` directive is included. This ensures all requests are upgraded to HTTPS.
- In **development**, `upgrade-insecure-requests` is omitted to allow local development over HTTP (e.g., `http://localhost`).

### Example Header

In production, the CSP header looks like:

```
Content-Security-Policy: default-src 'self'; img-src 'self' https://media.rawg.io data:; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self'; frame-ancestors 'none'; form-action 'self'; base-uri 'self'; upgrade-insecure-requests
```

In development, it omits `upgrade-insecure-requests`:

```
Content-Security-Policy: default-src 'self'; img-src 'self' https://media.rawg.io data:; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self'; frame-ancestors 'none'; form-action 'self'; base-uri 'self'
```

## Other Security Headers

- `Strict-Transport-Security` is also set in production to enforce HTTPS.

---

_Last updated for vNEXT. If you change security headers, update this page._
